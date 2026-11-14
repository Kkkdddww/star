// v3.3 기수 약장: 바탕 8 × 줄무늬 모양 6 × 줄무늬 색 5 = 240가지. 성적은 별(동·은·금)과 금테로만 붙는다
import type { Honors } from '../net/api';

const C = { cream: '#F4F1E8', red: '#C8352E', blue: '#2F5FBF', green: '#2E7D4F', gold: '#E3B93F', navy: '#1E2A55', wine: '#8E2B3A', olive: '#4B5D3A', teal: '#1F6F8B' };
export const RIB_BASES = [C.navy, C.teal, C.wine, C.olive, C.blue, C.green, C.red, C.gold];
export const RIB_COLORS = [C.cream, C.gold, C.red, C.navy, C.green];
type Stripe = [number, number, string];
export const RIB_PATTERNS: ((c: string) => Stripe[])[] = [
  (c) => [[0.1, 0.08, C.cream], [0.82, 0.08, C.cream], [0.44, 0.12, c]],
  (c) => [[0, 0.16, c], [0.84, 0.16, c]],
  (c) => [[0.2, 0.12, c], [0.68, 0.12, c]],
  (c) => [[0.42, 0.16, c]],
  (c) => [[0, 0.33, c]],
  (c) => [[0.1, 0.06, c], [0.3, 0.06, c], [0.64, 0.06, c], [0.84, 0.06, c]],
];
const METAL = { 동: '#B87333', 은: '#D5DAE1', 금: '#E2BC57' } as const;
type Metal = keyof typeof METAL;

function starPts(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 ? r * 0.42 : r;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** 성적 → 별과 테두리: 우승이 있으면 금별(최대 3)+금테, 입상이면 은별, 4주 이상 참가면 동별 하나 */
export function honorDevice(h: Honors | null | undefined): { stars: Metal[]; frame: boolean } {
  if (!h) return { stars: [], frame: false };
  if (h.wins > 0) return { stars: Array(Math.min(3, h.wins)).fill('금'), frame: true };
  if (h.podiums > 0) return { stars: Array(Math.min(3, h.podiums)).fill('은'), frame: false };
  if (h.weeks >= 4) return { stars: ['동'], frame: false };
  return { stars: [], frame: false };
}

const valid = (r: number[] | null | undefined): number[] => (r && r.length === 3 ? r : [3, 0, 0]);

/** 기수 약장 SVG. w는 가로 폭(px) */
export function teamRibbon(ribbon: number[] | null | undefined, w: number, h0?: Honors | null, label = '기수 약장'): string {
  const [b, p, c] = valid(ribbon);
  const { stars, frame } = honorDevice(h0);
  const h = Math.round(w * 0.3);
  let o = `<rect x="1" y="1.2" width="${w}" height="${h}" fill="#000" fill-opacity=".18"/><rect x="0" y="0" width="${w}" height="${h}" fill="${RIB_BASES[b % 8]}"/>`;
  for (const [s, sw, col] of RIB_PATTERNS[p % 6](RIB_COLORS[c % 5])) o += `<rect x="${(s * w).toFixed(1)}" y="0" width="${Math.max(1.2, sw * w).toFixed(1)}" height="${h}" fill="${col}"/>`;
  o += `<rect x="0" y="0" width="${w}" height="${(h * 0.35).toFixed(1)}" fill="#fff" fill-opacity=".18"/>`;
  stars.forEach((m, i) => { const cx = w / 2 + (i - (stars.length - 1) / 2) * h * 0.95; o += `<polygon points="${starPts(cx, h / 2, h * 0.4)}" fill="${METAL[m]}" stroke="#00000055" stroke-width="${w > 60 ? 0.8 : 0.4}"/>`; });
  const pad = frame ? 3 : 0;
  if (frame) o += `<rect x="-2" y="-2" width="${w + 4}" height="${h + 4}" fill="none" stroke="${METAL.금}" stroke-width="2"/>`;
  return `<svg class="trib" width="${w + 2 + pad * 2}" height="${h + 2 + pad * 2}" viewBox="${-pad} ${-pad} ${w + 2 + pad * 2} ${h + 2 + pad * 2}" role="img" aria-label="${label}">${o}</svg>`;
}
export const randomRibbon = () => [Math.floor(Math.random() * 8), Math.floor(Math.random() * 6), Math.floor(Math.random() * 5)];
