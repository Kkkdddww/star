// v3.3 호봉: 경험치 → 호봉. 판정과는 아무 상관 없음 (꾸미기만)
/** n호봉 → n+1호봉에 필요한 경험치 */
export const hobongNeed = (n: number) => 200 + 15 * (n - 1);
export function hobongOf(xp: number): { level: number; into: number; need: number } {
  let level = 1, left = Math.max(0, xp);
  while (left >= hobongNeed(level)) { left -= hobongNeed(level); level++; }
  return { level, into: left, need: hobongNeed(level) };
}
/** 한 판 경험치: 10 + 도달 계급(소위 10 ~ 대장 55) + 오늘의 기수 30 · 대항전 20. 자유 플레이는 하루 5판까지만 */
export const runXp = (rankIndex: number, mode: 'free' | 'daily' | 'cohort' | 'contest') => 20 + 5 * rankIndex + (mode === 'daily' ? 30 : mode === 'contest' ? 20 : 0);
/** 군번 표기: 가입 연도 2자리 + 순번 5자리 */
export const serialLabel = (serial: number | null | undefined, created?: string) => (serial ? `${(created ?? '2026').slice(2, 4)}-${String(serial).padStart(5, '0')}` : '발급 전');
