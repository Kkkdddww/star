// 성장 규칙 (C안): 잠재력·나이가 기본 성장을, 보직·집중 육성이 방향을 정한다.
// 선택 이벤트 보상은 여기와 별개로 나이와 무관하게 바로 더해진다.
import { ageFactor, FITNESS_DECLINE_AGE, PATH_WEIGHTS, POTENTIAL, SOFT_CAP, STAT_MAX } from '../data/config';
import type { Rng } from './rng';
import { STAT_KEYS, type Assignment, type Branch, type Officer, type Path, type StatKey, type Stats } from './types';

export function overall(stats: Stats, path: Path): number {
  const w = PATH_WEIGHTS[path];
  return Math.round(STAT_KEYS.reduce((sum, k) => sum + stats[k] * w[k], 0));
}

/** 올해 기본 성장 총량: 잠재력 범위 × 나이 × 상한 근접 감속 */
export function growthPoints(me: Officer, rng: Rng): number {
  const p = POTENTIAL[me.hidden.potential];
  const base = rng.int(p.min, p.max) * ageFactor(me.age);
  const room = Math.max(0, Math.min(1, (p.cap - overall(me.stats, me.path)) / 10));
  return Math.max(0, Math.round(base * room));
}

/** 절반은 보직 능력치, 절반은 집중 육성. 35세부터 체력 −1(집중하지 않으면) */
export function distribute(me: Officer, points: number, assignmentStats: [StatKey, StatKey], focus: [StatKey, StatKey]): Partial<Stats> {
  const deltas: Partial<Stats> = {};
  const add = (k: StatKey, n: number) => (deltas[k] = (deltas[k] ?? 0) + n);
  const toAssignment = Math.ceil(points / 2);
  const toFocus = points - toAssignment;
  for (let i = 0; i < toAssignment; i++) add(assignmentStats[i % 2], 1);
  for (let i = 0; i < toFocus; i++) add(focus[i % 2], 1);
  // 80 이상인 능력치는 기본 성장이 절반만 붙는다 (한 능력치만 99로 키우기 어렵게)
  for (const k of STAT_KEYS) {
    const d = deltas[k];
    if (d && d > 0 && me.stats[k] >= SOFT_CAP) deltas[k] = Math.floor(d / 2);
  }
  if (me.age >= FITNESS_DECLINE_AGE && !focus.includes('fitness')) add('fitness', -1);
  for (const k of STAT_KEYS) {
    const d = deltas[k];
    if (d && me.stats[k] + d > STAT_MAX) deltas[k] = STAT_MAX - me.stats[k];
  }
  return deltas;
}

/** 병과-보직 궁합: 전투↔지휘, 행정↔행정력 보직, 기술↔전문성 보직 */
export function branchFits(branch: Branch, a: Assignment): boolean {
  if (branch === '전투') return a.kind === '지휘';
  if (branch === '행정') return a.kind !== '지휘' && a.grows.includes('admin');
  return a.kind !== '지휘' && a.grows.includes('expertise');
}

/** 능력치 직접 가감 (0~99) */
export function addStats(o: Officer, d: Partial<Stats> | undefined, into?: Partial<Stats>) {
  if (!d) return;
  for (const [k, v] of Object.entries(d)) {
    const key = k as StatKey;
    const next = Math.max(0, Math.min(STAT_MAX, o.stats[key] + v!));
    const real = next - o.stats[key];
    o.stats[key] = next;
    if (into && real) into[key] = (into[key] ?? 0) + real;
  }
}
