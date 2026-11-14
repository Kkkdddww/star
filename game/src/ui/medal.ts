// 훈장 수여 연출: 약장 줄무늬로 만든 드리운 리본 + 금속 메달. 게임 오리지널 그림.
import { RIBBONS, type Earned } from '../engine/meta';

const RIB: [string, [number, number, string][]][] = [
  ['#C8352E', [[0.12, 0.08, '#F4F1E8'], [0.8, 0.08, '#F4F1E8'], [0.42, 0.16, '#2F5FBF']]],
  ['#2F5FBF', [[0, 0.14, '#F4F1E8'], [0.86, 0.14, '#F4F1E8'], [0.45, 0.1, '#E3B93F']]],
  ['#2E7D4F', [[0.2, 0.1, '#F4F1E8'], [0.7, 0.1, '#F4F1E8'], [0.4, 0.2, '#C8352E']]],
  ['#E3B93F', [[0, 0.2, '#C8352E'], [0.8, 0.2, '#C8352E'], [0.45, 0.1, '#2F5FBF']]],
  ['#6B3FA0', [[0.3, 0.08, '#F4F1E8'], [0.62, 0.08, '#F4F1E8']]],
  ['#F4F1E8', [[0, 0.25, '#2F5FBF'], [0.75, 0.25, '#2F5FBF'], [0.45, 0.1, '#C8352E']]],
  ['#D9662B', [[0.15, 0.1, '#E3B93F'], [0.75, 0.1, '#E3B93F'], [0.45, 0.1, '#2E7D4F']]],
  ['#1F6F8B', [[0, 0.12, '#E3B93F'], [0.88, 0.12, '#E3B93F'], [0.3, 0.06, '#F4F1E8'], [0.64, 0.06, '#F4F1E8']]],
  ['#C8352E', [[0, 0.33, '#2F5FBF'], [0.67, 0.33, '#2E7D4F']]],
  ['#2E7D4F', [[0, 0.1, '#F4F1E8'], [0.9, 0.1, '#F4F1E8'], [0.3, 0.4, '#E3B93F']]],
  ['#8E2B3A', [[0.4, 0.2, '#F4F1E8']]],
  ['#2F5FBF', [[0.1, 0.1, '#C8352E'], [0.3, 0.1, '#F4F1E8'], [0.6, 0.1, '#F4F1E8'], [0.8, 0.1, '#C8352E']]],
  ['#1E2A55', [[0.08, 0.06, '#E3B93F'], [0.86, 0.06, '#E3B93F'], [0.44, 0.12, '#F4F1E8']]],
  ['#7A2430', [[0, 0.16, '#E3B93F'], [0.84, 0.16, '#E3B93F'], [0.47, 0.06, '#F4F1E8']]],
  ['#C8352E', [[0.2, 0.15, '#E3B93F'], [0.65, 0.15, '#E3B93F']]],
  ['#E3B93F', [[0.1, 0.06, '#1E2A55'], [0.3, 0.06, '#1E2A55'], [0.64, 0.06, '#1E2A55'], [0.84, 0.06, '#1E2A55']]],
  ['#3F7D3A', [[0, 0.2, '#D9662B'], [0.8, 0.2, '#D9662B'], [0.45, 0.1, '#F4F1E8']]],
  ['#5B6B7A', [[0.2, 0.12, '#C8352E'], [0.68, 0.12, '#C8352E']]],
  ['#D9662B', [[0, 0.1, '#1F6F8B'], [0.9, 0.1, '#1F6F8B'], [0.42, 0.16, '#F4F1E8']]],
  ['#2E7D4F', [[0.15, 0.1, '#F4F1E8'], [0.35, 0.1, '#2F5FBF'], [0.55, 0.1, '#F4F1E8'], [0.75, 0.1, '#2F5FBF']]],
  ['#6B3FA0', [[0, 0.15, '#E3B93F'], [0.85, 0.15, '#E3B93F']]],
  ['#2F5FBF', [[0, 0.33, '#F4F1E8'], [0.67, 0.33, '#C8352E']]],
  ['#1F6F8B', [[0.25, 0.12, '#F4F1E8'], [0.63, 0.12, '#F4F1E8'], [0.47, 0.06, '#C8352E']]],
  ['#8E2B3A', [[0, 0.12, '#2F5FBF'], [0.88, 0.12, '#2F5FBF'], [0.3, 0.4, '#F4F1E8']]],
  ['#4B5D3A', [[0.12, 0.1, '#F4F1E8'], [0.78, 0.1, '#F4F1E8'], [0.45, 0.1, '#E3B93F']]],
];

