// 게임 진행: 새 게임 → (결재 2건 → 1년 보내기 → 진급 → 인사 → 지휘 방침) 반복. 화면 코드는 여기에 없다.
import { CHOICE_BY_ID } from '../data/choices';
import { ASSIGNMENTS, AUTO_PROMOTE, GENERAL_TERM, MIN_YEARS, PROMOTION, RANKS, REQUIRED_BILLET } from '../data/config';
import { buildDesk, npcPick, resolveChoice } from './choice';
import { overall } from './growth';
import { createCohort, createOfficer, npcFocus, stepOfficer } from './officer';
import { asg, assignmentsFor, isGeneral, needsReassign, runPersonnel } from './personnel';
import { rollBoss, startTerm, UNIT_KEYS, unitCard } from './term';
import { runReview, weakest } from './promotion';
import { createRng, type Rng } from './rng';
import { ro } from './text';
import { bossComment, gradeOf } from './yearEvents';
import type { Branch, DeskResult, GameState, Officer, Origin, Path, Policy, Potential, PromotionResult, Rank, StatKey, Stats, YearEvent, YearReport } from './types';

export interface NewGameOpts {
  name: string; origin: Origin; branch: Branch; path: Path; potential: Potential; seed: number;
  schoolPct: number; bonus: Partial<Stats>; year?: number;
  creation?: { rerolls: number; viewed: boolean };
  /** 오늘의 기수·우리 기수: 세상 시드(seed)는 모두 같고, 판정 주사위만 rollSeed로 */
  world?: { mode: 'daily' | 'cohort' | 'contest'; day?: string; week?: string; group?: { id: string; code: string; name: string }; rollSeed: number };
}
const rollOf = (s: GameState) => s.rollSeed ?? s.seed;

export function newGame(opts: NewGameOpts): GameState {
  const rng = createRng(opts.seed * 31 + 17);
  const me = createOfficer({ id: 'me', name: opts.name, origin: opts.origin, branch: opts.branch, path: opts.path, potential: opts.potential, schoolPct: opts.schoolPct, bonus: opts.bonus });
  const cohort = createCohort(rng, opts.name);
  // 라이벌: 졸업 석차가 가장 가까운 동기
  const rival = [...cohort].sort((a, b) => Math.abs(a.schoolPct - opts.schoolPct) - Math.abs(b.schoolPct - opts.schoolPct))[0];
  const n = rng.next() < 0.4 ? 1 : rng.next() < 0.67 ? 2 : 3;
  const years = new Set<number>();
  while (years.size < n) years.add(rng.int(4, 26));
  const year = opts.year ?? 2027;
  // 첫 보직(소대장)의 부대와 상관
  const roll = createRng((opts.world?.rollSeed ?? opts.seed) * 53 + 5);
  const u = unitCard(opts.seed, year, 'platoon');
  startTerm(me, u, rollBoss(u, roll), year);
  for (const o of cohort) { const k = roll.pick(UNIT_KEYS); startTerm(o, k, rollBoss(k, roll), year); }
  const state: GameState = {
    year, seed: opts.seed, me, cohort, rivalId: rival.id, history: [],
    desk: null, personnelDue: false, policyDue: false, personnel: [], majorYears: [...years].sort((a, b) => a - b),
    creation: opts.creation,
    ...(opts.world ? { mode: opts.world.mode, day: opts.world.day, week: opts.world.week, group: opts.world.group, rollSeed: opts.world.rollSeed } : {}),
  };
  return prepareDesk(state);
}

export const careerYear = (s: GameState) => s.history.length + 1;
export const rivalOf = (s: GameState) => s.cohort.find((o) => o.id === s.rivalId)!;

export function prepareDesk(s: GameState): GameState {
  if (s.ended || s.personnelDue || s.policyDue) return { ...s, desk: null };
  const rng = createRng(s.seed * 977 + s.year * 13);
  const items = buildDesk(s.me, s.year, s.majorYears.includes(careerYear(s)), rng);
  return { ...s, desk: { items, results: items.map(() => null) } };
}

