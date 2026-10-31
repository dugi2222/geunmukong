-- 근무멍 v21: 온라인 친구 채팅. SQL Editor에서 프로젝트당 한 번 실행.
create table if not exists public.gm_chat_messages (
 id bigint generated always as identity primary key,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 1000),
 created_at timestamptz not null default now(),
 constraint gm_chat_not_self check (sender_id <> recipient_id)
);
create index if not exists gm_chat_messages_pair_idx on public.gm_chat_messages(sender_id,recipient_id,created_at desc);
alter table public.gm_chat_messages enable row level security;
revoke all on public.gm_chat_messages from anon, authenticated;

create or replace function public.gm_chat_send(friend_code text, message_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target uuid; new_id bigint;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 if char_length(trim(coalesce(message_body,''))) not between 1 and 1000 then raise exception '메시지는 1~1000자로 입력해 주세요.'; end if;
 select user_id into target from public.gm_friend_profiles where friend_code=upper(trim(coalesce(friend_code,'')));
 if target is null or target=uid then raise exception '친구를 찾지 못했어요.'; end if;
 if not exists (select 1 from public.gm_friend_requests r where r.status='accepted' and ((r.sender_id=uid and r.recipient_id=target) or (r.sender_id=target and r.recipient_id=uid))) then
  raise exception '친구 관계가 확인되지 않았어요.';
 end if;
 insert into public.gm_chat_messages(sender_id,recipient_id,body) values(uid,target,trim(message_body)) returning id into new_id;
 return new_id;
end $$;

create or replace function public.gm_chat_history(friend_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target uuid; result jsonb;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 select user_id into target from public.gm_friend_profiles where friend_code=upper(trim(coalesce(friend_code,'')));
 if target is null or target=uid then raise exception '친구를 찾지 못했어요.'; end if;
 if not exists (select 1 from public.gm_friend_requests r where r.status='accepted' and ((r.sender_id=uid and r.recipient_id=target) or (r.sender_id=target and r.recipient_id=uid))) then
  raise exception '친구 관계가 확인되지 않았어요.';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'from',case when q.sender_id=uid then 'me' else 'friend' end,'text',q.body,'time',q.created_at) order by q.id),'[]'::jsonb)
 into result from (select m.id,m.sender_id,m.body,m.created_at from public.gm_chat_messages m where (m.sender_id=uid and m.recipient_id=target) or (m.sender_id=target and m.recipient_id=uid) order by m.id desc limit 100) q;
 return result;
end $$;
revoke all on function public.gm_chat_send(text,text),public.gm_chat_history(text) from public,anon;
grant execute on function public.gm_chat_send(text,text),public.gm_chat_history(text) to authenticated;
