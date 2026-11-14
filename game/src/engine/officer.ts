// 장교 한 명 만들기 + 1년 보내기. 플레이어와 동기 NPC가 똑같이 이 함수를 쓴다.
import { ASSIGNMENTS, AWAKEN_AGE_LIMIT, AWAKEN_CHANCE, AWAKEN_MAX, BRANCH_BONUS, BRANCH_FIT_MULT, COHORT_SIZE, GIVEN_NAMES, NPC_BRANCH, NPC_PATH, NPC_POTENTIAL, ORIGIN, PERSONALITIES, PERSONALITY, POLICY, START_AGE, START_STATS, SURNAMES } from '../data/config';
import { rankGroup } from './choice';
import { addStats, branchFits, distribute, growthPoints, overall } from './growth';
import type { Rng } from './rng';
import { eul } from './text';
import { buildYearEvents, evalScore } from './yearEvents';
import { BOSSES, goalOf, termGrowth } from './term';
import { STAT_KEYS, type Branch, type DeskResult, type Officer, type Origin, type Path, type Personality, type Potential, type StatKey, type Stats, type YearEvent } from './types';

const NEXT_POTENTIAL: Record<Potential, Potential> = { C: 'B', B: 'A', A: 'S', S: 'S' };

export function weighted<T>(table: [T, number][], rng: Rng): T {
  let r = rng.next();
  for (const [v, w] of table) if ((r -= w) < 0) return v;
  return table[table.length - 1][0];
}
export const ORIGIN_TABLE = (Object.keys(ORIGIN) as Origin[]).map((o) => [o, ORIGIN[o].weight] as [Origin, number]);

export function createOfficer(o: { id: string; name: string; origin: Origin; branch: Branch; path: Path; potential: Potential; personality?: Personality; schoolPct?: number; bonus?: Partial<Stats> }): Officer {
  const stats: Stats = { ...START_STATS };
  for (const [k, v] of Object.entries(BRANCH_BONUS[o.branch])) stats[k as StatKey] += v!;
  for (const [k, v] of Object.entries(ORIGIN[o.origin].stats)) stats[k as StatKey] += v!;
  for (const [k, v] of Object.entries(o.bonus ?? {})) stats[k as StatKey] += v!;
  return {
    id: o.id, name: o.name, origin: o.origin, branch: o.branch, path: o.path, personality: o.personality ?? '성실파',
    rank: '소위', yearsInRank: 0, age: START_AGE, stats,
    hidden: { potential: o.potential, risk: 0 },
    assignmentId: 'platoon', yearsInAssignment: 0,
    active: true, evals: [], evalsInRank: [],
    rankLog: { core: false, support: [] }, merit: [], meritSeen: { a: 0, m: 0 }, billets: ['platoon'], tags: [],
    longService: ORIGIN[o.origin].longServiceExempt ? 'exempt' : 'pending',
    eduScore: 60, eduDone: 0, reviewFails: 0, awakenings: 0, eventLog: {}, chains: [],
    schoolPct: o.schoolPct ?? 50,
    log: { awards: [], majorAwards: 0, fitnessTop: 0, eduTop: 0, cleanCommand: 0, cleanCommandBest: 0, incidents: 0, principled: 0, hardWay: false, thirdTry: false, firstInCohort: [], bestEval: 0, suStreak: 0, suStreakBest: 0 },
  };
}

export function createCohort(rng: Rng, playerName: string): Officer[] {
  const used = new Set([playerName]);
  const list: Officer[] = [];
  for (let i = 0; i < COHORT_SIZE - 1; i++) {
    let name = '';
    do name = rng.pick(SURNAMES) + rng.pick(GIVEN_NAMES); while (used.has(name));
    used.add(name);
    const personality = rng.pick(PERSONALITIES);
    let potential = weighted(NPC_POTENTIAL, rng);
    if (personality === '대기만성' && potential === 'S') potential = 'B';
    const path: Path = personality === '야전파' ? '지휘관형' : personality === '엘리트' || personality === '처세가' ? '참모형' : weighted(NPC_PATH, rng);
    list.push(createOfficer({
      id: `npc${i}`, name, origin: weighted(ORIGIN_TABLE, rng), branch: weighted(NPC_BRANCH, rng),
      path, potential, personality, schoolPct: rng.int(1, 99),
    }));
  }
  return list;
}

export function npcFocus(o: Officer, rng: Rng): [StatKey, StatKey] {
  const pref = PERSONALITY[o.personality].focus;
  if (rng.next() < 0.6) return pref;
  const a = ASSIGNMENTS.find((x) => x.id === o.assignmentId)!;
  const first = rng.pick(a.grows);
  let second = rng.pick(STAT_KEYS);
  if (second === first) second = first === 'social' ? 'fitness' : 'social';
  return [first, second];
}

export interface StepResult {
  points: number;
  branchFit: boolean;
  deltas: Partial<Stats>;
  overallBefore: number;
  events: YearEvent[];
  score: number;
}

