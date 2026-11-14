// 자동 QA: 빌드된 dist/index.html을 휴대폰 크기(390×844)로 열어 주요 화면을 눌러 보고,
// 화면 오류(pageerror)가 0개인지 확인하고 스크린샷을 남긴다. 서버(Supabase)는 가짜 응답.
// 실행: npm run build && npm run qa   →   결과 game/qa/shots/*.png
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
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
// 미리 깔린 브라우저가 있으면 그것을 쓴다 (설치된 playwright와 버전이 달라도 동작)
const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
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

// v3.2: 시즌 2 순위, 토요일(S 기수) 오늘의 기수, 오늘의 기수 전역 화면(qa/daily_end.json 있으면)
await step('09_rank_season', async () => { await page.goto(url + '#/rank'); await page.reload(); await page.selectOption('#rday', '-1'); });
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.clock.install({ time: new Date('2026-11-21T03:00:00Z') });
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.route(/supabase\.co/, mock);
  await p2.route(/(googlesyndication|googletagmanager|google-analytics|kakao|fonts\.g)/, (r) => r.abort());
  const s2 = async (name, fn) => { try { await fn(); await p2.waitForTimeout(400); await p2.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log('✓', name); } catch (e) { errors.push(`${name}: ${e.message}`); console.log('✗', name, e.message); } };
  await s2('10_sat_lobby', async () => { await p2.goto(url); await p2.evaluate(() => localStorage.setItem('sowi-to-star-session', JSON.stringify({ access_token: 'x', refresh_token: 'y', expires_at: 4102444800, user_id: 'u1' }))); await p2.reload(); await p2.waitForTimeout(800); });
  await s2('11_sat_candidates', async () => { await p2.click('[data-act=daily-go]'); await p2.fill('#nm', '테스트'); await p2.click('[data-act=p-apply]'); });
  let end = null; try { end = readFileSync('qa/daily_end.json', 'utf8'); } catch { /* 없으면 건너뜀 */ }
  if (end) await s2('12_daily_end', async () => { await p2.evaluate((v) => localStorage.setItem('malttuk-daily-v1', v), end); await p2.goto(url); await p2.click('[data-act=daily-go]'); await p2.waitForTimeout(600); });
  await ctx.close();
}

await browser.close();
server.close();
console.log(errors.length ? `\n오류 ${errors.length}개:\n- ${errors.join('\n- ')}` : '\n오류 0개 · 스크린샷: qa/shots/');
process.exit(errors.length ? 1 : 0);
