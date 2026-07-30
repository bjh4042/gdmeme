create table public.app_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.app_state to anon;
grant select, insert, update, delete on public.app_state to authenticated;
grant all on public.app_state to service_role;

alter table public.app_state enable row level security;

create policy "app_state_select_all" on public.app_state for select using (true);
create policy "app_state_insert_all" on public.app_state for insert with check (true);
create policy "app_state_update_all" on public.app_state for update using (true) with check (true);

insert into public.app_state (key, value)
select 'wtmeme:store:roster:v1',
  jsonb_build_object(
    'state', jsonb_build_object('students', jsonb_agg(s.rec order by s.n)),
    'version', 0
  )::text
from (
  select n, jsonb_build_object(
    'id', '3105_' || lpad(n::text, 2, '0'),
    'classCode', '3105',
    'number', lpad(n::text, 2, '0'),
    'name', '학생' || n,
    'xp', 0,
    'joinedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'lastActiveAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  ) as rec
  from generate_series(1, 17) as n
) s;

insert into public.app_state (key, value) values (
  'wtmeme:store:class:v1',
  jsonb_build_object(
    'state', jsonb_build_object('byClass', jsonb_build_object('3105', jsonb_build_object('xp', 0, 'activityLog', '[]'::jsonb))),
    'version', 0
  )::text
);