/** 결재: 선택하자마자 결과가 나온다 */
export function decide(s: GameState, slot: number, key: string): GameState {
  if (!s.desk || s.desk.results[slot]) return s;
  const rng = createRng(rollOf(s) * 131 + s.year * 17 + slot * 7 + key.charCodeAt(0));
  const me = structuredClone(s.me);
  const it = s.desk.items[slot];
  const result = resolveChoice(me, it.defId, key, s.year, rng, it.v ?? 0);
  const results = [...s.desk.results];
  results[slot] = result;
  return { ...s, me, desk: { ...s.desk, results } };
}

function promote(o: Officer) {
  o.rank = RANKS[RANKS.indexOf(o.rank) + 1];
  o.yearsInRank = 0;
  o.evalsInRank = [];
  o.rankLog = { core: false, support: [] };
  o.reviewFails = 0;
  o.yearsInAssignment = 99; // 진급하면 보직 교체
  o.policy = undefined;
}

export function advanceYear(state: GameState, focus: [StatKey, StatKey]): { next: GameState; report: YearReport } {
  if (state.ended) throw new Error('이미 끝난 커리어예요');
  let s = state;
  // 결재를 안 했으면 첫 선택지(보통 원칙)로 처리 — 봇·안전장치용
  if (s.desk) s.desk.results.forEach((r, i) => { if (!r) s = decide(s, i, CHOICE_BY_ID[s.desk!.items[i].defId].options[0].key); });
  const myDesk = (s.desk?.results ?? []).filter(Boolean) as DeskResult[];

  const rng = createRng(rollOf(s) * 7919 + s.year);
  const me = structuredClone(s.me);
  const cohort = structuredClone(s.cohort);
  const everyone = [me, ...cohort];
  const notes: string[] = [];
  const records: string[] = [];
  const news: { text: string; weight: number }[] = [];
  const rivalId = s.rivalId;
  const tagName = (o: Officer) => `${o.id === rivalId ? '라이벌 ' : ''}${o.name}`;

  const rankAtStart = me.rank;
  const assignmentId = me.assignmentId;
  const bestBefore = me.log.bestEval;
  const step = stepOfficer(me, s.year, focus, myDesk, rng);
  for (const o of cohort) {
    if (!o.active) continue;
    const items = buildDesk(o, s.year, rng.next() < 0.04, rng);
    const desk = items.map((it) => resolveChoice(o, it.defId, npcPick(o, it.defId, rng), s.year, rng, it.v ?? 0));
    stepOfficer(o, s.year, npcFocus(o, rng), desk, rng);
    if (!o.active) news.push({ text: `${tagName(o)} · ${o.exitReason}`, weight: 2 + (o.id === rivalId ? 5 : 0) });
  }
  if ((step.deltas.fitness ?? 0) < 0 && me.age === 35) notes.push('체력이 조금씩 떨어지기 시작했어요');

  if (me.evals.length >= 3 && step.score > bestBefore) records.push(`개인 최고 평정 ${step.score}점`);
  me.log.bestEval = Math.max(bestBefore, step.score);
  if (me.log.suStreak >= 3) records.push(`평정 '탁월' ${me.log.suStreak}년 연속`);

  const events: YearEvent[] = [...step.events];
  const report: YearReport = {
    year: s.year, age: me.age, rank: rankAtStart, assignment: asg(assignmentId).name, assignmentId,
    growthPoints: step.points, deltas: step.deltas, overallBefore: step.overallBefore, overallAfter: overall(me.stats, me.path),
    events, evalScore: step.score, grade: gradeOf(step.score), comment: bossComment(step.events),
    branchFit: step.branchFit, cohortNews: [], records, notes,
  };

  for (const o of everyone) {
    if (!o.active) continue;
    o.age += 1; o.yearsInRank += 1; o.yearsInAssignment += 1;
  }
  for (const o of everyone) {
    if (o.active && AUTO_PROMOTE.includes(o.rank) && o.yearsInRank >= MIN_YEARS[o.rank]!) {
      promote(o);
      if (o === me) { notes.push(`${ro(o.rank)} 진급했어요`); report.promotedTo = o.rank; }
    }
  }

  for (const rank of Object.keys(PROMOTION) as Rank[]) {
    const r = runReview(rank, everyone, rng);
    if (!r) continue;
    const tries = PROMOTION[rank]!.tries;
    // 필수 보직을 못 거친 사람은 심사에서 빠지고 기회 한 번을 잃는다
    for (const o of r.excluded) {
      o.reviewFails += 1;
      const out = o.reviewFails >= tries;
      if (out) { o.active = false; o.exitReason = `${rank} 계급정년 전역`; }
      if (o === me) {
        events.push({ id: 'promotion', kind: 'milestone', title: `${r.to} 진급 심사 제외`, detail: `필수 보직(${REQUIRED_BILLET[rank]!.label})을 거치지 않아 심사를 받지 못했어요${out ? ' · 계급정년' : ` · 남은 기회 ${tries - o.reviewFails}번`}`, tag: '제외', evalEffect: 0, tone: 'bad', ends: out });
        notes.push(`${REQUIRED_BILLET[rank]!.label} 보직을 거쳐야 ${r.to} 심사를 받을 수 있어요. 다음 인사에서 꼭 지원하세요`);
      } else if (o.id === rivalId || out) news.push({ text: `${tagName(o)} · ${out ? `${rank} 계급정년 전역` : `${r.to} 심사 제외`}`, weight: o.id === rivalId ? 6 : 2 });
    }
    const already = everyone.some((o) => RANKS.indexOf(o.rank) >= RANKS.indexOf(r.to));
    const meCand = r.scored.find((c) => c.o === me);
    if (meCand) {
      const selected = r.selectedIds.has(me.id);
      const attempt = me.reviewFails + 1;
      const result: PromotionResult = {
        from: rank, to: r.to, attempt, tries, selected, score: meCand.score, cut: r.cut,
        candidates: r.scored.length + r.others, selectedCount: r.selectedIds.size + r.othersSelected, others: r.others, breakdown: meCand.breakdown, weakest: weakest(me),
        peers: r.scored.filter((c) => c.o !== me).map((c) => ({ name: c.o.name, origin: c.o.origin, selected: r.selectedIds.has(c.o.id), score: c.score, rival: c.o.id === rivalId })),
      };
      report.promotion = result;
      const lastTry = !selected && attempt >= tries;
      events.push({ id: 'promotion', kind: 'milestone', title: `${r.to} 진급 심사 (${attempt}차)`, detail: selected ? `대상 ${r.scored.length + r.others}명 중 ${r.selectedIds.size + r.othersSelected}명 선발` : lastTry ? `${attempt}차 낙천, 계급정년` : `낙천 · 내년에 ${attempt + 1}차 도전`, tag: selected ? '선발' : '낙천', evalEffect: 0, tone: selected ? 'good' : 'bad', ends: lastTry });
      if (selected) {
        if (attempt === 3) me.log.thirdTry = true;
        if (!already) { me.log.firstInCohort.push(r.to); records.push(`동기 중 처음으로 ${r.to} 진급`); }
      }
    }
    for (const c of r.scored) {
      const o = c.o;
      if (r.selectedIds.has(o.id)) {
        promote(o);
        if (o === me) report.promotedTo = o.rank;
        else news.push({ text: `${tagName(o)} · ${ro(r.to)} 진급`, weight: 3 + (o.id === rivalId ? 5 : 0) });
      } else {
        o.reviewFails += 1;
        if (o.reviewFails >= tries) {
          o.active = false;
          o.exitReason = `${rank} 계급정년 전역`;
          if (o !== me) news.push({ text: `${tagName(o)} · ${rank} 계급정년 전역`, weight: 2 + (o.id === rivalId ? 5 : 0) });
        } else if (o !== me && o.id === rivalId) {
          news.push({ text: `${tagName(o)} · ${r.to} ${o.reviewFails}차 낙천`, weight: 6 });
        }
      }
    }
  }

  for (const o of everyone) {
    if (o.active && o.rank === '대장' && o.yearsInRank >= GENERAL_TERM) {
      o.active = false;
      o.exitReason = '대장 임기를 마치고 명예 전역';
    }
  }

  report.cohortNews = news.map((n) => ({ ...n, r: n.weight + rng.next() })).sort((a, b) => b.r - a.r).slice(0, 3).map((n) => n.text);

  const ended = me.active ? undefined : { year: s.year, reason: me.exitReason ?? '전역', finalRank: me.rank };
  let next: GameState = { ...s, year: s.year + 1, me, cohort, history: [...s.history, report], desk: null, personnelDue: false, policyDue: false, ended };
  if (ended) return { next, report };

  // 인사: 내가 대상이고 고를 보직이 2개 이상이면 희망 조사부터. 아니면 바로 정기 인사
  if (needsReassign(me) && assignmentsFor(me.rank).length > 1) {
    next.personnelDue = true;
    return { next, report };
  }
  next = finishPersonnel(next, null, rng);
  return { next, report };
}

