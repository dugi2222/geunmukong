-- 근무멍 23단계: Supabase SQL Editor에서 전체 실행 (프로젝트당 한 번)
-- 친구 데이터는 인증 사용자만 RPC로 접근합니다. 코드 검색은 정확히 일치해야 합니다.
create table if not exists public.gm_friend_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  friend_code text not null unique default ('GM-' || upper(substr(md5(gen_random_uuid()::text),1,10))),
  created_at timestamptz not null default now()
);
create table if not exists public.gm_friend_requests (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gm_not_self check(sender_id <> recipient_id),
  constraint gm_pair_unique unique(sender_id,recipient_id)
);
alter table public.gm_friend_profiles enable row level security;
alter table public.gm_friend_requests enable row level security;
revoke all on public.gm_friend_profiles, public.gm_friend_requests from anon, authenticated;

create or replace function public.gm_ensure_profile()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); nick text;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 nick := left(trim(coalesce((select raw_user_meta_data->>'nickname' from auth.users where id=uid),'친구')),24);
 if char_length(nick)<2 then nick := '근무멍 친구'; end if;
 insert into public.gm_friend_profiles(user_id,nickname) values(uid,nick) on conflict(user_id) do nothing;
end $$;
create or replace function public.gm_friend_overview()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); result jsonb;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 perform public.gm_ensure_profile();
 select jsonb_build_object(
  'me',(select jsonb_build_object('nickname',p.nickname,'code',p.friend_code) from public.gm_friend_profiles p where p.user_id=uid),
  'incoming',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nickname',p.nickname,'code',p.friend_code,'created_at',r.created_at) order by r.created_at desc) from public.gm_friend_requests r join public.gm_friend_profiles p on p.user_id=r.sender_id where r.recipient_id=uid and r.status='pending'),'[]'::jsonb),
  'outgoing',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nickname',p.nickname,'created_at',r.created_at) order by r.created_at desc) from public.gm_friend_requests r join public.gm_friend_profiles p on p.user_id=r.recipient_id where r.sender_id=uid and r.status='pending'),'[]'::jsonb),
  'friends',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nickname',p.nickname,'code',p.friend_code) order by p.nickname) from public.gm_friend_requests r join public.gm_friend_profiles p on p.user_id=case when r.sender_id=uid then r.recipient_id else r.sender_id end where (r.sender_id=uid or r.recipient_id=uid) and r.status='accepted'),'[]'::jsonb)
 ) into result;
 return result;
end $$;
create or replace function public.gm_friend_set_nickname(new_nickname text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 if char_length(trim(coalesce(new_nickname,''))) not between 2 and 24 then raise exception '닉네임은 2~24자로 입력해 주세요.'; end if;
 perform public.gm_ensure_profile();
 update public.gm_friend_profiles set nickname=trim(new_nickname) where user_id=auth.uid();
end $$;
create or replace function public.gm_friend_send(code_input text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target uuid; existing public.gm_friend_requests%rowtype;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 perform public.gm_ensure_profile();
 select user_id into target from public.gm_friend_profiles where friend_code=upper(trim(coalesce(code_input,'')));
 if target is null then raise exception '일치하는 친구 코드를 찾지 못했어요.'; end if;
 if target=uid then raise exception '자기 자신에게는 요청할 수 없어요.'; end if;
 select * into existing from public.gm_friend_requests where (sender_id=uid and recipient_id=target) or (sender_id=target and recipient_id=uid) order by id desc limit 1;
 if found then
  if existing.status='accepted' then raise exception '이미 친구예요.'; end if;
  if existing.status='pending' then raise exception '이미 대기 중인 친구 요청이 있어요.'; end if;
  delete from public.gm_friend_requests where id=existing.id;
 end if;
 insert into public.gm_friend_requests(sender_id,recipient_id) values(uid,target);
end $$;
create or replace function public.gm_friend_respond(request_id bigint, accept_request boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 update public.gm_friend_requests set status=case when accept_request then 'accepted' else 'rejected' end,updated_at=now()
 where id=request_id and recipient_id=auth.uid() and status='pending';
 if not found then raise exception '처리할 수 없는 친구 요청이에요.'; end if;
end $$;
create or replace function public.gm_friend_remove(request_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 delete from public.gm_friend_requests where id=request_id and (sender_id=auth.uid() or recipient_id=auth.uid());
 if not found then raise exception '삭제할 수 없는 친구 관계예요.'; end if;
end $$;
revoke all on function public.gm_ensure_profile(),public.gm_friend_overview(),public.gm_friend_set_nickname(text),public.gm_friend_send(text),public.gm_friend_respond(bigint,boolean),public.gm_friend_remove(bigint) from public,anon;
grant execute on function public.gm_ensure_profile(),public.gm_friend_overview(),public.gm_friend_set_nickname(text),public.gm_friend_send(text),public.gm_friend_respond(bigint,boolean),public.gm_friend_remove(bigint) to authenticated;