/** 성장 → 올해 있었던 일 → 평정. 결재 결과(desk)의 능력치 변화는 이미 반영돼 있다 */
export function stepOfficer(o: Officer, year: number, focus: [StatKey, StatKey], desk: DeskResult[], rng: Rng): StepResult {
  const a = ASSIGNMENTS.find((x) => x.id === o.assignmentId)!;
  const overallBefore = overall(o.stats, o.path);
  const fit = branchFits(o.branch, a);
  const points = Math.round(growthPoints(o, rng) * (fit ? BRANCH_FIT_MULT : 1) * termGrowth(o));
  const deltas = distribute(o, points, a.grows, focus);
  for (const k of STAT_KEYS) o.stats[k] += deltas[k] ?? 0;
  // 결재로 바뀐 능력치도 올해 변화에 보여준다
  for (const d of desk) for (const [k, v] of Object.entries(d.outcome.stats ?? {})) deltas[k as StatKey] = (deltas[k as StatKey] ?? 0) + v!;
  if (o.policy && POLICY[o.policy].social) addStats(o, { social: POLICY[o.policy].social }, deltas);
  if (o.term && BOSSES[o.term.boss].social) addStats(o, { social: BOSSES[o.term.boss].social }, deltas);

  const events = buildYearEvents(o, year, desk, rng);
  let score = evalScore(events);
  let goalHit = false, cleanYear = false;
  for (const e of events) if (e.kind !== 'choice') addStats(o, e.statBonus, deltas);

  // 임기 진행과 목표 판정 (임기 2년째 평정 때)
  const t = o.term;
  if (t && t.done === undefined) {
    t.years += 1;
    if (score >= 60) t.good += 1;
    if (score >= 75) t.top += 1;
    if (events[0]?.tag === '우수') t.work += 1;
    t.bad += events.filter((e) => e.kind === 'bad').length;
    if (t.years >= 2) {
      const g = goalOf(t);
      t.done = g.check(t);
      if (t.done) {
        score = Math.min(100, score + g.bonus);
        o.log.awards.push({ group: rankGroup(o.rank) });
        goalHit = true;
        events.push({ id: 'term_goal', kind: 'good', title: '임기 목표 달성', detail: `${g.text} · 평정 +${g.bonus}, 표창`, tag: '달성', evalEffect: g.bonus, tone: 'good' });
      } else {
        events.push({ id: 'term_goal', kind: 'milestone', title: '임기 목표 미달', detail: g.text, tag: '미달', evalEffect: 0, tone: 'neutral' });
      }
    }
  }

  o.evals.push(score);
  o.evalsInRank.push(score);
  if (a.kind === '지휘' || a.kind === '요직') o.rankLog.core = true;
  else if (!o.rankLog.support.includes(a.id)) o.rankLog.support.push(a.id);

  const group = rankGroup(o.rank);
  let badThisYear = false;
  for (const e of events) {
    if (e.kind === 'bad' || e.kind === 'good') o.eventLog[e.id] = year;
    if (e.tone === 'bad' && e.kind !== 'work' && e.kind !== 'milestone') badThisYear = true;
    if (e.edu !== undefined) { o.eduScore = e.edu; o.eduDone += 1; if (e.tag === '수석') o.log.eduTop += 1; }
    if (e.id === 'award') o.log.awards.push({ group });
    if (e.id === 'award_major') o.log.majorAwards += 1;
    if (e.id === 'fitness_top') o.log.fitnessTop += 1;
    if (e.id === 'risk_audit') o.hidden.risk = Math.max(0, o.hidden.risk - 1);
    if (e.longService) o.longService = e.longService;
    if (e.ends) { o.active = false; o.exitReason = e.detail; }
  }
  if (a.kind === '지휘') {
    o.log.cleanCommand = badThisYear ? 0 : o.log.cleanCommand + 1;
    cleanYear = !badThisYear;
    o.log.cleanCommandBest = Math.max(o.log.cleanCommandBest, o.log.cleanCommand);
  }
  // v3.3.4 공적 기록: 올해 새로 받은 표창(임기 목표 표창 포함)·큰 표창·무사고 지휘·임기 목표
  const seen = o.meritSeen ?? { a: o.log.awards.length - (goalHit ? 1 : 0), m: o.log.majorAwards }; // 옛 저장: 지난 공적은 0으로 시작
  (o.merit ??= []).push({ a: o.log.awards.length - seen.a - (goalHit ? 1 : 0), m: o.log.majorAwards - seen.m, c: cleanYear ? 1 : 0, g: goalHit ? 1 : 0 });
  o.meritSeen = { a: o.log.awards.length, m: o.log.majorAwards };
  if (score >= 75) { o.log.suStreak += 1; o.log.suStreakBest = Math.max(o.log.suStreakBest, o.log.suStreak); } else o.log.suStreak = 0;

  // 잠재력 각성
  const trigger =
    events.some((e) => e.id === 'education' && (e.tag === '우등' || e.tag === '수석')) ? '교육 우등 수료'
    : events.some((e) => e.id === 'award_major') || desk.some((d) => d.outcome.award === '큰 표창') ? '큰 표창'
    : o.evals.length >= 2 && o.evals[o.evals.length - 1] >= 75 && o.evals[o.evals.length - 2] >= 75 ? "평정 '탁월' 2년 연속"
    : o.evals.length >= 3 && score >= 62 && score > Math.max(...o.evals.slice(0, -1)) ? '개인 최고 평정'
    : null;
  const pot = o.hidden.potential;
  const chance = AWAKEN_CHANCE[pot] * (o.personality === '대기만성' ? 2 : 1);
  if (o.active && trigger && pot !== 'S' && o.awakenings < AWAKEN_MAX && o.age < AWAKEN_AGE_LIMIT && rng.next() < chance) {
    o.hidden.potential = NEXT_POTENTIAL[pot];
    o.awakenings++;
    events.push({ id: 'awaken', kind: 'good', title: '전환점이 찾아왔어요', detail: `${eul(trigger)} 계기로 자신감이 붙었어요 · 앞으로 더 잘 클 것 같아요`, tag: '각성', evalEffect: 0, tone: 'good' });
  }
  return { points, branchFit: fit, deltas, overallBefore, events, score };
}
