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
  // v3.3.8 홈 화면 앱으로 열었는지 (GA 사용자 속성 app_mode: app / web, 앱으로 열 때마다 app_open 이벤트)
  let app = false; try { app = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true; } catch { /* 무시 */ }
  window.gtag('set', 'user_properties', { app_mode: app ? 'app' : 'web' });
  window.gtag('config', id);
  on = true;
  if (app) track('app_open');
}

export function track(name: string, params: Record<string, string | number | boolean> = {}) {
  if (!on) return;
  try { window.gtag?.('event', name, params); } catch { /* 무시 */ }
}
