// 약장 그림 (게임용 오리지널 줄무늬, 실제 약장을 베끼지 않음)
import type { Earned } from '../engine/meta';

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
const METAL = { 동: '#B87333', 은: '#D5DAE1', 금: '#E2BC57' };

function starPts(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 ? r * 0.42 : r;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

function device(e: Earned, x: number, y: number, w: number, h: number): string {
  const cy = y + h / 2;
  const st = (cx: number, c: string) => `<polygon points="${starPts(cx, cy, h * 0.4)}" fill="${c}" stroke="#00000055" stroke-width="0.4"/>`;
  const dot = (cx: number) => `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(h * 0.2).toFixed(1)}" fill="${METAL.금}" stroke="#00000055" stroke-width="0.4"/>`;
  if (e.id === 'cheongun') {
    const t = e.tierIndex; // 0:5급 … 4:1급
    if (t === 1) return dot(x + w / 2);
    if (t === 2) return dot(x + w / 2 - h * 0.35) + dot(x + w / 2 + h * 0.35);
    if (t === 3) return st(x + w / 2, METAL.은);
    if (t === 4) return st(x + w / 2, METAL.금);
    return '';
  }
  if (e.tier && e.tier in METAL) return st(x + w / 2, METAL[e.tier as keyof typeof METAL]);
  return '';
}

export function ribbonAt(e: Earned, x: number, y: number, w: number, h: number, ghost = false): string {
  const [base, stripes] = RIB[e.design % RIB.length];
  if (ghost) return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#EEF0EC" stroke="#D5D9D0" stroke-dasharray="2 2"/>`;
  let o = `<rect x="${x + 1}" y="${y + 1.2}" width="${w}" height="${h}" fill="#000" fill-opacity="0.18"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${base}"/>`;
  for (const [s, sw, c] of stripes) o += `<rect x="${(x + s * w).toFixed(1)}" y="${y}" width="${Math.max(1.2, sw * w).toFixed(1)}" height="${h}" fill="${c}"/>`;
  o += `<rect x="${x}" y="${y}" width="${w}" height="${(h * 0.35).toFixed(1)}" fill="#fff" fill-opacity="0.18"/>`;
  return o + device(e, x, y, w, h);
}

/** 약장 한 개 (도감용) */
export function ribbonSvg(e: Earned, w = 44, ghost = false): string {
  const h = Math.round(w * 0.3);
  return `<svg width="${w + 2}" height="${h + 2}" viewBox="0 0 ${w + 2} ${h + 2}" aria-hidden="true">${ribbonAt(e, 0, 0, w, h, ghost)}</svg>`;
}

/** 약장 줄: 한 줄에 perRow개, 위로 쌓이고 가운데 정렬 */
export function ribbonRack(list: Earned[], w = 30, perRow = 4): string {
  if (!list.length) return '';
  const h = Math.round(w * 0.3), gap = 2;
  const rows: Earned[][] = [];
  for (let i = 0; i < list.length; i += perRow) rows.push(list.slice(i, i + perRow));
  rows.reverse(); // 위에서부터 그리므로 마지막 줄이 맨 위
  const W = perRow * w + (perRow - 1) * gap + 2;
  const H = rows.length * (h + gap) + 1;
  let o = '';
  rows.forEach((row, r) => {
    const rw = row.length * w + (row.length - 1) * gap;
    const x0 = (W - rw) / 2;
    row.forEach((e, k) => (o += ribbonAt(e, x0 + k * (w + gap), r * (h + gap), w, h)));
  });
  return `<svg class="rack" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="약장 ${list.length}개">${o}</svg>`;
}
