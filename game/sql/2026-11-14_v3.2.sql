-- 말뚝 v3.2 · Supabase SQL Editor에서 Run
-- 닉네임 사칭 막기: 개발자·운영자·관리자·GM 등은 새로 저장할 수 없음
-- (not valid: 이미 있는 기록은 검사하지 않고, 새로 쓰는 것만 막음. 앱 nicknameProblem과 같은 규칙)

alter table profiles drop constraint if exists nick_no_staff;
alter table profiles add constraint nick_no_staff check (
  replace(nickname, ' ', '') !~* '(개발자|운영자|운영진|운영팀|관리자|인사과장|동우캉|admin|(^|[^a-z])gm($|[^a-z]))'
) not valid;

alter table runs drop constraint if exists nick_no_staff;
alter table runs add constraint nick_no_staff check (
  replace(nickname, ' ', '') !~* '(개발자|운영자|운영진|운영팀|관리자|인사과장|동우캉|admin|(^|[^a-z])gm($|[^a-z]))'
) not valid;

alter table guestbook drop constraint if exists nick_no_staff;
alter table guestbook add constraint nick_no_staff check (
  replace(nickname, ' ', '') !~* '(개발자|운영자|운영진|운영팀|관리자|인사과장|동우캉|admin|(^|[^a-z])gm($|[^a-z]))'
) not valid;