type Metal = 'gold' | 'silver' | 'bronze';
const METAL: Record<Metal, { lo: number[]; hi: number[]; edge: string }> = {
  gold: { lo: [150, 110, 30], hi: [255, 236, 160], edge: '#7A5A14' },
  silver: { lo: [118, 128, 146], hi: [252, 253, 255], edge: '#5E6774' },
  bronze: { lo: [120, 68, 34], hi: [236, 176, 120], edge: '#5E3416' },
};
const LIGHT = (-125 * Math.PI) / 180;
function shade(m: Metal, ang: number, k = 1.2): string {
  const t = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.cos(ang - LIGHT) * k));
  const { lo, hi } = METAL[m];
  return '#' + lo.map((v, i) => Math.round(v + (hi[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const f = (n: number) => n.toFixed(1);

/** 약장 등급에 맞는 금속 */
export function metalOf(e: Earned): Metal {
  const prec = RIBBONS.find((r) => r.id === e.id)?.prec ?? 0;
  if (e.tier === '금' || e.tier === '1급' || e.tier === '2급' || prec >= 85) return 'gold';
  if (e.tier === '동' || e.tier === '5급' || e.tier === '4급') return 'bronze';
  return prec >= 60 || e.tier === '은' || e.tier === '3급' ? 'silver' : 'bronze';
}

let uid = 0;
/** 드리운 리본 + 8각 메달 (세로 120×210) */
export function medalSvg(e: Earned, height = 210): string {
  const id = `md${uid++}`;
  const [base, stripes] = RIB[e.design % RIB.length];
  const m = metalOf(e);
  const { edge } = METAL[m];
  const x0 = 28, w = 64, top = 0, bot = 92, tip = 106;
  // 리본(세로 줄무늬) — 아래가 V자로 잘린 모양
  let ribbon = `<clipPath id="${id}"><polygon points="${x0},${top} ${x0 + w},${top} ${x0 + w},${bot} ${x0 + w / 2},${tip} ${x0},${bot}"/></clipPath>
    <g clip-path="url(#${id})"><rect x="${x0}" y="${top}" width="${w}" height="${tip}" fill="${base}"/>`;
  for (const [s, sw, c] of stripes) ribbon += `<rect x="${f(x0 + s * w)}" y="${top}" width="${f(Math.max(1.5, sw * w))}" height="${tip}" fill="${c}"/>`;
  ribbon += `<rect x="${x0}" y="${top}" width="${w}" height="${tip}" fill="url(#${id}s)"/></g>
    <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity=".16"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>`;
  // 고리
  const ring = `<circle cx="60" cy="112" r="7" fill="none" stroke="${shade(m, 0.3)}" stroke-width="3.5"/><circle cx="60" cy="112" r="7" fill="none" stroke="${edge}" stroke-width=".6"/>`;
  // 8각 별 메달
  const cx = 60, cy = 160, R = 40, r = 29;
  let star = '';
  const P = (a: number, rr: number): [number, number] => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  for (let i = 0; i < 8; i++) {
    const a0 = ((-90 + i * 45) * Math.PI) / 180, a1 = a0 + Math.PI / 8, a2 = a0 - Math.PI / 8;
    const tipP = P(a0, R), r1 = P(a1, r), r2 = P(a2, r);
    star += `<polygon points="${f(cx)},${f(cy)} ${f(r2[0])},${f(r2[1])} ${f(tipP[0])},${f(tipP[1])}" fill="${shade(m, a0 - 0.6)}" stroke="${edge}" stroke-width=".5" stroke-linejoin="round"/>`;
    star += `<polygon points="${f(cx)},${f(cy)} ${f(tipP[0])},${f(tipP[1])} ${f(r1[0])},${f(r1[1])}" fill="${shade(m, a0 + 0.6)}" stroke="${edge}" stroke-width=".5" stroke-linejoin="round"/>`;
  }
  // 가운데: 국방색 법랑 원 + 작은 별
  const inner = `<circle cx="${cx}" cy="${cy}" r="17" fill="${shade(m, LIGHT, -0.4)}" stroke="${edge}" stroke-width=".8"/>
    <circle cx="${cx}" cy="${cy}" r="13" fill="#4B5D3A" stroke="${edge}" stroke-width=".6"/>
    <circle cx="${cx - 4}" cy="${cy - 5}" r="5" fill="#fff" fill-opacity=".18"/>
    <polygon points="${Array.from({ length: 10 }, (_, i) => { const rr = i % 2 ? 3 : 7.5; const a = ((-90 + i * 36) * Math.PI) / 180; return `${f(cx + rr * Math.cos(a))},${f(cy + rr * Math.sin(a))}`; }).join(' ')}" fill="${shade(m, LIGHT, 0.5)}"/>`;
  const w2 = (120 / 210) * height;
  return `<svg width="${f(w2)}" height="${height}" viewBox="0 0 120 210" aria-hidden="true">${ribbon}${ring}${star}${inner}</svg>`;
}
