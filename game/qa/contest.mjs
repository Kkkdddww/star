// v3.3 대항전 QA: 2026-12-02(수)로 시계를 맞추고, 대항전 서버 응답을 가짜로 채워서 화면을 연다.
// 실행: npm run build && node qa/contest.mjs   →   결과 game/qa/shots/c*.png
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = 'qa/shots';
mkdirSync(OUT, { recursive: true });
const html = readFileSync('dist/index.html');
const server = createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); }).listen(0);
const url = `http://localhost:${server.address().port}/`;

const W = '2026-11-30';
// 구글로 연결된 계정처럼 보이는 가짜 토큰 (서명 없음, 화면 확인용)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'none' })}.${b64({ sub: 'u1', is_anonymous: false, app_metadata: { provider: 'google', providers: ['google'] } })}.x`;
const team = (id, code, name, no, ribbon, motto = null, pub = true, by = 'u9') => ({ id, code, name, seed: 1, created_by: by, created_at: '2026-11-20T03:00:00Z', closes_at: '2999-12-31T00:00:00Z', max_members: 30, kind: 'contest', no, ribbon, motto, public: pub });
const T1 = team('t1', 'TEAM01', '임관 동기 모임', 128, [0, 0, 1], '끝까지 말뚝', true, 'u9');
const T2 = team('t2', 'TEAM02', '파도 소대', 31, [1, 1, 0], '한 계급씩');
const T3 = team('t3', 'TEAM03', '새벽 점호', 57, [2, 2, 1]);
const T4 = team('t4', 'TEAM04', '혼자 왔어요', 203, [5, 3, 0], '누구나 환영');
const board = [
  { cohort_id: 't2', week: W, n: 9, score: 812, name: T2.name, no: 31, ribbon: T2.ribbon, code: 'TEAM02', place: 1 },
  { cohort_id: 't3', week: W, n: 6, score: 781, name: T3.name, no: 57, ribbon: T3.ribbon, code: 'TEAM03', place: 2 },
  { cohort_id: 't4', week: W, n: 3, score: 721, name: T4.name, no: 203, ribbon: T4.ribbon, code: 'TEAM04', place: 3 },
  { cohort_id: 't1', week: W, n: 4, score: 706, name: T1.name, no: 128, ribbon: T1.ribbon, code: 'TEAM01', place: 4 },
];
const members = ['u9', 'u1', 'u3', 'u4', 'u5', 'u6', 'u7'].map((u, i) => ({ cohort_id: 't1', user_id: u, seq: i + 1, joined_at: i < 2 ? '2026-11-20T03:00:00Z' : '2026-11-25T03:00:00Z' }));
const NICK = { u9: '새벽행군', u1: '테스트', u3: '김중위', u4: '말뚝박기', u5: '홍길동', u6: '이병장', u7: '박소위' };
const run = (u, rank, ri, honor) => ({ id: `r-${u}`, user_id: u, nickname: NICK[u], origin: '학군', branch: '전투', final_rank: rank, rank_index: ri, best_billet: '여단장', best_prestige: 3, years: 28, su_count: 8, ribbons: [], title: null, quote: null, ended_on: '2026-12-01', created_at: '2026-12-01T03:00:00Z', honor, mode: 'contest' });
const wruns = [run('u9', '준장', 6, 182), run('u1', '대령', 5, 171), run('u3', '대령', 5, 150), run('u4', '중령', 4, 120)];
const daily = [run('u9', '소장', 7, 231), run('u5', '소장', 7, 219), run('u3', '준장', 6, 240)].map((r) => ({ ...r, mode: 'daily' }));

