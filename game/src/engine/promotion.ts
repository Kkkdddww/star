// 진급 심사: 동기 중 대상자 전원을 같은 공식으로 점수 매기고, 정원만큼 위에서 선발
import { CAREER, MERIT, MIN_YEARS, ORIGIN, PROMOTION, RANK_BASELINE, RANKS, REQUIRED_BILLET, REVIEW_NOISE, yearlyRate } from '../data/config';
import { STAT_KEYS, STAT_LABEL } from './types';
import { iga } from './text';
import type { Rng } from './rng';
import type { Officer, PromotionResult, Rank } from './types';

export interface ScoredCandidate { o: Officer; score: number; breakdown: PromotionResult['breakdown'] }

export function careerScore(o: Officer): number {
  return CAREER.base + (o.rankLog.core ? CAREER.core : 0) + CAREER.support * Math.min(CAREER.supportMax, o.rankLog.support.length) + ORIGIN[o.origin].careerBonus;
}

/** 공적: 최근 4년 동안 받은 표창·큰 표창·무사고 지휘·임기 목표 (v3.3.4). 평정처럼 최근 4년만 봐서 계급에 머문 기간과 상관없다 */
export function meritRecent(o: Officer) {
  const r = (o.merit ?? []).slice(-4);
  return { a: r.reduce((s, x) => s + x.a, 0), m: r.reduce((s, x) => s + x.m, 0), c: r.reduce((s, x) => s + x.c, 0), g: r.reduce((s, x) => s + x.g, 0) };
}
export function meritScore(o: Officer): number {
  const r = meritRecent(o);
  return Math.min(100, MERIT.base + MERIT.award * r.a + MERIT.major * r.m + MERIT.clean * r.c + MERIT.goal * r.g);
}
export function meritLine(o: Officer): string {
  const r = meritRecent(o);
  const parts = [r.a ? `표창 ${r.a}` : '', r.m ? `큰 표창 ${r.m}` : '', r.c ? `무사고 지휘 ${r.c}년` : '', r.g ? `임기 목표 ${r.g}` : ''].filter(Boolean);
  return parts.length ? `최근 4년 ${parts.join(' · ')}` : '최근 4년 공적 없음';
}

/** 필수 보직을 거쳤는가 (이 계급에서 다음 심사를 받을 자격) */
export function hasRequired(o: Officer): boolean {
  const req = REQUIRED_BILLET[o.rank];
  return !req || req.ids.some((id) => o.billets.includes(id));
}

/** 역량 균형: 가장 낮은 능력치 두 개가 계급 기준에서 얼마나 떨어져 있는가 */
export function balanceScore(o: Officer): number {
  const low = [...STAT_KEYS].map((k) => o.stats[k]).sort((a, b) => a - b);
  const avg = (low[0] + low[1]) / 2;
  return Math.max(0, Math.min(100, 65 + (avg - RANK_BASELINE[o.rank]) * 1.5));
}
export function weakestStats(o: Officer): string {
  return [...STAT_KEYS].sort((a, b) => o.stats[a] - o.stats[b]).slice(0, 2).map((k) => STAT_LABEL[k]).join(', ');
}

export function promotionBreakdown(o: Officer): PromotionResult['breakdown'] {
  const recent = o.evalsInRank.slice(-4);
  const evalAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 50;
  const combat = 60 + o.stats.tactics - RANK_BASELINE[o.rank];
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return { eval: clamp(evalAvg), career: clamp(careerScore(o)), edu: clamp(o.eduScore), combat: clamp(combat), balance: balanceScore(o), merit: meritScore(o) };
}

/** 낙천 설명: 현실적으로 노려볼 수 있는 목표치까지 가중치를 곱해 가장 많이 남은 항목 (이미 높은 항목은 탓하지 않는다) */
const AIM = { eval: 90, career: 100, merit: 85, edu: 90, combat: 85, balance: 85 };
export function weakest(o: Officer): { label: string; why: string } {
  const w = PROMOTION[o.rank]!.weights;
  const b = promotionBreakdown(o);
  const gap = (v: number, aim: number, wt: number) => Math.max(0, aim - v) * wt;
  const sup = Math.min(CAREER.supportMax, o.rankLog.support.length);
  const loss = [
    { label: '평정', v: gap(b.eval, AIM.eval, w.eval), why: '최근 4년 근무평정 평균이 낮았어요. 결재에서 확실한 선택을 늘려 보세요' },
    { label: '경력', v: gap(b.career, AIM.career, w.career), why: !o.rankLog.core ? `지휘·요직 경험이 없었어요. 하면 경력 +${CAREER.core}, 희망 조사에서 1지망으로 노려 보세요` : `보조 보직을 ${sup}개만 거쳤어요. 하나 더 하면 경력 +${CAREER.support}` },
    { label: '공적', v: gap(b.merit ?? 0, AIM.merit, w.merit), why: '최근 4년 표창·무사고 지휘가 적었어요. 표창 1개 +5, 지휘 보직 무사고 1년 +3' },
    { label: '교육', v: gap(b.edu, AIM.edu, w.edu), why: '군사교육 석차가 아쉬웠어요. 전문성이 석차를 좌우해요' },
    { label: '전투', v: gap(b.combat, AIM.combat, w.combat), why: '작전·전술이 계급 평균보다 낮았어요' },
    { label: '균형', v: gap(b.balance, AIM.balance, w.balance), why: `${iga(weakestStats(o))} 너무 낮았어요. 한쪽만 키우면 역량 균형에서 깎여요` },
  ].sort((x, y) => y.v - x.v)[0];
  return { label: loss.label, why: loss.why };
}

