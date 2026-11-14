// 광고: 배너(카카오 애드핏) + 보상형(애드센스 H5 게임 광고)
// index.html의 <meta name="adfit-*">, <meta name="adsense-client"> 값이 비어 있으면 아무것도 불러오지 않아요.
// 플레이 화면(결재, 진급, 인사 등)에는 배너 자리를 두지 않아요.

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (o: Record<string, unknown>) => void;
    adConfig?: (o: Record<string, unknown>) => void;
    adfit?: { render?: (el: Element) => void; destroy?: (unit: string) => void };
  }
}

export type BannerSlot = 'lobby' | 'rank' | 'gallery' | 'card' | 'notice';
const SIZE: Record<BannerSlot, [number, number]> = {
  lobby: [320, 100], rank: [320, 100], gallery: [300, 250], card: [300, 250], notice: [320, 100],
};
const meta = (n: string) => document.querySelector<HTMLMetaElement>(`meta[name="${n}"]`)?.content.trim() ?? '';
const unitOf = (s: BannerSlot) => meta(`adfit-${s}`);
const http = () => location.protocol.startsWith('http');

// ── 배너 ──
/** 화면 HTML 안에 넣는 자리표시. 광고단위가 없으면 빈 문자열 */
export function adSlot(s: BannerSlot): string {
  if (!unitOf(s)) return '';
  const [w, h] = SIZE[s];
  return `<div class="adslot" data-slot="${s}"><span class="adlabel">광고</span><div class="adin" style="min-height:${h}px;max-width:${w}px"></div></div>`;
}

let adfitLoaded = false;
// 광고가 안 채워지면 빈 칸 대신 자리를 숨겨요
if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).malttukAdFail = (el: Element) => { const box = el?.closest?.('.adslot') as HTMLElement | null; if (box) box.style.display = 'none'; };
function loadAdfit() {
  if (adfitLoaded || !http()) return;
  adfitLoaded = true;
  const s = document.createElement('script');
  s.async = true; s.src = 'https://t1.daumcdn.net/kas/static/ba.min.js';
  document.body.appendChild(s);
}

/** 같은 페이지 안에서 다시 그려질 때는 이미 만든 광고를 옮겨 붙이고, 페이지가 바뀔 때만 새로 불러와요 */
let pageKey = '';
const live = new Map<BannerSlot, HTMLElement>();
export function mountAds(key: string) {
  const slots = document.querySelectorAll<HTMLElement>('.adslot');
  if (key !== pageKey) {
    for (const [s, el] of live) { const u = unitOf(s); try { if (u) window.adfit?.destroy?.(u); } catch { /* 무시 */ } el.remove(); }
    live.clear();
    pageKey = key;
  }
  if (!slots.length) return;
  for (const slot of slots) {
    const s = slot.dataset.slot as BannerSlot;
    const box = slot.querySelector('.adin')!;
    const old = live.get(s);
    if (old) { box.appendChild(old); continue; }
    const [w, h] = SIZE[s];
    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', unitOf(s));
    ins.setAttribute('data-ad-width', String(w));
    ins.setAttribute('data-ad-height', String(h));
    ins.setAttribute('data-ad-onfail', 'malttukAdFail');
    box.appendChild(ins);
    live.set(s, ins);
    if (adfitLoaded && window.adfit?.render) { try { window.adfit.render(ins); } catch { /* 무시 */ } }
  }
  loadAdfit();
}

// ── 보상형 (애드센스 H5 게임 광고) ──
let h5 = false;
export function initRewarded() {
  const client = meta('adsense-client');
  if (!/^ca-pub-\d+$/.test(client) || !http()) return;
  // H5 게임 광고(보상형) 승인 전에는 꺼 둬요. 켜면 광고를 기다리느라 버튼이 몇 초 멈춰요.
  if (meta('adsense-rewarded') !== 'on') return;
  // 애드센스 코드는 index.html <head>에 이미 있어요(사이트 확인용). 없을 때만 붙여요.
  const exist = document.querySelector<HTMLScriptElement>('script[src*="adsbygoogle.js"]');
  if (exist) { if (meta('adsense-test') === 'on') exist.setAttribute('data-adbreak-test', 'on'); }
  else {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    s.crossOrigin = 'anonymous';
    if (meta('adsense-test') === 'on') s.setAttribute('data-adbreak-test', 'on');
    document.head.appendChild(s);
  }
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adConfig = (o) => { window.adsbygoogle!.push(o); };
  window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
  h5 = true;
}
/** 보상형 광고가 연결돼 있는지 (버튼 문구용) */
export const rewardedOn = () => h5;

/**
 * 보상형 광고를 보여줘요.
 * - 'viewed': 끝까지 봄 → 보상
 * - 'dismissed': 중간에 닫음 → 보상 없음
 * - 'unavailable': 광고 없음·차단·미승인 → 무료로 보상
 */
export function showRewarded(name: string): Promise<'viewed' | 'dismissed' | 'unavailable'> {
  if (!h5 || !window.adBreak) return Promise.resolve('unavailable');
  return new Promise((resolve) => {
    let done = false, started = false;
    const finish = (r: 'viewed' | 'dismissed' | 'unavailable') => { if (!done) { done = true; resolve(r); } };
    const timer = setTimeout(() => { if (!started) finish('unavailable'); }, 2000);
    try {
      window.adBreak!({
        type: 'reward', name,
        beforeReward: (showAdFn: () => void) => { started = true; clearTimeout(timer); showAdFn(); },
        adViewed: () => finish('viewed'),
        adDismissed: () => finish('dismissed'),
        adBreakDone: (info: { breakStatus?: string }) => { clearTimeout(timer); finish(info?.breakStatus === 'viewed' ? 'viewed' : started ? 'dismissed' : 'unavailable'); },
      });
    } catch { clearTimeout(timer); finish('unavailable'); }
  });
}
