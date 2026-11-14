-- 말뚝 v3.3.2 · 개발자 답글 화면 (Supabase > SQL Editor에 붙여넣고 Run)
-- ① 관리자 표 + 권한 (한 번만)
create table if not exists admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table admins enable row level security;
drop policy if exists "admins read self" on admins;
create policy "admins read self" on admins for select using (auth.uid() = user_id);
grant select on admins to authenticated;

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
grant execute on function is_admin() to anon, authenticated;

-- 관리자만: 한마디 답글 쓰기 · 고치기, 가려진 글 보기 · 다시 보이기
drop policy if exists "gb admin read" on guestbook;
create policy "gb admin read" on guestbook for select using (is_admin());
drop policy if exists "gb admin update" on guestbook;
create policy "gb admin update" on guestbook for update using (is_admin()) with check (is_admin());
grant update (reply, hidden) on guestbook to authenticated;

-- ② 나를 관리자로 등록 (한 번만)
-- 앱에서 구글이나 카카오로 로그인한 그 계정의 이메일을 아래 따옴표 안에 넣고 Run
-- (이 줄은 Supabase 화면에서만 쓰고, 저장소 파일에는 이메일을 넣지 마세요)
insert into admins (user_id)
select id from auth.users where email = '여기에_로그인한_계정_이메일'
on conflict do nothing;

-- 확인: 1이 나오면 등록 완료
select count(*) as 관리자_수 from admins;
