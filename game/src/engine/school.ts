// 학교 프롤로그: 출신(무작위) → 생도 시절 집중 분야 2개 → 졸업 석차·병과 배정
import { ORIGIN, SCHOOL_FOCUS } from '../data/config';
import { createRng } from './rng';
import type { Branch, Origin, Potential, SchoolFocus, StatKey, Stats } from './types';

export function rollOrigin(r: number, exclude?: Origin): Origin {
  const table = (Object.keys(ORIGIN) as Origin[]).filter((o) => o !== exclude);
  const total = table.reduce((s, o) => s + ORIGIN[o].weight, 0);
  let x = r * total;
  for (const o of table) if ((x -= ORIGIN[o].weight) < 0) return o;
  return table[table.length - 1];
}

const POT_BASE: Record<Potential, number> = { S: 70, A: 61, B: 52, C: 44 };
const FOCUS_SCORE: Record<SchoolFocus, number> = { 학업: 6, 리더십: 4, 체력: 3, 동기: 2 };

export interface Graduation {
  pct: number;
  label: string;
  bonus: Partial<Stats>;
  branch: Branch;
  branchGranted: boolean;
  title?: string;
}

export function graduate(o: { focus: [SchoolFocus, SchoolFocus]; branchWish: Branch; potential: Potential; seed: number }): Graduation {
  const rng = createRng(o.seed * 53 + 7);
  const score = POT_BASE[o.potential] + FOCUS_SCORE[o.focus[0]] + FOCUS_SCORE[o.focus[1]] + rng.int(-15, 15);
  const pct = Math.max(1, Math.min(99, Math.round(100 - (score - 25) * 1.5)));
  const bonus: Partial<Stats> = {};
  const add = (k: StatKey, n: number) => (bonus[k] = (bonus[k] ?? 0) + n);
  for (const f of o.focus) for (const [k, v] of Object.entries(SCHOOL_FOCUS[f].stats)) add(k as StatKey, v!);
  const primaries = o.focus.map((f) => Object.keys(SCHOOL_FOCUS[f].stats)[0] as StatKey);
  const delta = pct <= 10 ? 3 : pct <= 50 ? 1 : pct >= 80 ? -2 : 0;
  if (delta) for (const k of primaries) add(k, delta);
  const granted = pct <= 60 || rng.next() < 0.5;
  const others = (['전투', '기술', '행정'] as Branch[]).filter((b) => b !== o.branchWish);
  const label = pct <= 1 ? '수석 졸업' : pct <= 10 ? '우등 졸업' : pct <= 50 ? '상위권 졸업' : pct >= 80 ? '하위권 졸업' : '무난한 졸업';
  return { pct, label, bonus, branch: granted ? o.branchWish : rng.pick(others), branchGranted: granted, title: pct <= 1 ? '수석 졸업' : pct <= 10 ? '우등 졸업' : undefined };
}

export const SCHOOL_MOMENTS: Record<Origin, string[]> = {
  육사: ['가입교 훈련을 버티고 있어요', '첫 학기 성적표가 나왔어요', '하계 군사훈련 중이에요', '동기들과 밤새 과제를 했어요', '졸업 종합평가를 앞두고 있어요'],
  학군: ['학군단 입단식을 했어요', '수업과 훈련을 오가고 있어요', '여름 입영훈련 중이에요', '동기들과 체력 단련을 했어요', '임관 종합평가를 앞두고 있어요'],
  학사: ['훈련소 생활이 시작됐어요', '기초 군사학을 배우고 있어요', '야외 종합훈련 중이에요', '동기들과 서로 버팀목이 됐어요', '임관 종합평가를 앞두고 있어요'],
  '3사': ['입교식을 마쳤어요', '전공과 군사학을 함께 배워요', '하계 군사훈련 중이에요', '동기들과 행군을 완주했어요', '졸업 종합평가를 앞두고 있어요'],
};
