-- 말뚝 v3.0 · 오늘의 기수 (Supabase > SQL Editor에 붙여넣고 Run, 한 번만)
alter table runs add column if not exists mode text not null default 'free';
alter table runs add column if not exists day date;
alter table runs add column if not exists honor int;

-- 오늘의 기수는 한 사람당 하루 한 번만
create unique index if not exists runs_daily_once on runs (user_id, day) where mode = 'daily';
create index if not exists runs_daily_rank on runs (day, rank_index desc, honor desc, years) where mode = 'daily';

-- 결재 선택 통계 (전역한 기수 기록에서 집계)
create or replace view daily_choice_stats with (security_invoker = true) as
select r.day,
       e->>'d' as def_id,
       e->>'k' as option_key,
       count(*)::int as n,
       avg(case when (e->>'ok')::boolean then 1 else 0 end)::float as ok
from runs r, jsonb_array_elements(r.choices->'log') e
where r.mode = 'daily' and e ? 'd' and e ? 'k'
group by 1, 2, 3;

grant select on daily_choice_stats to anon, authenticated;
