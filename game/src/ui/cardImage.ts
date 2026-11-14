// 전역 카드를 PNG(1080×1350)로 그려서 저장·공유한다. 서버 없이 브라우저 캔버스만 쓴다.
import { ro } from '../engine/text';
import { insignia } from './insignia';
import { ribbonRack } from './ribbon';
import type { CardData } from './social';

const W = 1080, H = 1350;
const C = { bg: '#F2F3F0', card: '#FFFFFF', panel: '#F2F3F0', panel2: '#F7F8F5', ink: '#191F28', sub: '#6B7684', faint: '#9AA092', olive: '#4B5D3A', oliveT: '#EEF2E7', chip: '#F2F3F0' };
const FONT = `Pretendard, 'Inter', 'Noto Sans KR', 'Apple SD Gothic Neo', system-ui, sans-serif`;

function svgImage(svg: string): Promise<HTMLImageElement> {
  const withNs = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  const url = URL.createObjectURL(new Blob([withNs], { type: 'image/svg+xml' }));
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, weight = 500, align: CanvasTextAlign = 'center') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

/** 가운데 정렬로 여러 색 조각을 한 줄에 */
function runs(ctx: CanvasRenderingContext2D, parts: [string, string][], cx: number, y: number, size: number, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const widths = parts.map(([s]) => ctx.measureText(s).width);
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  parts.forEach(([s, c], i) => { ctx.fillStyle = c; ctx.fillText(s, x, y); x += widths[i]; });
}

function chip(ctx: CanvasRenderingContext2D, s: string, cx: number, y: number, size: number, bg: string, color: string): number {
  ctx.font = `600 ${size}px ${FONT}`;
  const w = ctx.measureText(s).width + size * 1.4;
  const h = size * 2;
  rr(ctx, cx - w / 2, y, w, h, size * 0.5, bg);
  text(ctx, s, cx, y + h * 0.68, size, color, 600);
  return w;
}

export async function drawCard(d: CardData, link: string): Promise<Blob> {
  try { await (document as any).fonts?.ready; } catch { /* 무시 */ }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const X = 56, CW = W - X * 2;
  rr(ctx, X, 48, CW, H - 96, 56, C.card);
  const cx = W / 2;

  // 상단 브랜드
  ctx.font = `700 34px ${FONT}`;
  const brandW = ctx.measureText('말뚝').width;
  const chipLabel = d.honor ? '명예 전역' : '전역';
  ctx.font = `600 26px ${FONT}`;
  const chipW = ctx.measureText(chipLabel).width + 36;
  const startX = cx - (brandW + 16 + chipW) / 2;
  text(ctx, '말뚝', startX, 128, 34, C.ink, 700, 'left');
  rr(ctx, startX + brandW + 16, 96, chipW, 46, 12, C.oliveT);
  text(ctx, chipLabel, startX + brandW + 16 + chipW / 2, 128, 26, C.olive, 600);

  // 계급장 + 약장 판
  const HX = X + 48, HY = 172, HW = CW - 96, HH = 300;
  rr(ctx, HX, HY, HW, HH, 40, C.panel);
  const ins = await svgImage(insignia(d.finalRank, 200));
  const insW = Math.min(ins.width || 200, d.ribbons.length ? HW * 0.42 : HW * 0.7);
  const insH = (ins.height || 200) * (insW / (ins.width || 200));
  if (d.ribbons.length) {
    const rack = await svgImage(ribbonRack(d.ribbons, 64, 4));
    const rw = Math.min(rack.width * 1.45, HW * 0.46);
    const rh = rack.height * (rw / rack.width);
    const gap = 40;
    const total = insW + gap + rw;
    const sx = HX + (HW - total) / 2;
    ctx.drawImage(ins, sx, HY + (HH - insH) / 2, insW, insH);
    ctx.drawImage(rack, sx + insW + gap, HY + (HH - rh) / 2, rw, rh);
  } else {
    ctx.drawImage(ins, cx - insW / 2, HY + (HH - insH) / 2, insW, insH);
  }

  // 문구와 제목
  text(ctx, `“${d.quote}”`, cx, 540, 32, C.sub, 500);
  const tail = ro(d.finalRank).slice(d.finalRank.length);
  if (d.honor) {
    runs(ctx, [[d.finalRank, C.olive], [`${tail} 명예롭게`, C.ink]], cx, 616, 60);
    runs(ctx, [['전역해요', C.ink]], cx, 690, 60);
  } else {
    runs(ctx, [[d.finalRank, C.olive], [`${tail} 전역해요`, C.ink]], cx, 650, 60);
  }
  text(ctx, `${d.nickname} · ${d.origin} · ${d.startYear}–${d.endYear} · ${d.years}년 복무`, cx, 744, 28, C.faint, 500);

  // 상위 %
  const PY = 784, PH = 200;
  rr(ctx, HX, PY, HW, PH, 36, C.panel2);
  text(ctx, `상위 ${d.pct}%`, cx, PY + 96, 76, C.olive, 700);
  text(ctx, `동기 ${d.cohort}명 중 ${d.finalRank} 이상까지 간 사람`, cx, PY + 146, 30, C.ink, 500);
  text(ctx, `${d.same}명 · 같은 해 임관한 동기 기준`, cx, PY + 182, 24, C.faint, 500);

  // 숫자 셋
  const cols = [[`${d.su}회`, "평정 '탁월'"], [`${d.clean}년`, '무사고 지휘'], [`${d.awards}회`, '표창']];
  cols.forEach(([v, l], i) => {
    const x = HX + (HW / 3) * (i + 0.5);
    text(ctx, v, x, 1066, 46, C.ink, 700);
    text(ctx, l, x, 1106, 26, C.sub, 500);
  });

  // 칭호·약장 칩
  const best = d.ribbons.slice().sort((a, b) => b.tierIndex - a.tierIndex)[0];
  const chips: [string, string, string][] = [];
  if (d.title) chips.push([`칭호 · ${d.title}`, C.oliveT, C.olive]);
  chips.push([best ? `${best.name}${best.tier ? ` ${best.tier}` : ''} · 약장 ${d.ribbons.length}` : '약장 0', C.chip, C.ink]);
  ctx.font = `600 26px ${FONT}`;
  const ws = chips.map(([s]) => ctx.measureText(s).width + 36.4);
  let x = cx - (ws.reduce((a, b) => a + b, 0) + 16 * (ws.length - 1)) / 2;
  chips.forEach(([s, bg, c], i) => { chip(ctx, s, x + ws[i] / 2, 1140, 26, bg, c); x += ws[i] + 16; });

  if (d.luck) {
    const l = d.luck;
    text(ctx, `운 지수 · 기대 ${l.exp}회 → 실제 ${l.hit}회 · ${l.pct >= 50 ? `운 상위 ${Math.max(1, 100 - l.pct)}%` : `운 하위 ${Math.max(1, l.pct)}%`}`, cx, 1204, 24, C.sub, 600);
  }

  // 하단
  text(ctx, '나는 몇 성까지 갈 수 있을까?', cx, 1250, 30, C.olive, 700);
  if (link) text(ctx, link, cx, 1288, 22, C.faint, 500);

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('이미지를 만들지 못했어요'))), 'image/png'));
}

