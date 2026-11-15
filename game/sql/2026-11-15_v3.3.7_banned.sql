-- v3.3.7 금칙어 (2026-11-15). Supabase > SQL Editor 에서 한 번에 Run.
-- 앱 목록(game/src/data/banned.ts)과 같은 단어를 서버 표에 두고, 닉네임 · 한마디 · 기수 이름을 저장할 때 검사한다.
-- 이미 저장된 글은 바꾸지 않는다 (새로 쓰거나 바꿀 때만 검사). 단어 추가: insert into banned_words values ('단어');

create table if not exists banned_words (word text primary key);
alter table banned_words enable row level security;  -- 정책 없음 = 앱에서는 못 읽고 못 씀 (함수만 씀)
insert into banned_words (word) values
  ('시발'),
  ('씨발'),
  ('씨빨'),
  ('시빨'),
  ('씨팔'),
  ('시팔'),
  ('쓰발'),
  ('쓰벌'),
  ('씨벌'),
  ('시벌'),
  ('씨바'),
  ('씌발'),
  ('싀발'),
  ('ㅅㅂ'),
  ('ㅆㅂ'),
  ('ㅅㅃ'),
  ('병신'),
  ('븅신'),
  ('빙신'),
  ('븽신'),
  ('ㅂㅅ'),
  ('좆'),
  ('존나'),
  ('졸라'),
  ('ㅈㄴ'),
  ('ㅈ같'),
  ('개새'),
  ('개색'),
  ('개세끼'),
  ('개쉐'),
  ('새끼'),
  ('쌔끼'),
  ('섀끼'),
  ('니미럴'),
  ('니미씨'),
  ('느금'),
  ('느개미'),
  ('니애미'),
  ('니에미'),
  ('니엄마'),
  ('애미'),
  ('애비'),
  ('엠창'),
  ('썅'),
  ('쌍놈'),
  ('쌍년'),
  ('미친년'),
  ('미친놈'),
  ('미친새'),
  ('지랄'),
  ('ㅈㄹ'),
  ('염병'),
  ('엿먹'),
  ('등신'),
  ('호로새'),
  ('호로자식'),
  ('후레자식'),
  ('개같'),
  ('개년'),
  ('개놈'),
  ('걸레'),
  ('창녀'),
  ('창놈'),
  ('화냥'),
  ('좇'),
  ('빠가'),
  ('섹스'),
  ('쎅스'),
  ('보지'),
  ('자지'),
  ('잠지'),
  ('딸딸이'),
  ('자위'),
  ('오르가즘'),
  ('야동'),
  ('포르노'),
  ('정액'),
  ('강간'),
  ('성폭'),
  ('몰카'),
  ('질싸'),
  ('빨통'),
  ('젖탱'),
  ('꼴리'),
  ('떡치'),
  ('스와핑'),
  ('조건만남'),
  ('원나잇'),
  ('한남'),
  ('김치녀'),
  ('된장녀'),
  ('맘충'),
  ('한녀'),
  ('보슬아치'),
  ('보빨'),
  ('메갈'),
  ('워마드'),
  ('일베'),
  ('애자'),
  ('홍어'),
  ('전라디언'),
  ('짱깨'),
  ('쪽바리'),
  ('깜둥'),
  ('똥남아'),
  ('틀딱'),
  ('급식충'),
  ('흑형'),
  ('장애새'),
  ('운지'),
  ('노무노무'),
  ('슨상'),
  ('이기야'),
  ('재기해'),
  ('부엉이바위'),
  ('윤석열'),
  ('이재명'),
  ('문재인'),
  ('박근혜'),
  ('이명박'),
  ('노무현'),
  ('김대중'),
  ('전두환'),
  ('노태우'),
  ('박정희'),
  ('김정은'),
  ('김정일'),
  ('김일성'),
  ('히틀러'),
  ('김여정'),
  ('fuck'),
  ('fuk'),
  ('shit'),
  ('bitch'),
  ('porn'),
  ('dick'),
  ('pussy'),
  ('asshole'),
  ('nigg'),
  ('slut'),
  ('whore'),
  ('sex'),
  ('cunt')
on conflict do nothing;

-- 공백 · 기호를 지운 글자, 숫자까지 지운 글자 두 가지로 비교 ("시 1 발" → "시발")
create or replace function has_banned(t text) returns boolean
language sql stable security definer set search_path = public as $$
  with n as (select lower(regexp_replace(coalesce(t, ''), '[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]', '', 'g')) as a)
  select exists (
    select 1 from banned_words b, n
    where strpos(n.a, b.word) > 0 or strpos(regexp_replace(n.a, '[0-9]', '', 'g'), b.word) > 0
  );
$$;

create or replace function check_banned() returns trigger
language plpgsql as $$
declare v text; c text;
begin
  foreach c in array tg_argv loop
    execute format('select ($1).%I::text', c) using new into v;
    if v is not null and (tg_op = 'INSERT' or v is distinct from (select (to_jsonb(old) ->> c))) and has_banned(v) then
      raise exception 'nick_banned';
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists banned_profiles on profiles;
create trigger banned_profiles before insert or update of nickname on profiles for each row execute function check_banned('nickname');
drop trigger if exists banned_runs on runs;
create trigger banned_runs before insert on runs for each row execute function check_banned('nickname');
drop trigger if exists banned_guestbook on guestbook;
create trigger banned_guestbook before insert on guestbook for each row execute function check_banned('nickname', 'body');
drop trigger if exists banned_cohorts on cohorts;
create trigger banned_cohorts before insert or update of name, motto on cohorts for each row execute function check_banned('name', 'motto');


-- ▼ 확인용 (따로 Run): 이미 쓰고 있는 닉네임 중 금칙어가 섞인 것
-- select id, nickname, serial, created_at from profiles where has_banned(nickname) order by created_at desc;

-- ▼ 확인용 (따로 Run): profiles · runs · guestbook 에 걸린 규칙 전부 (내가 따로 넣은 것이 있는지)
-- select conrelid::regclass as 표, conname as 이름, pg_get_constraintdef(oid) as 규칙 from pg_constraint where conrelid in ('profiles'::regclass, 'runs'::regclass, 'guestbook'::regclass, 'cohorts'::regclass) and contype = 'c';
-- select event_object_table as 표, trigger_name as 트리거, action_statement from information_schema.triggers where event_object_table in ('profiles', 'runs', 'guestbook', 'cohorts') order by 1, 2;