export function promotionScore(o: Officer, rng: Rng): ScoredCandidate {
  const w = PROMOTION[o.rank]!.weights;
  const b = promotionBreakdown(o);
  const raw = w.eval * b.eval + w.career * b.career + w.edu * b.edu + w.combat * b.combat + w.balance * b.balance + w.merit * (b.merit ?? 0);
  const score = Math.round((raw + (rng.next() * 2 - 1) * REVIEW_NOISE) * 10) / 10;
  return { o, score, breakdown: b };
}

function stochasticRound(x: number, rng: Rng): number {
  const f = Math.floor(x);
  return f + (rng.next() < x - f ? 1 : 0);
}

export interface ReviewOutcome {
  rank: Rank; to: Rank; scored: ScoredCandidate[]; selectedIds: Set<string>; cut: number | null;
  /** 함께 심사받은 다른 기수(가상) 인원과 그중 선발 수 */
  others: number; othersSelected: number;
  /** 필수 보직을 못 거쳐 심사에서 빠진 사람 */
  excluded: Officer[];
}

/** 중령 이상 심사는 동기만으로는 인원이 너무 적어서, 다른 기수 대상자를 채워 10명 풀로 심사한다 */
export const REVIEW_POOL = 10;
// v3.0: 부대·상관·임기 목표로 전체 평정이 조금 올라서 다른 기수 평균도 +2
// v3.2: 잠재력 B안(B·C 성장↑)으로 전체 능력치가 올라서 +1 (봇 기준 대령+·준장+ 비율을 v3.1과 같게)
// v3.3.4: 공적 15%(평균 60대라 전체 점수 −2쯤) + 잠재력 격차 축소(성장↑)를 반영해 다시 맞춤. 봇 대령+ · 준장+는 v3.3과 같게,
//         장성 단계는 공식 변화(−2.4)만큼 내리고, 중장은 대장 비율을 올리려고 1.5 더 내림
const VIRTUAL_MEAN: Partial<Record<Rank, number>> = { 중령: 77, 대령: 75.8, 준장: 73.9, 소장: 74.6, 중장: 73.1 };

export function runReview(rank: Rank, officers: Officer[], rng: Rng): ReviewOutcome | null {
  if (!PROMOTION[rank]) return null;
  const need = MIN_YEARS[rank]!;
  const due = officers.filter((o) => o.active && o.rank === rank && o.yearsInRank >= need);
  const eligible = due.filter(hasRequired);
  const excluded = due.filter((o) => !hasRequired(o));
  if (!eligible.length) return excluded.length ? { rank, to: RANKS[RANKS.indexOf(rank) + 1], scored: [], selectedIds: new Set(), cut: null, others: 0, othersSelected: 0, excluded } : null;
  const scored = eligible.map((o) => promotionScore(o, rng)).sort((a, b) => b.score - a.score);
  const g = globalThis as { __VM_ADD?: number; __VM?: Partial<Record<Rank, number>> };
  const base = g.__VM?.[rank] ?? VIRTUAL_MEAN[rank];
  const mean = base === undefined ? undefined : base + (g.__VM_ADD ?? 0);
  const virtual = mean === undefined ? [] : Array.from({ length: Math.max(0, REVIEW_POOL - scored.length) }, () => Math.round((mean + rng.int(-9, 9) + rng.next()) * 10) / 10);
  const pool = [...scored.map((c) => ({ id: c.o.id as string | null, score: c.score })), ...virtual.map((v) => ({ id: null, score: v }))].sort((a, b) => b.score - a.score);
  const n = Math.min(pool.length, stochasticRound(yearlyRate(rank) * pool.length, rng));
  const selected = pool.slice(0, n);
  const selectedIds = new Set(selected.filter((x) => x.id).map((x) => x.id!));
  return {
    rank, to: RANKS[RANKS.indexOf(rank) + 1], scored, selectedIds, cut: n ? selected[n - 1].score : null,
    others: virtual.length, othersSelected: selected.filter((x) => !x.id).length, excluded,
  };
}
