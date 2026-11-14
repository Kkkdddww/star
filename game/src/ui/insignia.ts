// 금속 계급장 (전역 카드에서 만든 디자인을 그대로 옮김: 9잎 무궁화·다이아·별 + 넓은 잎 화환과 무궁화 꽃)
// 그림자·그라디언트 없이 면마다 은색 명암만 칠한다. 모든 그림은 이 게임을 위해 새로 그렸다.
import { RANKS } from '../data/config';
import type { Rank } from '../engine/types';

const LIGHT = (-125 * Math.PI) / 180;
const EDGE = '#5E6774';
const f2 = (n: number) => n.toFixed(2);

function shade(ang: number, k = 1): string {
  const d = Math.cos(ang - LIGHT);
  const t = Math.max(0, Math.min(1, 0.5 + 0.5 * d * k));
  const lo = [118, 128, 146], hi = [252, 253, 255];
  return '#' + lo.map((v, i) => Math.round(v + (hi[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const poly = (pts: [number, number][], fill: string, sw = 0.5) =>
  `<polygon points="${pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join(' ')}" fill="${fill}" stroke="${EDGE}" stroke-width="${sw}" stroke-linejoin="round"/>`;

function star(cx: number, cy: number, R: number): string {
  const r = R * 0.4;
  const P = Array.from({ length: 5 }, (_, i) => [cx + R * Math.cos(((-90 + 72 * i) * Math.PI) / 180), cy + R * Math.sin(((-90 + 72 * i) * Math.PI) / 180)] as [number, number]);
  const Q = Array.from({ length: 5 }, (_, i) => [cx + r * Math.cos(((-54 + 72 * i) * Math.PI) / 180), cy + r * Math.sin(((-54 + 72 * i) * Math.PI) / 180)] as [number, number]);
  let o = '';
  for (let i = 0; i < 5; i++) {
    for (const [a, b] of [[P[i], Q[i]], [Q[(i + 4) % 5], P[i]]] as [number, number][][]) {
      const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
      o += poly([[cx, cy], a, b], shade(Math.atan2(my, mx), 1.25));
    }
  }
  return o;
}

function diamond(cx: number, cy: number, w: number, h: number): string {
  const T: [number, number] = [cx, cy - h / 2], R: [number, number] = [cx + w / 2, cy], B: [number, number] = [cx, cy + h / 2], L: [number, number] = [cx - w / 2, cy];
  let o = '';
  for (const [a, b] of [[L, T], [T, R], [R, B], [B, L]]) {
    const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
    o += poly([[cx, cy], a, b], shade(Math.atan2(my * 0.6, mx), 1.3));
  }
  return o;
}

function petal(cx: number, cy: number, ang: number, L: number, wid: number): string {
  const ux = Math.cos(ang), uy = Math.sin(ang), px = -uy, py = ux;
  const tip: [number, number] = [cx + ux * L, cy + uy * L];
  let o = '';
  for (const side of [-1, 1]) {
    const pts: [number, number][] = [[cx, cy]];
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      const bulge = Math.pow(Math.sin(Math.PI * t), 0.8) * wid * (1 - t * 0.25);
      pts.push([cx + ux * L * t + side * px * bulge, cy + uy * L * t + side * py * bulge]);
    }
    pts.push(tip);
    o += poly(pts, shade(ang + side * 1.1, 1.2), 0.45);
  }
  return o;
}

/** 영관 무궁화: 끝이 뾰족한 꽃잎 9장 */
function rankFlower(cx: number, cy: number, R: number): string {
  let o = '';
  for (let i = 0; i < 9; i++) o += petal(cx, cy, ((-90 + 40 * i) * Math.PI) / 180, R, R * 0.19);
  o += `<circle cx="${cx}" cy="${cy}" r="${f2(R * 0.17)}" fill="${shade(LIGHT, 0.5)}" stroke="${EDGE}" stroke-width="0.5"/>`;
  o += `<circle cx="${cx}" cy="${cy}" r="${f2(R * 0.07)}" fill="${EDGE}"/>`;
  return o;
}

/** 화환 가운데 정면 무궁화 */
function bloom(cx: number, cy: number, r: number): string {
  let o = '';
  for (let i = 0; i < 5; i++) {
    const a = ((-90 + 72 * i) * Math.PI) / 180;
    const ex = cx + r * 0.55 * Math.cos(a), ey = cy + r * 0.55 * Math.sin(a);
    const rot = (a * 180) / Math.PI + 90;
    o += `<ellipse cx="${f2(ex)}" cy="${f2(ey)}" rx="${f2(r * 0.42)}" ry="${f2(r * 0.48)}" transform="rotate(${rot.toFixed(0)} ${f2(ex)} ${f2(ey)})" fill="${shade(a, 0.6)}" stroke="${EDGE}" stroke-width="0.6"/>`;
    for (const dv of [-0.22, 0.22]) {
      const aa = a + dv;
      o += `<line x1="${f2(cx + r * 0.86 * Math.cos(aa))}" y1="${f2(cy + r * 0.86 * Math.sin(aa))}" x2="${f2(cx + r * Math.cos(aa))}" y2="${f2(cy + r * Math.sin(aa))}" stroke="${EDGE}" stroke-width="0.55"/>`;
    }
    for (const dv of [-0.3, 0, 0.3]) {
      const aa = a + dv;
      o += `<line x1="${f2(cx + r * 0.28 * Math.cos(aa))}" y1="${f2(cy + r * 0.28 * Math.sin(aa))}" x2="${f2(cx + r * 0.78 * Math.cos(aa))}" y2="${f2(cy + r * 0.78 * Math.sin(aa))}" stroke="${EDGE}" stroke-width="0.4" stroke-opacity="0.7"/>`;
    }
  }
  o += `<circle cx="${cx}" cy="${cy}" r="${f2(r * 0.25)}" fill="${shade(LIGHT, -0.7)}" stroke="${EDGE}" stroke-width="0.5"/>`;
  o += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${f2(cy - r * 0.58)}" stroke="${EDGE}" stroke-width="1"/>`;
  for (let k = -2; k <= 2; k++) o += `<circle cx="${f2(cx + k * r * 0.1)}" cy="${f2(cy - r * 0.58 + Math.abs(k) * r * 0.05)}" r="${f2(r * 0.065)}" fill="${EDGE}"/>`;
  return o;
}

function broadLeaf(x: number, y: number, ang: number, L: number, W: number): string {
  const ux = Math.cos(ang), uy = Math.sin(ang), px = -uy, py = ux;
  const tip: [number, number] = [x + ux * L, y + uy * L];
  let o = '';
  for (const side of [-1, 1]) {
    const pts: [number, number][] = [[x, y]];
    const n = 9;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const b = Math.sin(Math.PI * Math.pow(t, 0.8)) * W * (k % 2 ? 1.0 : 0.93);
      pts.push([x + ux * L * t + side * px * b, y + uy * L * t + side * py * b]);
    }
    pts.push(tip);
    o += poly(pts, shade(ang + side * 1.15, 1.0), 0.45);
  }
  o += `<line x1="${f2(x)}" y1="${f2(y)}" x2="${f2(tip[0])}" y2="${f2(tip[1])}" stroke="${EDGE}" stroke-width="0.5"/>`;
  return o;
}

function wreath(cx: number, yb: number, a = 21, b = 24): string {
  let o = '';
  for (const side of [-1, 1]) {
    [0.5, 0.9, 1.3, 1.7].forEach((t, i) => {
      const x = cx + side * a * Math.sin(t), y = yb - b * (1 - Math.cos(t)) * 0.85;
      const tang = Math.atan2(-b * Math.sin(t), side * a * Math.cos(t));
      o += broadLeaf(x, y, tang - side * 1.0, 12.5 - i * 0.6, 5.0 - i * 0.3);
    });
    const t = 2.05, x = cx + side * a * Math.sin(t), y = yb - b * (1 - Math.cos(t)) * 0.85;
    o += broadLeaf(x, y, Math.atan2(-0.35, -side * 1.0), 10, 4.4);
  }
  return o + bloom(cx, yb - 5, 12);
}

const cache = new Map<string, string>();

/** 계급장 SVG. height: 화면에 보일 높이(px). wreath=false면 계급 표시만 (작은 목록용) */
export function insignia(rank: Rank, height: number, wreathOn = true): string {
  const key = `${rank}|${wreathOn}`;
  let inner = cache.get(key);
  let W = 0, H = 0;
  const i = RANKS.indexOf(rank);
  const kind = i < 3 ? 'd' : i < 6 ? 'f' : 's';
  const n = i < 6 ? (i % 3) + 1 : i - 5;
  const gap = kind !== 'd' ? 37 : 25;
  const R = 18;
  W = wreathOn ? Math.max(n * gap + 16, 80) : n * gap + 6;
  const cx0 = W / 2 - ((n - 1) * gap) / 2;
  const sy = kind === 'd' ? 24 : 21;
  const bottom = kind === 'd' ? sy + 21 : sy + R * 0.8;
  const yb = bottom + 25 - 6;
  H = wreathOn ? yb + 16 : bottom + 4;
  const top = wreathOn ? 0 : sy - (kind === 'd' ? 21 : R) - 2;
  if (!inner) {
    let o = wreathOn ? wreath(W / 2, yb) : '';
    for (let k = 0; k < n; k++) {
      const x = cx0 + k * gap;
      o += kind === 's' ? star(x, sy, R) : kind === 'f' ? rankFlower(x, sy, R) : diamond(x, sy, 22, 42);
    }
    inner = o;
    cache.set(key, inner);
  }
  const vh = H - top;
  const w = (W / vh) * height;
  return `<svg class="ins" width="${w.toFixed(0)}" height="${height}" viewBox="0 ${f2(top)} ${f2(W)} ${f2(vh)}" role="img" aria-label="${rank} 계급장">${inner}</svg>`;
}
