// 시드 기반 난수. 같은 시드면 같은 커리어가 나온다 (디버깅·공유용).
export type Rng = {
  next(): number; // 0 이상 1 미만
  int(min: number, max: number): number; // min~max 포함
  pick<T>(arr: readonly T[]): T;
};

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}
