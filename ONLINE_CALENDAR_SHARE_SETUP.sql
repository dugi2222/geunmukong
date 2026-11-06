-- 근무멍 v26: 친구별 근무표 공유 (비공개 기본값)
-- Supabase SQL Editor에서 기존 SQL을 지우지 말고 새 쿼리로 한 번 실행하세요.
-- 기존 계정/친구/채팅/게시판/달력 데이터는 삭제하지 않습니다.
-- 공유되는 정보: 근무 종류(주간/야간/비번/휴무/오후/연차/당직), 날짜만.
-- 비공개 정보: 메모, 일정 본문, 근무시간, 이메일, 연차 차감량.

create table if not exists public.gm_calendar_snapshots (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  schedule jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.gm_calendar_grants (
  owner_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id, viewer_id),
  constraint gm_calendar_no_self check (owner_id <> viewer_id)
);
create index if not exists gm_calendar_grants_viewer_idx on public.gm_calendar_grants(viewer_id);
alter table public.gm_calendar_snapshots enable row level security;
alter table public.gm_calendar_grants enable row level security;
-- 접근은 아래 SECURITY DEFINER RPC에서만 제한적으로 허용
revoke all on public.gm_calendar_snapshots, public.gm_calendar_grants from public, anon, authenticated;

create or replace function public.gm_calendar_publish(p_schedule jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_cycle jsonb;
  v_overrides jsonb;
  v_item text;
  v_key text;
  v_val text;
  v_index integer;
  v_base date;
  v_mode text;
begin
  if v_user is null then raise exception '로그인해 주세요.'; end if;
  if p_schedule is null or jsonb_typeof(p_schedule) <> 'object' or octet_length(p_schedule::text)>100000 then
    raise exception '근무표 데이터 형식 또는 크기가 올바르지 않아요.';
  end if;
  v_mode := p_schedule->>'mode';
  if v_mode not in ('shift','weekday') or v_mode is null then raise exception '근무 방식을 확인해 주세요.'; end if;
  if coalesce(p_schedule->>'baseDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception '기준 날짜를 확인해 주세요.'; end if;
  v_base := (p_schedule->>'baseDate')::date;
  if coalesce(p_schedule->>'shiftIndex','') !~ '^[0-9]{1,2}$' then raise exception '기준 근무 순서를 확인해 주세요.'; end if;
  v_index := (p_schedule->>'shiftIndex')::integer;
  v_cycle := p_schedule->'cycle';
  if coalesce(jsonb_typeof(v_cycle),'') <> 'array' then raise exception '근무 패턴을 확인해 주세요.'; end if;
  if jsonb_array_length(v_cycle) not between 1 and 60 then raise exception '근무 패턴을 확인해 주세요.'; end if;
  for v_item in select c.value from jsonb_array_elements_text(v_cycle) as c(value) loop
    if v_item not in ('주간','야간','비번','휴무','오후') then raise exception '지원하지 않는 근무 종류가 있어요.'; end if;
  end loop;
  if v_index >= jsonb_array_length(v_cycle) then raise exception '기준 근무 순서를 확인해 주세요.'; end if;
  v_overrides := coalesce(p_schedule->'overrides','{}'::jsonb);
  if jsonb_typeof(v_overrides) <> 'object' then raise exception '날짜별 근무 데이터가 올바르지 않아요.'; end if;
  for v_key, v_val in select o.key, o.value from jsonb_each_text(v_overrides) as o(key,value) loop
    if v_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or v_val not in ('주간','야간','비번','휴무','오후','연차','당직') then
      raise exception '날짜별 근무 데이터가 올바르지 않아요.';
    end if;
  end loop;
  -- 오직 근무 종류에 필요한 키만 저장. 개인 메모나 별도 개인정보는 서버에 전달하지 않음.
  insert into public.gm_calendar_snapshots(owner_id, schedule, updated_at)
    values(v_user,jsonb_build_object('mode',v_mode,'baseDate',v_base::text,'shiftIndex',v_index,'cycle',v_cycle,'overrides',v_overrides),now())
  on conflict(owner_id) do update set schedule=excluded.schedule,updated_at=now();
end $$;

create or replace function public.gm_calendar_set_access(p_friend_code text, p_allowed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_friend uuid;
begin
  if v_user is null then raise exception '로그인해 주세요.'; end if;
  select p.user_id into v_friend from public.gm_friend_profiles p
    where p.friend_code=upper(trim(coalesce(p_friend_code,'')));
  if v_friend is null or v_friend=v_user then raise exception '친구를 찾지 못했어요.'; end if;
  if not exists (
    select 1 from public.gm_friend_requests r where r.status='accepted'
    and ((r.sender_id=v_user and r.recipient_id=v_friend) or (r.sender_id=v_friend and r.recipient_id=v_user))
  ) then raise exception '친구 관계를 확인할 수 없어요.'; end if;
  if coalesce(p_allowed,false) then
    if not exists(select 1 from public.gm_calendar_snapshots s where s.owner_id=v_user) then
      raise exception '먼저 근무표를 저장해 주세요.';
    end if;
    insert into public.gm_calendar_grants(owner_id,viewer_id) values(v_user,v_friend)
      on conflict(owner_id,viewer_id) do nothing;
  else
    delete from public.gm_calendar_grants g where g.owner_id=v_user and g.viewer_id=v_friend;
  end if;
end $$;

create or replace function public.gm_calendar_access_status(p_friend_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_friend uuid;
begin
  if v_user is null then raise exception '로그인해 주세요.'; end if;
  select p.user_id into v_friend from public.gm_friend_profiles p
    where p.friend_code=upper(trim(coalesce(p_friend_code,'')));
  if v_friend is null or not exists (
    select 1 from public.gm_friend_requests r where r.status='accepted'
    and ((r.sender_id=v_user and r.recipient_id=v_friend) or (r.sender_id=v_friend and r.recipient_id=v_user))
  ) then raise exception '친구 관계를 확인할 수 없어요.'; end if;
  return jsonb_build_object(
    'i_share',exists(select 1 from public.gm_calendar_grants g where g.owner_id=v_user and g.viewer_id=v_friend),
    'they_share',exists(select 1 from public.gm_calendar_grants g where g.owner_id=v_friend and g.viewer_id=v_user),
    'they_have_schedule',exists(select 1 from public.gm_calendar_snapshots s where s.owner_id=v_friend)
  );
end $$;

create or replace function public.gm_calendar_shared_month(p_friend_code text, p_month text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_friend uuid;
  v_schedule jsonb;
  v_first date;
  v_date date;
  v_base date;
  v_cycle jsonb;
  v_index integer;
  v_count integer;
  v_shift text;
  v_days jsonb := '[]'::jsonb;
begin
  if v_user is null then raise exception '로그인해 주세요.'; end if;
  if coalesce(p_month,'') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception '조회 월이 올바르지 않아요.'; end if;
  v_first := make_date(substr(p_month,1,4)::integer,substr(p_month,6,2)::integer,1);
  select p.user_id into v_friend from public.gm_friend_profiles p where p.friend_code=upper(trim(coalesce(p_friend_code,'')));
  if v_friend is null or not exists (
    select 1 from public.gm_friend_requests r where r.status='accepted'
    and ((r.sender_id=v_user and r.recipient_id=v_friend) or (r.sender_id=v_friend and r.recipient_id=v_user))
  ) then raise exception '친구 관계를 확인할 수 없어요.'; end if;
  if not exists(select 1 from public.gm_calendar_grants g where g.owner_id=v_friend and g.viewer_id=v_user) then
    raise exception '상대방이 근무표 공유를 허용하지 않았어요.';
  end if;
  select s.schedule into v_schedule from public.gm_calendar_snapshots s where s.owner_id=v_friend;
  if v_schedule is null then raise exception '상대방의 근무표가 아직 저장되지 않았어요.'; end if;
  v_base := (v_schedule->>'baseDate')::date;
  v_index := (v_schedule->>'shiftIndex')::integer;
  v_cycle := v_schedule->'cycle';
  v_count := jsonb_array_length(v_cycle);
  for v_date in select series.work_day::date from generate_series(v_first::timestamp, (v_first + interval '1 month' - interval '1 day')::timestamp,interval '1 day') as series(work_day) loop
    v_shift := v_schedule->'overrides'->>to_char(v_date,'YYYY-MM-DD');
    if v_shift is null then
      if v_schedule->>'mode' = 'weekday' then
        v_shift := case when extract(dow from v_date)::integer in (0,6) then '휴무' else '주간' end;
      else
        v_shift := v_cycle->>(((v_date-v_base+v_index)%v_count+v_count)%v_count);
      end if;
    end if;
    v_days := v_days || jsonb_build_array(jsonb_build_object('date',to_char(v_date,'YYYY-MM-DD'),'shift',v_shift));
  end loop;
  return jsonb_build_object('days',v_days);
end $$;

-- 친구 삭제 후 같은 사용자를 다시 추가해도 예전 공유 권한이 자동 부활하지 않도록 정리.
create or replace function public.gm_calendar_revoke_on_unfriend()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op='DELETE' and old.status='accepted')
    or (tg_op='UPDATE' and old.status='accepted' and new.status<>'accepted') then
    delete from public.gm_calendar_grants g
      where (g.owner_id=old.sender_id and g.viewer_id=old.recipient_id)
         or (g.owner_id=old.recipient_id and g.viewer_id=old.sender_id);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists gm_calendar_revoke_unfriend on public.gm_friend_requests;
create trigger gm_calendar_revoke_unfriend
  after delete or update of status on public.gm_friend_requests
  for each row execute function public.gm_calendar_revoke_on_unfriend();

revoke all on function public.gm_calendar_publish(jsonb),
  public.gm_calendar_set_access(text,boolean),
  public.gm_calendar_access_status(text),
  public.gm_calendar_shared_month(text,text)
  from public,anon;
grant execute on function public.gm_calendar_publish(jsonb),
  public.gm_calendar_set_access(text,boolean),
  public.gm_calendar_access_status(text),
  public.gm_calendar_shared_month(text,text)
  to authenticated;
