-- Single-owner application: no Supabase Auth account is required.
-- Keep the existing owner's IDs, records, rate snapshots and Siri tokens.
begin;
create table public.parking_owner (
 id uuid primary key,
 singleton boolean not null default true unique check (singleton)
);
alter table public.parking_owner enable row level security;
revoke all on public.parking_owner from public,anon,authenticated;
grant all on public.parking_owner to service_role;
do $$
declare owners uuid[]; selected_owner uuid;
begin
 select array_agg(distinct user_id) into owners from (
  select user_id from public.parking_sessions
  union select user_id from public.shortcut_tokens
  union select user_id from public.parking_requests
 ) existing;
 if coalesce(array_length(owners,1),0)>1 then
  raise exception 'Multiple existing owners found. Select the intended owner and archive the other data before applying single-owner migration.';
 end if;
 selected_owner:=coalesce(owners[1],gen_random_uuid());
 insert into public.parking_owner(id) values(selected_owner);
end $$;
alter table public.parking_sessions drop constraint parking_sessions_user_id_fkey;
alter table public.shortcut_tokens drop constraint shortcut_tokens_user_id_fkey;
alter table public.parking_requests drop constraint parking_requests_user_id_fkey;
alter table public.parking_sessions add foreign key(user_id) references public.parking_owner(id);
alter table public.shortcut_tokens add foreign key(user_id) references public.parking_owner(id);
alter table public.parking_requests add foreign key(user_id) references public.parking_owner(id);
commit;
