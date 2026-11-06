-- Apply once through Supabase SQL Editor, or `supabase db push`.
create extension if not exists btree_gist with schema extensions;
create table public.parking_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 started_at timestamptz not null,
 ended_at timestamptz,
 free_minutes integer not null default 120 check (free_minutes between 0 and 10080),
 hourly_rate_satang integer not null default 2000 check (hourly_rate_satang between 0 and 1000000),
 cost_satang bigint,
 source text not null default 'web' check (source in ('web','shortcut')),
 created_at timestamptz not null default now(),
 constraint valid_interval check (ended_at is null or ended_at >= started_at),
 constraint valid_cost check ((ended_at is null and cost_satang is null) or (ended_at is not null and cost_satang >= 0)),
 constraint no_overlapping_parking exclude using gist (user_id with =, tstzrange(started_at,ended_at,'[)') with &&)
);
create unique index one_active_parking on public.parking_sessions(user_id) where ended_at is null;
create index parking_user_date on public.parking_sessions(user_id,started_at desc);
create table public.shortcut_tokens (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,token_hash text not null unique,prefix text not null,
 created_at timestamptz not null default now(),last_used_at timestamptz,revoked_at timestamptz
);
create index tokens_user on public.shortcut_tokens(user_id);
create table public.parking_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_key text not null,action text not null,response jsonb not null,
 created_at timestamptz not null default now(),primary key(user_id,request_key)
);
create table public.api_rate_limits (key text primary key,window_start timestamptz not null,hits integer not null);
alter table public.parking_sessions enable row level security;
alter table public.shortcut_tokens enable row level security;
alter table public.parking_requests enable row level security;
alter table public.api_rate_limits enable row level security;
-- Browser roles have NO direct write access. All changes go through server-only RPCs.
revoke all on public.parking_sessions,public.shortcut_tokens,public.parking_requests,public.api_rate_limits from anon,authenticated;
grant all on public.parking_sessions,public.shortcut_tokens,public.parking_requests,public.api_rate_limits to service_role;

create function public.parking_cost(p_start timestamptz,p_end timestamptz,p_free integer,p_rate integer)
returns bigint language sql immutable set search_path=public as $$
 select floor((ceil(greatest(0,extract(epoch from (p_end-p_start))*1000-p_free::numeric*60000)/60000)*p_rate+30)/60)::bigint;
$$;

create function public.consume_rate_limit(p_key text,p_limit integer default 90)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_hits integer;begin
 insert into api_rate_limits(key,window_start,hits) values(p_key,date_trunc('minute',clock_timestamp()),1)
 on conflict(key) do update set hits=case when api_rate_limits.window_start=excluded.window_start then api_rate_limits.hits+1 else 1 end,window_start=excluded.window_start
 returning hits into v_hits;
 return v_hits<=p_limit;
end;$$;

create function public.parking_command(p_user uuid,p_action text,p_payload jsonb default '{}'::jsonb,p_key text default null,p_source text default 'web',p_token_id uuid default null)
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
   else update parking_sessions set ended_at=v_now,cost_satang=parking_cost(started_at,v_now,free_minutes,hourly_rate_satang) where id=v_row.id returning * into v_row;v_state:='stopped';end if;
  else v_state:=case when v_row.id is null then 'idle' else 'active' end;end if;
 elsif p_action in ('edit','delete') then
  select * into v_row from parking_sessions where id=(p_payload->>'id')::uuid and user_id=p_user and ended_at is not null for update;
  if v_row.id is null then raise exception 'PT_NOT_FOUND';end if;
  if p_action='delete' then delete from parking_sessions where id=v_row.id;v_state:='deleted';
  else
   v_start:=(p_payload->>'started_at')::timestamptz;v_end:=(p_payload->>'ended_at')::timestamptz;
   if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end) or v_end<v_start or v_start>v_now or v_end>v_now then raise exception 'PT_TIME';end if;
   update parking_sessions set started_at=v_start,ended_at=v_end,cost_satang=parking_cost(v_start,v_end,free_minutes,hourly_rate_satang) where id=v_row.id returning * into v_row;v_state:='edited';
  end if;
 else raise exception 'PT_ACTION';end if;
 v_result:=jsonb_build_object('state',v_state,'session',case when v_row.id is null then null else to_jsonb(v_row)-'user_id' end,'server_time',v_now);
 if p_action in ('start','stop') then insert into parking_requests(user_id,request_key,action,response) values(p_user,p_key,p_action,v_result);end if;
 return v_result;
end;$$;

create function public.parking_bootstrap(p_user uuid)
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('server_time',clock_timestamp(),
 'sessions',coalesce((select jsonb_agg(to_jsonb(s)-'user_id' order by s.started_at desc) from parking_sessions s where user_id=p_user),'[]'::jsonb),
 'tokens',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'prefix',t.prefix,'created_at',t.created_at,'last_used_at',t.last_used_at,'revoked_at',t.revoked_at) order by t.created_at desc) from shortcut_tokens t where user_id=p_user),'[]'::jsonb));
$$;
create function public.revoke_shortcut_token(p_user uuid,p_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 update shortcut_tokens set revoked_at=clock_timestamp() where id=p_id and user_id=p_user and revoked_at is null;
 return found;
end;$$;
revoke all on function public.parking_cost(timestamptz,timestamptz,integer,integer) from public,anon,authenticated;
revoke all on function public.consume_rate_limit(text,integer) from public,anon,authenticated;
revoke all on function public.parking_command(uuid,text,jsonb,text,text,uuid) from public,anon,authenticated;
revoke all on function public.parking_bootstrap(uuid) from public,anon,authenticated;
revoke all on function public.revoke_shortcut_token(uuid,uuid) from public,anon,authenticated;
grant execute on function public.parking_cost(timestamptz,timestamptz,integer,integer),public.consume_rate_limit(text,integer),public.parking_command(uuid,text,jsonb,text,text,uuid),public.parking_bootstrap(uuid),public.revoke_shortcut_token(uuid,uuid) to service_role;