function finishPersonnel(s: GameState, wishes: [string, string] | null, rng: Rng): GameState {
  const me = s.me; // 이미 복사본
  const before = me.assignmentId;
  const res = runPersonnel([me, ...s.cohort], wishes, s.year, rng, s.seed);
  // 장성 보직에 새로 앉으면 지휘 방침
  for (const o of s.cohort) if (o.assignmentId && isGeneral(o.rank) && !o.policy) o.policy = rng.pick(['성과 우선', '장병 우선', '안전 우선'] as Policy[]);
  if (me.assignmentId !== before) me.policy = undefined;
  const policyDue = me.active && isGeneral(me.rank) && !me.policy;
  const out: GameState = { ...s, personnelDue: false, policyDue, personnel: res ? [...s.personnel, res] : s.personnel };
  return prepareDesk(out);
}

/** 희망 조사 제출 → 정기 인사 */
export function submitWishes(s: GameState, wishes: [string, string]): GameState {
  if (!s.personnelDue) return s;
  const rng = createRng(rollOf(s) * 4111 + s.year);
  const me = structuredClone(s.me);
  const cohort = structuredClone(s.cohort);
  return finishPersonnel({ ...s, me, cohort }, wishes, rng);
}

export function setPolicy(s: GameState, p: Policy): GameState {
  if (!s.policyDue) return s;
  return prepareDesk({ ...s, me: { ...s.me, policy: p }, policyDue: false });
}

