// 구글 애널리틱스(GA4). index.html의 <meta name="ga-id" content="G-..."> 값이 있을 때만 켜져요.
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void } }

let on = false;
export function initAnalytics() {
  const id = document.querySelector<HTMLMetaElement>('meta[name="ga-id"]')?.content.trim() ?? '';
  if (!/^G-[A-Z0-9]{4,}$/.test(id) || !location.protocol.startsWith('http')) return;
  const s = document.createElement('script');
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer!.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
  on = true;
}

export function track(name: string, params: Record<string, string | number | boolean> = {}) {
  if (!on) return;
  try { window.gtag?.('event', name, params); } catch { /* 무시 */ }
}