/** 폰: 공유 창(사진 저장·인스타 등) / PC: 파일 다운로드 */
export async function saveCardImage(d: CardData, link: string): Promise<'shared' | 'downloaded'> {
  const blob = await prepareCard(d, link);
  const file = new File([blob], `malttuk-${d.nickname}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '말뚝' }); return 'shared'; } catch (e) { if ((e as Error).name === 'AbortError') return 'shared'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

// ── 카드 이미지 미리 만들기: 공유 버튼을 누른 순간 바로 공유 창을 띄우려고 (모바일은 누른 직후에만 공유가 허용돼요) ──
const ready = new Map<string, Promise<Blob>>();
const keyOf = (d: CardData) => `${d.nickname}|${d.finalRank}|${d.years}|${d.endYear}|${d.title ?? ''}`;
export function prepareCard(d: CardData, link: string): Promise<Blob> {
  const k = keyOf(d);
  if (!ready.has(k)) ready.set(k, drawCard(d, link));
  return ready.get(k)!;
}

/** 이미지 + 문구 + 링크를 한 번에 공유. 이미지 공유가 안 되는 환경이면 'fallback' */
export async function shareCardImage(d: CardData, link: string, text: string, url: string): Promise<'shared' | 'fallback' | 'retry'> {
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (!nav.share || !nav.canShare) return 'fallback';
  const blob = await prepareCard(d, link);
  const file = new File([blob], `malttuk-${d.nickname}.png`, { type: 'image/png' });
  if (!nav.canShare({ files: [file] })) return 'fallback';
  try {
    void url; // 링크를 넣으면 카톡이 미리보기를 또 만들어서 이미지 + 한 줄만 보낸다 (이미지에 주소가 찍혀 있음)
    await navigator.share({ files: [file], text });
    return 'shared';
  } catch (e) {
    const n = (e as Error).name;
    if (n === 'AbortError') return 'shared';
    if (n === 'NotAllowedError') return 'retry';
    return 'fallback';
  }
}
