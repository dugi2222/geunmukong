-- 근무멍 계정별 근무표/별칭 저장소. SQL Editor에서 1회 실행.
create table if not exists public.gm_account_data (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.gm_account_data enable row level security;
revoke all on public.gm_account_data from anon;
grant select,insert,update on public.gm_account_data to authenticated;
drop policy if exists gm_account_data_own_select on public.gm_account_data;
drop policy if exists gm_account_data_own_insert on public.gm_account_data;
drop policy if exists gm_account_data_own_update on public.gm_account_data;
create policy gm_account_data_own_select on public.gm_account_data for select to authenticated using (user_id = (select auth.uid()));
create policy gm_account_data_own_insert on public.gm_account_data for insert to authenticated with check (user_id = (select auth.uid()));
create policy gm_account_data_own_update on public.gm_account_data for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
