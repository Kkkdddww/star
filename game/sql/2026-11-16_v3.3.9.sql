-- v3.3.9 (2026-11-16). Supabase > SQL Editor 에서 한 번에 Run.
-- 1) 금칙어가 섞인 닉네임은 7일 제한 없이 바로 바꿀 수 있게 (v3.3.7 금칙어 함수 has_banned 사용, 없으면 예전처럼)
-- 2) 대항전 기수를 만든 사람(기수장)이 동기를 내보낼 수 있게

create or replace function nick_rules() returns trigger language plpgsql security definer set search_path = public as $$
declare bad_old boolean := false;
begin
  if tg_op = 'UPDATE' and new.nickname is not distinct from old.nickname then return new; end if;
  -- 업로드 때 쓰는 upsert는 먼저 INSERT로 들어와요: 이미 같은 이름으로 있는 내 프로필이면 통과 (예전부터 겹치던 이름 포함)
  if tg_op = 'INSERT' and exists (select 1 from profiles where id = new.id and nickname = new.nickname) then return new; end if;
  if exists (select 1 from profiles where id <> new.id and lower(replace(nickname, ' ', '')) = lower(replace(new.nickname, ' ', ''))) then
    raise exception 'nick_taken';
  end if;
  if tg_op = 'UPDATE' then
    if to_regprocedure('public.has_banned(text)') is not null then
      execute 'select public.has_banned($1)' into bad_old using old.nickname;
    end if;
    if not bad_old and old.nick_changed_at is not null and old.nick_changed_at > now() - interval '7 days' then raise exception 'nick_wait'; end if;
    new.nick_changed_at := now();
  end if;
  return new;
end $$;

-- 기수장 내보내기: 내 기수(cohorts.created_by = 나)의 다른 동기 줄을 지울 수 있음. 나 자신은 '나가기'로만
drop policy if exists "members kick by owner" on members;
create policy "members kick by owner" on members for delete using (
  user_id <> auth.uid() and exists (select 1 from cohorts c where c.id = members.cohort_id and c.created_by = auth.uid())
);
