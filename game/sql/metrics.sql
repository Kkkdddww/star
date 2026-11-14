-- 말뚝 주요 지표 (Supabase > SQL Editor). 읽기만 하고 아무것도 바꾸지 않아요.
-- 필요한 블록 하나만 골라서 붙여넣고 Run. 날짜는 모두 한국 시간.
-- "활동"은 판을 끝내고 랭킹에 올린 기록 기준이에요 (구경만 한 방문자는 GA에서 봐요)
-- 서버 부담을 줄이려고 대부분 최근 14일만 봐요.


-- ① 날짜별 활동: 올린 판 수 · 사람 수 · 모드별
select (created_at at time zone 'Asia/Seoul')::date as 날짜,
       count(*) as 판,
       count(distinct user_id) as 사람,
       count(*) filter (where mode = 'free') as 자유,
       count(*) filter (where mode = 'daily') as 오늘의기수,
       count(*) filter (where mode = 'contest') as 대항전,
       count(*) filter (where mode = 'cohort') as 친선기수
from runs
where created_at > now() - interval '14 days'
group by 1 order by 1 desc;


-- ② 신규 vs 다시 온 사람 (그날 처음 판을 올린 사람 = 신규)
with first as (select user_id, min(created_at at time zone 'Asia/Seoul')::date as d0 from runs group by user_id),
     act as (select distinct user_id, (created_at at time zone 'Asia/Seoul')::date as d from runs where created_at > now() - interval '14 days')
select a.d as 날짜,
       count(*) filter (where f.d0 = a.d) as 신규,
       count(*) filter (where f.d0 < a.d) as 다시온사람,
       count(*) as 합계
from act a join first f using (user_id)
group by 1 order by 1 desc;


-- ③ 다음 날 다시 온 비율 (D1): 그날 처음 온 사람 중 다음 날에도 판을 올린 사람
with first as (select user_id, min(created_at at time zone 'Asia/Seoul')::date as d0 from runs group by user_id),
     days as (select distinct user_id, (created_at at time zone 'Asia/Seoul')::date as d from runs)
select f.d0 as 첫날,
       count(*) as 신규,
       count(*) filter (where exists (select 1 from days x where x.user_id = f.user_id and x.d = f.d0 + 1)) as 다음날옴,
       round(100.0 * count(*) filter (where exists (select 1 from days x where x.user_id = f.user_id and x.d = f.d0 + 1)) / count(*), 1) as "D1(%)"
from first f
where f.d0 > (now() at time zone 'Asia/Seoul')::date - 14 and f.d0 < (now() at time zone 'Asia/Seoul')::date
group by 1 order by 1 desc;


-- ④ 계급 분포 (최근 7일, 모드별) · 밸런스 목표: 준장+ 약 8~10%, 중장+ 약 1~1.5%, 대장 약 0.4%
select mode as 모드, count(*) as 판,
       round(100.0 * count(*) filter (where rank_index >= 5) / count(*), 1) as "대령+(%)",
       round(100.0 * count(*) filter (where rank_index >= 6) / count(*), 1) as "준장+(%)",
       round(100.0 * count(*) filter (where rank_index >= 8) / count(*), 2) as "중장+(%)",
       round(100.0 * count(*) filter (where rank_index = 9) / count(*), 2) as "대장(%)"
from runs
where created_at > now() - interval '7 days'
group by 1 order by 2 desc;


-- ⑤ 오늘의 기수: 날짜별 참가 · 장군 수 · 1위 점수
select day as 날짜, count(*) as 참가,
       count(*) filter (where rank_index >= 6) as 장군,
       max(rank_index * 100 + coalesce(honor, 0)) as 최고점
from runs
where mode = 'daily' and day > (now() at time zone 'Asia/Seoul')::date - 14
group by 1 order by 1 desc;


-- ⑥ 로그인: 연결한 사람 수와 비율
select
  (select count(*) from auth.identities where provider = 'kakao') as 카카오,
  (select count(*) from auth.identities where provider = 'google') as 구글,
  (select count(*) from auth.users where not is_anonymous) as 로그인계정,
  (select count(*) from auth.users) as 전체계정,
  round(100.0 * (select count(*) from auth.users where not is_anonymous) / nullif((select count(*) from auth.users), 0), 1) as "로그인비율(%)";


-- ⑦ 대항전: 기수 수 · 기수원 수 · 이번 주 출전
select
  (select count(*) from cohorts where kind = 'contest') as 대항전기수,
  (select count(*) from members) as 기수원,
  (select count(distinct user_id) from members) as 기수에든사람,
  (select count(*) from runs where mode = 'contest' and week = date_trunc('week', now() at time zone 'Asia/Seoul')::date) as 이번주출전;

-- ⑦-2 기수별 인원 · 이번 주 순위 (많은 순)
select c.no as 기수번호, c.name as 이름, c.public as 공개,
       (select count(*) from members m where m.cohort_id = c.id) as 동기,
       b.n as 이번주전역, b.score as 팀점수, b.place as 순위
from cohorts c
left join contest_results b on b.cohort_id = c.id and b.week = date_trunc('week', now() at time zone 'Asia/Seoul')::date
where c.kind = 'contest'
order by 4 desc limit 30;


-- ⑧ 호봉 분포 (저장된 경험치 기준, 200 + 15×(n−1)씩 필요)
select case when xp < 200 then '1호봉'
            when xp < 1000 then '2~5호봉'
            when xp < 3000 then '6~12호봉'
            when xp < 6000 then '13~20호봉'
            else '21호봉+' end as 호봉,
       count(*) as 사람
from profiles where runs_n > 0
group by 1 order by min(xp);


-- ⑨ 한마디: 답글 안 달린 글 · 신고 쌓인 글
select id, (created_at at time zone 'Asia/Seoul')::timestamp(0) as 시간, nickname as 닉네임, body as 내용, reports as 신고, hidden as 가려짐
from guestbook
where reply is null
order by created_at desc limit 30;
