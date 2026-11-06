-- Preserve the original price rule on existing sessions; new sessions use hourly steps.
-- Before 120 minutes: 0. At 120: 20 THB. At 180: 40 THB. At 240: 60 THB.
alter table public.parking_sessions add column billing_model text not null default 'minute'
 check (billing_model in ('minute','hourly_step'));
alter table public.parking_sessions alter column billing_model set default 'hourly_step';

create function public.parking_cost(p_start timestamptz,p_end timestamptz,p_free integer,p_rate integer,p_model text)
returns bigint language sql immutable set search_path=public as $$
 select case when p_model='minute' then public.parking_cost(p_start,p_end,p_free,p_rate)
 when p_end-p_start < make_interval(mins=>p_free) then 0
 else (floor((extract(epoch from (p_end-p_start))-p_free::numeric*60)/3600)::bigint+1)*p_rate end;
$$;
revoke all on function public.parking_cost(timestamptz,timestamptz,integer,integer,text) from public,anon,authenticated;
grant execute on function public.parking_cost(timestamptz,timestamptz,integer,integer,text) to service_role;

create or replace function public.parking_command(p_user uuid,p_action text,p_payload jsonb default '{}'::jsonb,p_key text default null,p_source text default 'web',p_token_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_now timestamptz;v_row parking_sessions%rowtype;v_cached parking_requests%rowtype;v_result jsonb;v_state text;v_start timestamptz;v_end timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 v_now:=date_trunc('milliseconds',clock_timestamp());
 if p_source='shortcut' then
  if p_action not in ('start','stop','status') or not exists(select 1 from shortcut_tokens where id=p_token_id and user_id=p_user and revoked_at is null) then raise exception 'PT_TOKEN';end if;
 end if;
 if p_action in ('start','stop') then
  if p_key is null or p_key !~ '^[a-zA-Z0-9_-]{16,128}$' then raise exception 'PT_KEY';end if;
  select * into v_cached from parking_requests where user_id=p_user and request_key=p_key;
  if found then if v_cached.action<>p_action then raise exception 'PT_KEY';end if;return v_cached.response;end if;
 end if;
 if p_action in ('start','stop','status') then
  select * into v_row from parking_sessions where user_id=p_user and ended_at is null for update;
  if p_action='start' then
   if v_row.id is not null then v_state:='already_active';
   else insert into parking_sessions(user_id,started_at,source) values(p_user,v_now,p_source) returning * into v_row;v_state:='started';end if;
  elsif p_action='stop' then
   if v_row.id is null then v_state:='idle';
   else update parking_sessions set ended_at=v_now,cost_satang=parking_cost(started_at,v_now,free_minutes,hourly_rate_satang,billing_model) where id=v_row.id returning * into v_row;v_state:='stopped';end if;
  else v_state:=case when v_row.id is null then 'idle' else 'active' end;end if;
 elsif p_action in ('edit','delete') then
  select * into v_row from parking_sessions where id=(p_payload->>'id')::uuid and user_id=p_user and ended_at is not null for update;
  if v_row.id is null then raise exception 'PT_NOT_FOUND';end if;
  if p_action='delete' then delete from parking_sessions where id=v_row.id;v_state:='deleted';
  else
   v_start:=(p_payload->>'started_at')::timestamptz;v_end:=(p_payload->>'ended_at')::timestamptz;
   if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end) or v_end<v_start or v_start>v_now or v_end>v_now then raise exception 'PT_TIME';end if;
   update parking_sessions set started_at=v_start,ended_at=v_end,cost_satang=parking_cost(v_start,v_end,free_minutes,hourly_rate_satang,billing_model) where id=v_row.id returning * into v_row;v_state:='edited';
  end if;
 else raise exception 'PT_ACTION';end if;
 v_result:=jsonb_build_object('state',v_state,'session',case when v_row.id is null then null else to_jsonb(v_row)-'user_id' end,'server_time',v_now);
 if p_action in ('start','stop') then insert into parking_requests(user_id,request_key,action,response) values(p_user,p_key,p_action,v_result);end if;
 return v_result;
end;$$;