export function retire(s: GameState): GameState {
  if (s.ended) return s;
  const me = { ...s.me, active: false, exitReason: '자진 전역' };
  return { ...s, me, desk: null, personnelDue: false, policyDue: false, ended: { year: s.year, reason: '자진 전역', finalRank: me.rank } };
}

/** 올해 예정된 일 */
export function upcoming(s: GameState): { promotion?: { to: Rank; attempt: number; tries: number }; longService?: number; education?: string; reassign?: boolean } {
  const me = s.me;
  const out: ReturnType<typeof upcoming> = {};
  const p = PROMOTION[me.rank];
  if (p && me.yearsInRank + 1 >= MIN_YEARS[me.rank]!) out.promotion = { to: RANKS[RANKS.indexOf(me.rank) + 1], attempt: me.reviewFails + 1, tries: p.tries };
  if (me.longService === 'pending' && me.rank === '중위' && me.yearsInRank === 1) out.longService = 1;
  if (me.longService === 'retry') out.longService = 2;
  if (me.rank === '대위' && me.yearsInRank === 0) out.education = '대위 보수교육';
  if (me.rank === '소령' && me.yearsInRank === 0) out.education = '상급 지휘참모과정';
  if (me.yearsInAssignment + 1 >= 2 && assignmentsFor(me.rank).length > 1) out.reassign = true;
  return out;
}

export { ASSIGNMENTS };
