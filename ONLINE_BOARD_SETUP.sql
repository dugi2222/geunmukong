-- 근무멍 v22 온라인 게시판. Supabase SQL Editor에서 한 번 실행하세요.
-- 기존 로컬 게시글은 삭제하지 않습니다. 온라인 게시판에 자동 업로드하지 않습니다.
create table if not exists public.gm_board_posts (
 id bigint generated always as identity primary key,
 author_id uuid not null references auth.users(id) on delete cascade,
 category text not null check (category in ('자유','근무 이야기','건의사항','친구 전용')),
 title text not null check (char_length(title) between 1 and 70),
 body text not null check (char_length(body) between 1 and 3000),
 anonymous boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists gm_board_posts_category_time_idx on public.gm_board_posts(category,created_at desc);
create table if not exists public.gm_board_comments (
 id bigint generated always as identity primary key,
 post_id bigint not null references public.gm_board_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 300),
 anonymous boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists gm_board_comments_post_idx on public.gm_board_comments(post_id,created_at);
alter table public.gm_board_posts enable row level security;
alter table public.gm_board_comments enable row level security;
revoke all on public.gm_board_posts, public.gm_board_comments from anon,authenticated;

-- 친구 관계 확인은 서버에서 수행합니다. 친구 전용 글은 작성자 및 수락된 친구만 접근합니다.
create or replace function public.gm_board_can_view(p_author uuid,p_category text)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and (
 p_category <> '친구 전용' or p_author=auth.uid() or exists (
  select 1 from public.gm_friend_requests as r
  where r.status='accepted' and (
   (r.sender_id=auth.uid() and r.recipient_id=p_author) or
   (r.recipient_id=auth.uid() and r.sender_id=p_author)
  )
 ) );
$$;

create or replace function public.gm_board_list(p_category text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 if p_category not in ('자유','근무 이야기','건의사항','친구 전용') then raise exception '게시판이 올바르지 않습니다.'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) into v_result
 from (
  select p.id,p.category,p.title,p.created_at,p.anonymous,
    case when p.anonymous then '익명' else coalesce(fp.nickname,'사용자') end as author,
    p.author_id=auth.uid() as mine,
    (select count(*) from public.gm_board_comments c where c.post_id=p.id)::integer as comment_count
  from public.gm_board_posts p
  left join public.gm_friend_profiles fp on fp.user_id=p.author_id
  where p.category=p_category and public.gm_board_can_view(p.author_id,p.category)
  order by p.created_at desc limit 100
 ) t;
 return v_result;
end $$;

create or replace function public.gm_board_detail(p_post_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_post jsonb;v_comments jsonb;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 select jsonb_build_object('id',p.id,'category',p.category,'title',p.title,'body',p.body,
  'created_at',p.created_at,'anonymous',p.anonymous,'author',case when p.anonymous then '익명' else coalesce(fp.nickname,'사용자') end,
  'mine',p.author_id=auth.uid()) into v_post
 from public.gm_board_posts p left join public.gm_friend_profiles fp on fp.user_id=p.author_id
 where p.id=p_post_id and public.gm_board_can_view(p.author_id,p.category);
 if v_post is null then raise exception '게시글이 없거나 접근할 수 없습니다.'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at),'[]'::jsonb) into v_comments from (
  select c.id,c.body,c.created_at,c.anonymous,c.author_id=auth.uid() as mine,
   case when c.anonymous then '익명' else coalesce(fp.nickname,'사용자') end as author
  from public.gm_board_comments c left join public.gm_friend_profiles fp on fp.user_id=c.author_id
  where c.post_id=p_post_id order by c.created_at limit 200
 ) t;
 return v_post || jsonb_build_object('comments',v_comments);
end $$;

create or replace function public.gm_board_create(p_category text,p_title text,p_body text,p_anonymous boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 if p_category is null or p_category not in ('자유','근무 이야기','건의사항','친구 전용') then raise exception '게시판이 올바르지 않습니다.'; end if;
 if char_length(trim(coalesce(p_title,''))) not between 1 and 70 or char_length(trim(coalesce(p_body,''))) not between 1 and 3000 then raise exception '제목 또는 본문 길이를 확인해 주세요.'; end if;
 insert into public.gm_board_posts(author_id,category,title,body,anonymous)
 values(auth.uid(),p_category,trim(p_title),trim(p_body),coalesce(p_anonymous,false)) returning id into v_id;
 return v_id;
end $$;

create or replace function public.gm_board_comment(p_post_id bigint,p_body text,p_anonymous boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 if not exists(select 1 from public.gm_board_posts p where p.id=p_post_id and public.gm_board_can_view(p.author_id,p.category)) then raise exception '게시글에 접근할 수 없습니다.'; end if;
 if char_length(trim(coalesce(p_body,''))) not between 1 and 300 then raise exception '댓글은 1~300자로 입력해 주세요.'; end if;
 insert into public.gm_board_comments(post_id,author_id,body,anonymous) values(p_post_id,auth.uid(),trim(p_body),coalesce(p_anonymous,false)) returning id into v_id;
 return v_id;
end $$;

create or replace function public.gm_board_delete(p_post_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 delete from public.gm_board_posts where id=p_post_id and author_id=auth.uid();
 return found;
end $$;

create or replace function public.gm_board_comment_delete(p_comment_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 delete from public.gm_board_comments where id=p_comment_id and author_id=auth.uid();
 return found;
end $$;
revoke all on function public.gm_board_can_view(uuid,text), public.gm_board_list(text), public.gm_board_detail(bigint),public.gm_board_create(text,text,text,boolean),public.gm_board_comment(bigint,text,boolean),public.gm_board_delete(bigint),public.gm_board_comment_delete(bigint) from public,anon;
grant execute on function public.gm_board_can_view(uuid,text), public.gm_board_list(text), public.gm_board_detail(bigint),public.gm_board_create(text,text,text,boolean),public.gm_board_comment(bigint,text,boolean),public.gm_board_delete(bigint),public.gm_board_comment_delete(bigint) to authenticated;
