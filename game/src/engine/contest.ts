// v3.3 기수 대항전: 주간 회차 계산 (화면 없음)
import type { Potential } from './types';

/** 첫 회차 월요일 (한국 시간) */
export const CONTEST_FROM = '2026-11-16';
/** 대항전 판은 모두 잠재력 A (난이도 보통) */
export const CONTEST_POT: Potential = 'A';
/** 한 사람이 들어갈 수 있는 대항전 기수 수 */
export const MAX_TEAMS = 3;

const DAY = 86400000;
const toDate = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (t: Date) => t.toISOString().slice(0, 10);

/** 그 날짜가 속한 주의 월요일 */
export function weekOf(day: string): string {
  const t = toDate(day);
  const dow = (t.getUTCDay() + 6) % 7; // 월 0 … 일 6
  return fmt(new Date(t.getTime() - dow * DAY));
}
export const weekEnd = (week: string) => fmt(new Date(toDate(week).getTime() + 6 * DAY));
export const prevWeek = (week: string) => fmt(new Date(toDate(week).getTime() - 7 * DAY));
/** ISO 주 번호 (문서번호 "제2026-49호"용) */
export function weekNo(week: string): number {
  const t = toDate(week);
  const thu = new Date(t.getTime() + 3 * DAY);
  const jan1 = Date.UTC(thu.getUTCFullYear(), 0, 1);
  return Math.floor((thu.getTime() - jan1) / DAY / 7) + 1;
}
/** 일요일 24시까지 남은 날 (오늘 포함하지 않음: 일요일이면 0) */
export const daysLeftInWeek = (day: string) => 6 - (toDate(day).getUTCDay() + 6) % 7;
export const contestOpen = (day: string) => day >= CONTEST_FROM;

/** 개인 점수: 계급마다 100 + 명예 점수 */
export const personScore = (rankIndex: number, honor: number | null | undefined) => rankIndex * 100 + (honor ?? 0);
/** 팀 점수 (v3.3.3): 상위 10명 평균(10명이 안 되면 빈자리는 기본 300점) + 11번째 전역자부터 1명당 +2 (최대 +40).
 *  서버 contest_board 뷰와 같은 규칙 */
export const TOP_N = 10;
export const EMPTY_SLOT = 300;
export const crowdBonus = (n: number) => Math.min(40, Math.max(0, n - TOP_N) * 2);
export function teamScore(scores: number[]): number {
  if (!scores.length) return 0;
  const top = [...scores].sort((a, b) => b - a).slice(0, TOP_N);
  const sum = top.reduce((a, b) => a + b, 0) + (TOP_N - top.length) * EMPTY_SLOT;
  return Math.round(sum / TOP_N) + crowdBonus(scores.length);
}
