// 캐릭터 생성: 후보 3명 (출신이 서로 다르고, 능력치 총합이 같고, 분포만 다르다)
import { ORIGIN, START_STATS } from '../data/config';
import { rollOrigin } from './school';
import { STAT_KEYS, type Origin, type Potential, type StatKey, type Stats } from './types';

export interface Candidate { origin: Origin; potential: Potential; spread: Partial<Stats>; nick: string; seed: number }

/** 분포 유형 (합이 0이라 총합은 그대로) */
const ARCHETYPES: Partial<Stats>[] = [
  { command: 8, fitness: 3, admin: -5, expertise: -6 },
  { tactics: 8, command: 3, social: -5, fitness: -6 },
  { admin: 8, social: 3, fitness: -5, tactics: -6 },
  { expertise: 8, admin: 3, social: -5, command: -6 },
  { fitness: 8, command: 3, expertise: -5, admin: -6 },
  { social: 8, admin: 3, tactics: -5, expertise: -6 },
];

const NICKS: Record<StatKey, string[]> = {
  command: ['앞에 서면 다들 따라오는 사람', '목소리 하나로 소대를 움직이는 생도', '타고난 지휘관 기질'],
  tactics: ['작전판 앞에서 눈이 빛나는 생도', '지도만 보면 길이 보이는 사람', '전술 토론에서 지지 않는 생도'],
  admin: ['서류 한 장 틀리지 않는 사람', '일정표가 머릿속에 있는 생도', '꼼꼼함으로 버티는 사람'],
  expertise: ['궁금한 건 끝까지 파는 사람', '장비 설명서를 다 읽는 생도', '공부가 제일 쉬웠던 사람'],
  fitness: ['행군하면 맨 앞에 있는 사람', '체력검정이 제일 즐거운 생도', '지치지 않는 사람'],
  social: ['누구와도 금방 친해지는 사람', '분위기를 살리는 생도', '선후배 모두와 통하는 사람'],
};

export const POT_ROLL = (r: number): Potential => (r < 0.1 ? 'S' : r < 0.35 ? 'A' : r < 0.75 ? 'B' : 'C');

export const baseStats = (c: Candidate): Stats => {
  const s: Stats = { ...START_STATS };
  for (const [k, v] of Object.entries(ORIGIN[c.origin].stats)) s[k as StatKey] += v!;
  for (const [k, v] of Object.entries(c.spread)) s[k as StatKey] += v!;
  return s;
};

export function makeCandidates(rand: () => number = Math.random): Candidate[] {
  const origins: Origin[] = [];
  while (origins.length < 3) { const o = rollOrigin(rand()); if (!origins.includes(o)) origins.push(o); }
  const types = [...ARCHETYPES.keys()].sort(() => rand() - 0.5).slice(0, 3);
  return origins.map((origin, i) => {
    const spread = { ...ARCHETYPES[types[i]] };
    // 작은 흔들림: 두 능력치 사이에서 2 옮기기 (합 유지)
    const a = STAT_KEYS[Math.floor(rand() * 6)], b = STAT_KEYS[Math.floor(rand() * 6)];
    if (a !== b) { spread[a] = (spread[a] ?? 0) + 2; spread[b] = (spread[b] ?? 0) - 2; }
    const c: Candidate = { origin, potential: POT_ROLL(rand()), spread, nick: '', seed: Math.floor(rand() * 1e9) };
    const st = baseStats(c);
    const top = [...STAT_KEYS].sort((x, y) => st[y] - st[x])[0];
    c.nick = NICKS[top][Math.floor(rand() * NICKS[top].length)];
    return c;
  });
}

/** 잠재력 범위: 진짜 등급을 반드시 포함하는 2단계 */
const ORDER: Potential[] = ['C', 'B', 'A', 'S'];
export function potentialRange(p: Potential, rand: () => number = Math.random): string {
  const i = ORDER.indexOf(p);
  const lo = i === 0 ? 0 : i === 3 ? 2 : rand() < 0.5 ? i - 1 : i;
  return `${ORDER[lo]} ~ ${ORDER[lo + 1]}`;
}
