// 인사 v3: 부대 상황 카드 + 상관 유형 + 임기 목표.
// 카드는 희망 조사 때 보이고(세상 시드), 상관은 인사 발표 때 공개된다(판정 주사위).
import { createRng, type Rng } from './rng';
import { RANKS } from '../data/config';
import type { BossType, Officer, Rank, Style, Term, UnitTrait } from './types';

export interface UnitDef {
  name: string; short: string; desc: string;
  /** 성장 배율, 업무 평정 가감, 업무 흔들림(±), 나쁜 일·좋은 일 확률 배율 */
  growth: number; work: number; swing: number; bad: number; good: number;
  /** 인사 정원: tight = 60%, open = 제한 없음 */
  quota?: 'tight' | 'open';
  goal: GoalId;
}
export const UNITS: Record<UnitTrait, UnitDef> = {
  훈련: { name: '훈련 많은 부대', short: '훈련 많음', desc: '몸은 고되지만 빨리 커요 · 성장 +12%, 나쁜 일 확률 ×1.3', growth: 1.12, work: 0, swing: 10, bad: 1.3, good: 1, goal: 'clean' },
  신설: { name: '새로 만든 부대', short: '신설', desc: '정해진 게 없어 결과가 크게 갈려요 · 업무 평정 ±15, 좋은 일 ×1.3', growth: 1, work: 0, swing: 15, bad: 1, good: 1.3, goal: 'good2' },
  정예: { name: '잘나가는 부대', short: '잘나감', desc: '누구나 가고 싶어 해요 · 업무 평정 +3, 정원 60%', growth: 1, work: 3, swing: 10, bad: 1, good: 1, quota: 'tight', goal: 'top1' },
  침체: { name: '분위기 안 좋은 부대', short: '분위기 나쁨', desc: '아무도 안 가려 해요 · 업무 평정 −3, 정원 제한 없음, 살려내면 큰 보상', growth: 1, work: -3, swing: 10, bad: 1.2, good: 1, quota: 'open', goal: 'good1' },
  평가: { name: '평가 앞둔 부대', short: '평가 앞둠', desc: '한 번의 평가가 임기를 좌우해요 · 업무 평정 ±14, 좋은 일 ×1.2', growth: 1, work: 0, swing: 14, bad: 1, good: 1.2, goal: 'work1' },
};
export const UNIT_KEYS = Object.keys(UNITS) as UnitTrait[];

export interface BossDef {
  name: string; desc: string; line: string;
  /** 결재 성향별 확률 가감 */
  styles: Partial<Record<Style, number>>;
  /** 업무 흔들림 덮어쓰기, 평정 증폭, 하한, 성장, 처세 */
  swing?: number; amp?: number; floor?: number; growth?: number; social?: number;
}
export const BOSSES: Record<BossType, BossDef> = {
  꼼꼼: { name: '꼼꼼한 상관', desc: '원칙 결재 +6, 편법 −6 · 평정이 덜 흔들려요', line: '규정대로 하는 사람을 믿는 분이에요', styles: { 원칙: 6, 편법: -6 }, swing: 6 },
  성과: { name: '성과형 상관', desc: '도전 결재 +6 · 잘하면 더 높게, 못하면 더 낮게', line: '결과로 말하라는 분이에요', styles: { 도전: 6 }, amp: 1.3 },
  방임: { name: '방임형 상관', desc: '간섭이 없어요 · 성장 +5%', line: '알아서 하게 두는 분이에요', styles: {}, growth: 1.05 },
  온화: { name: '사람 좋은 상관', desc: '소통 결재 +6 · 처세 +1/년, 업무 평정 최소 52', line: '사람을 먼저 보는 분이에요', styles: { 소통: 6 }, floor: 52, social: 1 },
};
export const BOSS_KEYS = Object.keys(BOSSES) as BossType[];

export type GoalId = 'clean' | 'good2' | 'top1' | 'good1' | 'work1';
export const GOALS: Record<GoalId, { text: string; check: (t: Term) => boolean; bonus: number }> = {
  clean: { text: '임기 동안 나쁜 일 없이 마치기', check: (t) => t.bad === 0, bonus: 2 },
  good2: { text: "평정 '우수' 이상 2번", check: (t) => t.good >= 2, bonus: 3 },
  top1: { text: "평정 '탁월' 1번 이상", check: (t) => t.top >= 1, bonus: 3 },
  good1: { text: "평정 '우수' 이상 1번 (부대 살리기)", check: (t) => t.good >= 1, bonus: 4 },
  work1: { text: "업무 성과 '우수' 1번 이상", check: (t) => t.work >= 1, bonus: 3 },
};
export const goalOf = (t: Term) => GOALS[UNITS[t.unit].goal];

/** 장성(준장 이상)은 지휘 방침을 쓰고, 그 아래만 임기 카드를 쓴다 */
export const usesTerm = (rank: Rank) => RANKS.indexOf(rank) < RANKS.indexOf('준장');

const hash = (...n: (number | string)[]) => {
  let h = 2166136261;
  for (const x of n) for (const c of String(x)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
export const keyRng = (...n: (number | string)[]) => createRng(hash(...n));

/** 올해 이 보직 자리의 부대 상황 (같은 세상 시드면 모두에게 같은 카드) */
export function unitCard(seed: number, year: number, billetId: string): UnitTrait {
  const r = keyRng(seed, year, billetId, 'unit').next();
  // 정예·침체는 조금 드물게
  return r < 0.24 ? '훈련' : r < 0.46 ? '신설' : r < 0.62 ? '정예' : r < 0.78 ? '침체' : '평가';
}

/** 상관 뽑기: 잘나가는 부대엔 성과형, 분위기 안 좋은 부대엔 방임형이 조금 더 많다 */
export function rollBoss(unit: UnitTrait, rng: Rng): BossType {
  const w: Record<BossType, number> = { 꼼꼼: 1, 성과: unit === '정예' ? 1.8 : 1, 방임: unit === '침체' ? 1.6 : 1, 온화: 1 };
  let r = rng.next() * BOSS_KEYS.reduce((s, k) => s + w[k], 0);
  for (const k of BOSS_KEYS) if ((r -= w[k]) < 0) return k;
  return '온화';
}

/** 시뮬 비교용 스위치 */
export const termOff = () => !!(globalThis as { __TERM_OFF?: boolean }).__TERM_OFF;

export function startTerm(o: Officer, unit: UnitTrait, boss: BossType, year: number) {
  o.term = usesTerm(o.rank) && !termOff() ? { unit, boss, start: year, years: 0, good: 0, top: 0, work: 0, bad: 0 } : undefined;
}

/** 업무 성과 점수에 부대·상관 효과 */
export function termWork(o: Officer, base: number, rng: Rng): number {
  const t = o.term;
  if (!t) return base + rng.int(-10, 10);
  const u = UNITS[t.unit], b = BOSSES[t.boss];
  const swing = b.swing !== undefined ? Math.max(b.swing, u.swing - 4) : u.swing;
  let s = base + rng.int(-swing, swing) + u.work;
  if (b.amp) s = 60 + (s - 60) * b.amp;
  if (b.floor) s = Math.max(b.floor, s);
  return Math.round(s);
}
export const termGrowth = (o: Officer) => (o.term ? UNITS[o.term.unit].growth * (BOSSES[o.term.boss].growth ?? 1) : 1);
export const termEventMult = (o: Officer, slot: 'bad' | 'good') => (o.term ? UNITS[o.term.unit][slot] : 1);
export const bossStyleBonus = (o: Officer, style: Style) => (o.term ? BOSSES[o.term.boss].styles[style] ?? 0 : 0);