async function mock(route) {
  const u = decodeURIComponent(route.request().url()), m = route.request().method();
  const j = (json, headers) => route.fulfill({ json, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': '0-0/412', ...(headers ?? {}) } });
  if (u.includes('/auth/v1/')) return j({ access_token: 'x', refresh_token: 'y', expires_in: 3600, user: { id: 'u1' } });
  if (m !== 'GET') return j([T1]);
  if (u.includes('/members?user_id=eq.u1')) return j([{ cohort_id: 't1', user_id: 'u1', seq: 2, joined_at: '2026-11-20T03:00:00Z', cohorts: T1 }]);
  if (u.includes('/members?cohort_id=eq.t1')) return j(members);
  if (u.includes('/members?cohort_id=in.')) return j([{ cohort_id: 't4' }, { cohort_id: 't4' }]);
  if (u.includes('/contest_results?week=eq.2026-11-23')) return j([]);
  if (u.includes('/contest_results?week=')) return j(board);
  if (u.includes('/contest_results?cohort_id=eq.t2')) return j([{ ...board[0] }, { ...board[0], week: '2026-11-23', score: 798, place: 1 }]);
  if (u.includes('/contest_results?cohort_id=')) return j([board[3], { ...board[3], week: '2026-11-23', score: 690, place: 2 }]);
  if (u.includes('/team_honors')) return j([{ cohort_id: 't2', weeks: 2, podiums: 2, wins: 1 }, { cohort_id: 't3', weeks: 1, podiums: 1, wins: 0 }, { cohort_id: 't1', weeks: 1, podiums: 1, wins: 0 }]);
  if (u.includes('/cohorts?code=eq.TEAM01')) return j([T1]);
  if (u.includes('/cohorts?code=eq.TEAM02')) return j([T2]);
  if (u.includes('/cohorts?kind=eq.contest')) return j([T4, T1]);
  if (u.includes('/runs?') && u.includes('mode=eq.contest')) return j(wruns);
  if (u.includes('/runs?') && u.includes('mode=eq.daily')) return j(daily);
  if (u.includes('/profiles?id=in.') && u.includes('main_cohort')) return j([{ id: 'u9', main_cohort: 't1', cohorts: { ribbon: T1.ribbon, no: 128, name: T1.name } }, { id: 'u3', main_cohort: 't3', cohorts: { ribbon: T3.ribbon, no: 57, name: T3.name } }]);
  if (u.includes('/profiles?id=in.')) return j(Object.entries(NICK).map(([id, nickname]) => ({ id, nickname })));
  if (u.includes('/profiles?id=eq.u1')) return j([{ id: 'u1', nickname: '테스트', equipped_title: null, main_cohort: 't1', serial: 1247, created_at: '2026-11-10T00:00:00Z' }]);
  if (u.includes('/profiles?id=eq.u9')) return j([{ id: 'u9', nickname: '새벽행군', equipped_title: '정공법', main_cohort: 't1', serial: 88, created_at: '2026-11-11T00:00:00Z' }]);
  if (u.includes('/profiles?select=id&nickname=')) return j([], { 'content-range': '0-0/3' });
  if (u.includes('/profile_stats')) return j([{ user_id: 'u9', runs: 142, generals: 11, fourstars: 2, best_rank: 9, best_free: 9, daily_days: 9, contest_weeks: 1, xp: 5230 }]);
  if (u.includes('/daily_places')) return j([{ day: '2026-11-18', place: 2, total: 412 }]);
  if (u.includes('/members?user_id=eq.u9')) return j([{ cohort_id: 't1', user_id: 'u9', seq: 1, joined_at: '2026-11-20T03:00:00Z', cohorts: T1 }]);
  if (u.includes('/runs?select=ribbons')) return j([{ ribbons: [{ id: 'cheongun', t: 4 }, { id: 'seongjwa', t: 0 }, { id: 'gongjeok', t: 2 }, { id: 'jungchu', t: 0 }] }]);
  if (u.includes('/runs?') && u.includes('user_id=eq.')) return j([...daily, ...wruns]);
  return j([]);
}

const errors = [];
const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.clock.install({ time: new Date('2026-12-02T03:00:00Z') });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/supabase\.co/, mock);
await page.route(/(googlesyndication|googletagmanager|google-analytics|kakao|fonts\.g)/, (r) => r.abort());
const step = async (name, fn, full = false) => { try { await fn(); await page.waitForTimeout(500); if (full) await page.addStyleTag({ content: '.bar{position:static!important;transform:none!important;margin:0 auto}' }); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('✓', name); } catch (e) { errors.push(`${name}: ${e.message}`); console.log('✗', name, e.message); } };

await page.goto(url);
await page.evaluate((tok) => {
  localStorage.setItem('sowi-to-star-session', JSON.stringify({ access_token: tok, refresh_token: 'y', expires_at: 4102444800, user_id: 'u1' }));
  localStorage.setItem('malttuk-daily-v1', 'null');
}, JWT);
await step('c01_lobby_daily', async () => { await page.reload(); await page.waitForTimeout(800); });
await step('c02_lobby_contest', async () => { await page.click('[data-act=lobby-tab][data-v=c]'); });
await step('c03_lobby_free', async () => { await page.click('[data-act=lobby-tab][data-v=f]'); });
await step('c04_contest', async () => { await page.goto(url + '#/contest'); await page.reload(); await page.waitForTimeout(800); }, true);
await step('c05_team', async () => { await page.goto(url + '#/c/TEAM01'); await page.reload(); await page.waitForTimeout(900); }, true);
await step('c06_team_new', async () => { await page.goto(url); await page.reload(); await page.click('[data-act=lobby-tab][data-v=c]'); await page.goto(url + '#/contest'); await page.waitForTimeout(400); await page.click('.bar [data-act=team-new]'); await page.fill('#tname', '산 넘어 산'); await page.click('[data-act=rib-p][data-v="3"]'); }, true);
await step('c07_award', async () => { await page.goto(url + '#/award/TEAM02/2026-11-23'); await page.reload(); await page.waitForTimeout(800); }, true);
await step('c08_rank', async () => { await page.goto(url + '#/rank'); await page.reload(); await page.waitForTimeout(800); });
await step('c10_person', async () => { await page.goto(url + '#/p/u9'); await page.reload(); await page.waitForTimeout(900); }, true);
await step('c11_person_me', async () => { await page.goto(url + '#/p/me'); await page.reload(); await page.waitForTimeout(900); }, true);
await step('c12_settings', async () => { await page.goto(url + '#/settings'); await page.reload(); await page.waitForTimeout(500); }, true);
await step('c09_contest_start', async () => { await page.goto(url); await page.reload(); await page.click('[data-act=lobby-tab][data-v=c]'); await page.click('.lcard [data-act=contest-go]'); await page.waitForTimeout(300); await page.fill('#nm', '테스트'); await page.click('[data-act=p-apply]'); });

await browser.close();
server.close();
console.log(errors.length ? `\n오류 ${errors.length}개:\n- ${errors.join('\n- ')}` : '\n오류 0개 · 스크린샷: qa/shots/c*.png');
process.exit(errors.length ? 1 : 0);
