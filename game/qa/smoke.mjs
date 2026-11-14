// 자동 QA: 빌드된 dist/index.html을 휴대폰 크기(390×844)로 열어 주요 화면을 눌러 보고,
// 화면 오류(pageerror)가 0개인지 확인하고 스크린샷을 남긴다. 서버(Supabase)는 가짜 응답.
// 실행: npm run build && npm run qa   →   결과 game/qa/shots/*.png
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = 'qa/shots';
mkdirSync(OUT, { recursive: true });
const html = readFileSync('dist/index.html');
const server = createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); }).listen(0);
const url = `http://localhost:${server.address().port}/`;

const H = { 'content-range': '0-0/37', 'access-control-expose-headers': 'content-range', 'access-control-allow-origin': '*' };
const COHORT = { id: 'c1', code: 'AB12CD', name: '임관 동기 모임', seed: 4242, created_by: 'u9', created_at: '2026-11-13T00:00:00Z', closes_at: '2099-01-01T00:00:00Z', max_members: 30 };
async function mock(route) {
  const u = route.request().url(), m = route.request().method();
  if (u.includes('/auth/v1/')) return route.fulfill({ json: { access_token: 'x', refresh_token: 'y', expires_in: 3600, user: { id: 'u1' } } });
  if (u.includes('/rest/v1/cohorts')) return route.fulfill({ json: m === 'POST' ? [COHORT] : u.includes('AB12CD') ? [COHORT] : [] });
  if (u.includes('/rest/v1/guestbook')) return route.fulfill({ json: [{ id: 1, user_id: 'u5', nickname: '말뚝러', body: '재밌어요', reply: '고마워요', created_at: new Date().toISOString() }] });
  if (u.includes('/rest/v1/runs') && m === 'POST') return route.fulfill({ json: [{ id: 'run1' }] });
  return route.fulfill({ json: [], headers: H });
}

const errors = [];
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/supabase\.co/, mock);
await page.route(/(googlesyndication|googletagmanager|google-analytics|kakao|fonts\.g)/, (r) => r.abort());
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
const step = async (name, fn) => { try { await fn(); await page.waitForTimeout(400); await shot(name); console.log('✓', name); } catch (e) { errors.push(`${name}: ${e.message}`); console.log('✗', name, e.message); } };

await step('01_lobby', async () => { await page.goto(url); await page.waitForTimeout(600); });
await step('02_daily_candidates', async () => { await page.click('[data-act=daily-go]'); await page.fill('#nm', '테스트'); await page.click('[data-act=p-apply]'); });
await step('03_free_candidates', async () => { await page.goto(url); await page.click('[data-act=start-new]'); await page.fill('#nm', '테스트'); await page.click('[data-act=p-apply]'); });
await step('04_cohort_hub', async () => { await page.goto(url + '#/cohort'); });
await step('05_cohort_page', async () => { await page.goto(url + '#/c/AB12CD'); await page.reload(); await page.waitForTimeout(600); });
await step('06_guestbook', async () => { await page.goto(url + '#/guestbook'); await page.reload(); });
await step('07_rank', async () => { await page.goto(url + '#/rank'); await page.reload(); });
await step('08_notice', async () => { await page.goto(url + '#/notice'); await page.reload(); });

await browser.close();
server.close();
console.log(errors.length ? `\n오류 ${errors.length}개:\n- ${errors.join('\n- ')}` : '\n오류 0개 · 스크린샷: qa/shots/');
process.exit(errors.length ? 1 : 0);
