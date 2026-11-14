// Supabase 연결 (라이브러리 없이 REST로 직접). 공개용 키만 쓴다. service_role 키는 절대 여기 넣지 않는다.
// 데이터 보호는 Supabase 쪽 행 단위 권한(RLS)이 맡는다: 누구나 읽기, 쓰기는 본인 것만.
export const SUPABASE_URL = 'https://mbjmppksxxfdbeuywepf.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_h_WjpVGOQxVO-pXLZdRvww_iINPqsMa';

const SESSION_KEY = 'sowi-to-star-session';
interface Session { access_token: string; refresh_token: string; expires_at: number; user_id: string }

function loadSession(): Session | null { try { const r = localStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveSession(s: Session | null) { try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch { /* 무시 */ } }

function toSession(j: any): Session {
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600), user_id: j.user?.id };
}

async function authPost(path: string, body: unknown): Promise<Session> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`로그인 실패 ${res.status}${/anonymous/i.test(body) ? ' · 익명 로그인이 꺼져 있어요' : ''}`);
  }
  return toSession(await res.json());
}

let pending: Promise<Session> | null = null;
/** 익명 로그인: 처음이면 계정을 만들고, 만료가 가까우면 갱신한다 */
export async function session(): Promise<Session> {
  if (pending) return pending;
  pending = (async () => {
    let s = loadSession();
    try {
      if (s && s.expires_at - 60 < Date.now() / 1000) s = await authPost('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
    } catch { s = null; }
    if (!s) s = await authPost('signup', { data: {} });
    saveSession(s);
    return s;
  })();
  try { return await pending; } finally { pending = null; }
}
export const myId = () => loadSession()?.user_id ?? null;

/** 서버 부담 줄이기: 자주 부르는 조회는 이 기기에 잠깐 보관해 두고 다시 쓴다 (ttl ms) */
export async function stash<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const k = `malttuk-cache:${key}`;
  try { const c = JSON.parse(localStorage.getItem(k) ?? 'null'); if (c && Date.now() - c.t < ttl) return c.v as T; } catch { /* 무시 */ }
  const v = await fn();
  try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch { /* 무시 */ }
  return v;
}
export function unstash(prefix: string) { try { for (const k of Object.keys(localStorage)) if (k.startsWith(`malttuk-cache:${prefix}`)) localStorage.removeItem(k); } catch { /* 무시 */ } }

// ── v3.3 로그인: 지금 익명 계정에 구글 · 카카오 연결 ──
export type Provider = 'google' | 'kakao';
export const PROVIDER_NAME: Record<Provider, string> = { google: '구글', kakao: '카카오' };
const RETURN_KEY = 'malttuk-auth-return';
function jwt(token: string): Record<string, any> | null {
  try {
    let b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  } catch { return null; }
}
/** 소셜 로그인과 연결된 계정인지 */
export function loginInfo(): { linked: boolean; provider: Provider | null } {
  const s = loadSession();
  const p = s ? jwt(s.access_token) : null;
  if (!p) return { linked: false, provider: null };
  const list: string[] = p.app_metadata?.providers ?? [p.app_metadata?.provider].filter(Boolean);
  const pv = (list.find((x) => x === 'google' || x === 'kakao') ?? null) as Provider | null;
  return { linked: p.is_anonymous === false && !!pv, provider: pv };
}
const backUrl = () => `${location.origin}${location.pathname}`;
/** 지금 계정(기록 그대로)에 소셜 로그인 연결 → 그 회사 화면으로 이동했다가 돌아온다 */
export async function linkProvider(p: Provider): Promise<void> {
  const s = await session();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user/identities/authorize?provider=${p}&redirect_to=${encodeURIComponent(backUrl())}&skip_http_redirect=true`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(/manual linking/i.test(body) ? '계정 연결이 아직 꺼져 있어요 (운영 설정 필요)' : /provider/i.test(body) ? `${PROVIDER_NAME[p]} 로그인이 아직 준비 중이에요` : `연결하지 못했어요 ${res.status}`);
  }
  const { url } = await res.json();
  try { localStorage.setItem(RETURN_KEY, `link:${p}`); } catch { /* 무시 */ }
  location.href = url;
}
/** 다른 기기에서 쓰던 계정으로 로그인 (이 기기의 익명 기록은 이어지지 않음) */
export function signInProvider(p: Provider) {
  try { localStorage.setItem(RETURN_KEY, `signin:${p}`); } catch { /* 무시 */ }
  location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=${p}&redirect_to=${encodeURIComponent(backUrl())}`;
}
/** 로그인 화면에서 돌아왔을 때: 주소 뒤에 붙은 토큰을 저장하고 주소를 깨끗하게 */
export function consumeAuthReturn(): { kind: 'link' | 'signin'; ok: boolean; msg?: string; conflict?: Provider } | null {
  const h = location.hash.replace(/^#/, '') + '&' + location.search.replace(/^\?/, '');
  if (!/access_token=|error=/.test(h)) return null;
  const q = new URLSearchParams(h);
  let kind: 'link' | 'signin' = 'link', prov: Provider | undefined;
  try { const r = localStorage.getItem(RETURN_KEY) ?? 'link'; [kind, prov] = r.split(':') as ['link' | 'signin', Provider | undefined]; localStorage.removeItem(RETURN_KEY); } catch { /* 무시 */ }
  history.replaceState(null, '', location.pathname);
  if (q.get('error')) {
    const d = q.get('error_description') ?? '';
    if (/already linked|already exists|identity_already_exists|identity is already/i.test(d)) return { kind, ok: false, conflict: prov ?? 'google', msg: '이미 말뚝 계정이 있는 로그인이에요' };
    return { kind, ok: false, msg: `로그인하지 못했어요 · ${d.slice(0, 60) || '다시 시도해 주세요'}` };
  }
  const at = q.get('access_token'), rt = q.get('refresh_token');
  const p = at ? jwt(at) : null;
  if (!at || !rt || !p?.sub) return { kind, ok: false, msg: '로그인하지 못했어요. 다시 시도해 주세요' };
  saveSession({ access_token: at, refresh_token: rt, expires_at: Math.floor(Date.now() / 1000) + Number(q.get('expires_in') ?? 3600), user_id: p.sub });
  return { kind, ok: true };
}
/** 로그아웃: 이 기기는 새 익명 계정으로 시작 */
export function logout() { saveSession(null); }
/** 계정 삭제: 서버의 내 기록 · 프로필 · 기수 소속 · 로그인 계정 */
export async function deleteAccount(): Promise<void> {
  const s = await session();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_me`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' }, body: '{}' });
  if (!res.ok) throw new Error(`지우지 못했어요 ${res.status}`);
  saveSession(null);
}

async function rest<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (auth) headers.Authorization = `Bearer ${(await session()).access_token}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let hint = '';
    if (/does not exist|relation/i.test(body)) hint = ' · 테이블이 없어요 (SQL 실행 필요)';
    else if (/violates check constraint/i.test(body)) hint = ' · 기록 값이 규칙에 걸렸어요';
    else if (/row-level security/i.test(body)) hint = ' · 권한 설정 문제';
    else if (/runs_daily_once/i.test(body)) throw new AlreadyError('오늘의 기수는 하루 한 번만 올릴 수 있어요');
    else if (/runs_cohort_once/i.test(body)) throw new AlreadyError('이 기수에는 이미 기록을 올렸어요');
    else if (/runs_contest_once/i.test(body)) throw new AlreadyError('이번 주 대항전 판은 이미 올렸어요');
    else if (/nick_taken/.test(body)) throw new Error('이미 다른 사람이 쓰는 닉네임이에요');
    else if (/nick_wait/.test(body)) throw new Error('닉네임은 7일에 한 번 바꿀 수 있어요');
    else if (/3곳까지/.test(body)) throw new Error('기수는 3곳까지 들어갈 수 있어요');
    else if (/정원이 다/.test(body)) throw new Error('정원 30명이 다 찼어요');
    else if (/members_pkey|duplicate key/i.test(body) && path.startsWith('members')) throw new Error('이미 들어간 기수예요');
    else if (/guestbook_rate/i.test(body)) throw new Error('1분에 한 번만 쓸 수 있어요');
    else if (/column .* does not exist|Could not find the .* column/i.test(body)) hint = ' · 서버 업데이트(SQL)가 필요해요';
    throw new Error(`서버 오류 ${res.status}${hint}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ── 데이터 ──
export interface RunRow {
  id: string; user_id: string; nickname: string; origin: string; branch: string; final_rank: string; rank_index: number;
  best_billet: string | null; best_prestige: number | null; years: number; su_count: number;
  ribbons: { id: string; t: number }[]; title: string | null; quote: string | null; rival_result: string | null;
  seed: number | null; choices: { log: unknown[]; card: CardExtra } | null; ended_on: string; created_at: string;
  /** v3: 오늘의 기수 */
  mode?: 'free' | 'daily' | 'cohort' | 'contest'; day?: string | null; honor?: number | null; cohort_id?: string | null; week?: string | null;
}
export interface CardExtra { luck?: { exp: number; hit: number; pct: number } | null; pct: number; same: number; cohort: number; clean: number; awards: number; start: number; end: number; honor: boolean; reason: string }
export type NewRun = Omit<RunRow, 'id' | 'user_id' | 'ended_on' | 'created_at'>;
export class AlreadyError extends Error {}

export interface Profile { id: string; nickname: string; equipped_title: string | null; main_cohort?: string | null; serial?: number | null; nick_changed_at?: string | null; created_at?: string }

/** 내 프로필. 로그인 서버(Auth)를 부르지 않는다: 이 기기에 계정이 없으면(처음 온 사람) 그냥 null.
 *  (v3.3.1 전에는 여기서 session()을 불러 방문자마다 익명 계정을 새로 만들어 Auth에 부담이 컸음) */
export async function getProfile(): Promise<Profile | null> {
  const id = myId();
  if (!id) return null;
  const rows = await rest<Profile[]>(`profiles?id=eq.${id}&select=*`);
  return rows[0] ?? null;
}
export async function saveProfile(nickname: string, title: string | null): Promise<void> {
  const s = await session();
  await rest('profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: s.user_id, nickname, equipped_title: title }) }, true);
}

export async function saveRun(run: NewRun): Promise<string> {
  const s = await session();
  const rows = await rest<RunRow[]>('runs', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...run, user_id: s.user_id }) }, true);
  return rows[0].id;
}

const LIST = 'id,user_id,nickname,origin,branch,final_rank,rank_index,best_billet,best_prestige,years,su_count,ribbons,title,quote,ended_on,created_at,honor,mode';
// v3.1: 세 모드 모두 계급 → 명예 점수 → 복무 기간 (명예 점수 없는 옛 기록은 같은 계급 맨 뒤)
const ORDER = 'order=rank_index.desc,honor.desc.nullslast,years.asc,created_at.asc';

export const getRun = async (id: string) => (await rest<RunRow[]>(`runs?id=eq.${encodeURIComponent(id)}&select=*`))[0] ?? null;
export const ranking = (date: string, origin: string | null, limit = 100) =>
  rest<RunRow[]>(`runs?select=${LIST}&mode=eq.free&ended_on=eq.${date}${origin ? `&origin=eq.${encodeURIComponent(origin)}` : ''}&${ORDER}&limit=${limit}`);
/** v3.2 명예의 전당 시즌: 시즌 2는 FAIR_FROM(잠재력 B안)부터. 한 사람당 최고 기록 하나만 */
export const SEASON2_FROM = '2026-11-15';
export async function seasonRanking(season: 1 | 2, origin: string | null, limit = 100): Promise<RunRow[]> {
  const range = season === 2 ? `ended_on=gte.${SEASON2_FROM}` : `ended_on=lt.${SEASON2_FROM}`;
  const rows = await rest<RunRow[]>(`runs?select=${LIST}&mode=eq.free&${range}${origin ? `&origin=eq.${encodeURIComponent(origin)}` : ''}&${ORDER}&limit=${limit * 4}`);
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.user_id) ? false : (seen.add(r.user_id), true))).slice(0, limit);
}
export const recentRuns = (limit = 30) => rest<RunRow[]>(`runs?select=${LIST}&order=created_at.desc&limit=${limit}`);
export const myRuns = async () => {
  const s = await session();
  return rest<RunRow[]>(`runs?select=${LIST}&user_id=eq.${s.user_id}&${ORDER}&limit=50`);
};

// ── 오늘의 기수 ──
const DLIST = `${LIST},day`;
const DORDER = 'order=rank_index.desc,honor.desc.nullslast,years.asc,created_at.asc';
export const dailyRanking = (day: string, limit = 100) => rest<RunRow[]>(`runs?select=${DLIST}&mode=eq.daily&day=eq.${day}&${DORDER}&limit=${limit}`);
export const dailyCount = (day: string) => stash(`dcount:${day}`, 2 * 60_000, () => dailyCountRaw(day));
async function dailyCountRaw(day: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/runs?select=id&mode=eq.daily&day=eq.${day}&limit=1`, { headers: { apikey: SUPABASE_KEY, Prefer: 'count=exact' } });
  if (!res.ok) throw new Error(`서버 오류 ${res.status}`);
  return Number(res.headers.get('content-range')?.split('/')[1] ?? 0) || 0;
}
/** 내 순위: 나보다 앞선 사람 수 + 1 */
export async function dailyPlace(day: string, r: { rank_index: number; honor: number; years: number }): Promise<number> {
  const q = `or=(rank_index.gt.${r.rank_index},and(rank_index.eq.${r.rank_index},honor.gt.${r.honor}),and(rank_index.eq.${r.rank_index},honor.eq.${r.honor},years.lt.${r.years}))`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/runs?select=id&mode=eq.daily&day=eq.${day}&${q}&limit=1`, { headers: { apikey: SUPABASE_KEY, Prefer: 'count=exact' } });
  if (!res.ok) throw new Error(`서버 오류 ${res.status}`);
  return (Number(res.headers.get('content-range')?.split('/')[1] ?? 0) || 0) + 1;
}
export interface ChoiceStat { def_id: string; option_key: string; n: number; ok: number }
export const dailyChoiceStats = (day: string) => rest<ChoiceStat[]>(`daily_choice_stats?day=eq.${day}&select=def_id,option_key,n,ok`);

/** 오늘 날짜 (한국 시간) */
export function today(offsetDays = 0, at?: string): string {
  const d = new Date((at ? Date.parse(at) : Date.now()) + 9 * 3600 * 1000 - offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

// ── 우리 기수 ──
export interface CohortRow {
  id: string; code: string; name: string; seed: number; created_by: string; created_at: string; closes_at: string; max_members: number;
  /** v3.3 대항전 기수 (SQL 전에는 없음) */
  kind?: 'friendly' | 'contest'; no?: number | null; ribbon?: number[] | null; motto?: string | null; public?: boolean;
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function createCohort(name: string): Promise<CohortRow> {
  const s = await session();
  for (let i = 0; i < 3; i++) {
    const code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    try {
      const rows = await rest<CohortRow[]>('cohorts', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ code, name, seed: Math.floor(Math.random() * 2e9), created_by: s.user_id }) }, true);
      return rows[0];
    } catch (e) { if (i === 2) throw e; }
  }
  throw new Error('만들지 못했어요');
}
export const getCohort = async (code: string) => (await rest<CohortRow[]>(`cohorts?code=eq.${encodeURIComponent(code.toUpperCase())}&select=*`))[0] ?? null;
export const cohortRuns = (id: string) => rest<RunRow[]>(`runs?select=${LIST},choices&mode=eq.cohort&cohort_id=eq.${id}&${DORDER}&limit=60`);

// ── v3.3 기수 대항전 ──
export interface TeamInput { name: string; motto: string; ribbon: number[]; public: boolean }
export async function createTeam(t: TeamInput): Promise<CohortRow> {
  const s = await session();
  for (let i = 0; i < 3; i++) {
    const code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    try {
      const rows = await rest<CohortRow[]>('cohorts', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ code, name: t.name, motto: t.motto || null, ribbon: t.ribbon, public: t.public, kind: 'contest', seed: Math.floor(Math.random() * 2e9), created_by: s.user_id }) }, true);
      return rows[0];
    } catch (e) { if (i === 2 || !(e instanceof Error) || !/409|duplicate/i.test(e.message)) throw e; }
  }
  throw new Error('만들지 못했어요');
}
export const updateTeam = (id: string, t: Partial<TeamInput>) => rest(`cohorts?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ...t, motto: t.motto === undefined ? undefined : t.motto || null }) }, true);
export const joinTeam = (cohortId: string) => rest('members', { method: 'POST', body: JSON.stringify({ cohort_id: cohortId }) }, true);
export const leaveTeam = async (cohortId: string) => rest(`members?cohort_id=eq.${cohortId}&user_id=eq.${(await session()).user_id}`, { method: 'DELETE' }, true);
export interface MemberRow { cohort_id: string; user_id: string; seq: number; joined_at: string }
export interface MyTeam extends MemberRow { cohorts: CohortRow }
/** 내가 들어간 대항전 기수 (로그인 전 익명 계정 포함) */
export const myTeams = async (): Promise<MyTeam[]> => {
  const me = myId();
  if (!me) return [];
  return rest<MyTeam[]>(`members?user_id=eq.${me}&select=cohort_id,user_id,seq,joined_at,cohorts(*)&order=joined_at.asc`);
};
export const teamMembers = (cohortId: string) => rest<MemberRow[]>(`members?cohort_id=eq.${cohortId}&select=cohort_id,user_id,seq,joined_at&order=seq.asc`);
export const memberCounts = (ids: string[]): Promise<Record<string, number>> => stash(`mcount:${[...ids].sort().join(',').slice(0, 300)}`, 2 * 60_000, () => memberCountsRaw(ids));
const memberCountsRaw = async (ids: string[]): Promise<Record<string, number>> => {
  if (!ids.length) return {};
  const rows = await rest<{ cohort_id: string }[]>(`members?cohort_id=in.(${ids.join(',')})&select=cohort_id`);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.cohort_id] = (out[r.cohort_id] ?? 0) + 1;
  return out;
};
export interface BoardRow { cohort_id: string; week: string; n: number; score: number; name: string; no: number | null; ribbon: number[] | null; code: string; place?: number }
export const contestBoard = (week: string, limit = 100) => rest<BoardRow[]>(`contest_results?week=eq.${week}&select=*&order=score.desc&limit=${limit}`);
/** 한 기수의 주별 기록 (연혁) */
export const teamHistory = (cohortId: string) => rest<BoardRow[]>(`contest_board?cohort_id=eq.${cohortId}&select=*&order=week.desc&limit=60`);
export const teamPlaces = (cohortId: string) => rest<BoardRow[]>(`contest_results?cohort_id=eq.${cohortId}&select=*&order=week.desc&limit=60`);
export interface Honors { cohort_id: string; weeks: number; podiums: number; wins: number }
export const teamHonors = async (ids: string[]): Promise<Honors[]> => (ids.length ? rest<Honors[]>(`team_honors?cohort_id=in.(${ids.join(',')})&select=*`) : []);
/** 지금까지 모인 대항전 기수 수 · 기수원 수 (시작 전 표시용) */
export const contestTotals = () => stash('totals', 5 * 60_000, contestTotalsRaw);
async function contestTotalsRaw(): Promise<{ teams: number; people: number }> {
  const cnt = async (path: string) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY, Prefer: 'count=exact' } });
    if (!res.ok) throw new Error(`서버 오류 ${res.status}`);
    return Number(res.headers.get('content-range')?.split('/')[1] ?? 0);
  };
  const [teams, people] = await Promise.all([cnt('cohorts?select=id&kind=eq.contest&limit=1'), cnt('members?select=user_id&limit=1')]);
  return { teams, people };
}
export const publicTeams = () => stash('public', 2 * 60_000, () => rest<CohortRow[]>(`cohorts?kind=eq.contest&public=eq.true&select=*&order=created_at.desc&limit=40`));
/** 그 주 대항전 판 (기수원들) */
export const weekRuns = (week: string, userIds: string[]) => (userIds.length ? rest<RunRow[]>(`runs?select=${LIST}&mode=eq.contest&week=eq.${week}&user_id=in.(${userIds.join(',')})&${DORDER}&limit=60`) : Promise.resolve([] as RunRow[]));
/** 닉네임 (프로필) */
export const nicknames = async (ids: string[]): Promise<Record<string, string>> => {
  if (!ids.length) return {};
  const rows = await rest<{ id: string; nickname: string }[]>(`profiles?id=in.(${ids.join(',')})&select=id,nickname`);
  return Object.fromEntries(rows.map((r) => [r.id, r.nickname]));
};
/** 랭킹 닉네임 옆 약장: 대표 기수 */
export interface TeamTag { id: string; nickname: string; xp?: number; main_cohort?: string | null; cohorts?: { ribbon: number[] | null; no: number | null; name: string } | null }
/** 랭킹 줄: 지금 닉네임 + 대표 기수. SQL 전이면 닉네임만 */
export const teamTags = async (ids: string[]): Promise<TeamTag[]> => {
  if (!ids.length) return [];
  try { return await rest<TeamTag[]>(`profiles?id=in.(${ids.join(',')})&select=id,nickname,xp,main_cohort,cohorts(ribbon,no,name)`); }
  catch { try { return await rest<TeamTag[]>(`profiles?id=in.(${ids.join(',')})&select=id,nickname,main_cohort,cohorts(ribbon,no,name)`); } catch { return rest<TeamTag[]>(`profiles?id=in.(${ids.join(',')})&select=id,nickname`); } }
};
/** 랭킹 줄 호봉: 여러 사람의 경험치 */
export const xpOf = async (ids: string[]): Promise<{ user_id: string; xp: number }[]> => (ids.length ? rest<{ user_id: string; xp: number }[]>(`profile_stats?user_id=in.(${ids.join(',')})&select=user_id,xp`) : []);
export const setMainTeam = async (cohortId: string | null) => rest(`profiles?id=eq.${(await session()).user_id}`, { method: 'PATCH', body: JSON.stringify({ main_cohort: cohortId }) }, true);

// ── v3.3 인사기록카드 ──
export interface Stats { user_id: string; runs: number; generals: number; fourstars: number; best_rank: number; best_free: number | null; daily_days: number; contest_weeks: number; xp: number }
export const profileOf = async (id: string) => (await rest<Profile[]>(`profiles?id=eq.${id}&select=*`))[0] ?? null;
export const statsOf = async (id: string) => (await rest<Stats[]>(`profile_stats?user_id=eq.${id}&select=*`))[0] ?? null;
/** 로비 · 전역 화면용: 내 호봉은 10분 동안 보관 (업로드하면 지움) */
export const myStatsCached = (id: string) => stash(`stats:${id}`, 10 * 60_000, () => statsOf(id));
/** 오늘의 기수 최고 순위: 가벼운 서버 함수(daily_best). 함수가 없으면(SQL 전) 예전 방식 */
export async function dailyBest(id: string): Promise<{ day: string; place: number; total: number } | null> {
  try { return (await rest<{ day: string; place: number; total: number }[]>('rpc/daily_best', { method: 'POST', body: JSON.stringify({ uid: id }) }))[0] ?? null; }
  catch { return (await rest<{ day: string; place: number; total: number }[]>(`daily_places?user_id=eq.${id}&select=day,place,total&order=place.asc,day.desc&limit=1`))[0] ?? null; }
}
export const teamsOf = (id: string) => rest<MyTeam[]>(`members?user_id=eq.${id}&select=cohort_id,user_id,seq,joined_at,cohorts(*)&order=joined_at.asc`);
export const runsOf = (id: string, limit = 5) => rest<RunRow[]>(`runs?select=${LIST}&user_id=eq.${id}&order=created_at.desc&limit=${limit}`);
export const ribbonsOf = (id: string) => rest<{ ribbons: { id: string; t: number }[] }[]>(`runs?select=ribbons&user_id=eq.${id}&limit=500`);
/** 같은 닉네임을 쓰는 사람 수 (띄어쓰기 무시는 서버 규칙, 여기선 그대로 비교) */
export const sameNickCount = async (nick: string) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&nickname=eq.${encodeURIComponent(nick)}&limit=1`, { headers: { apikey: SUPABASE_KEY, Prefer: 'count=exact' } });
  return Number(res.headers.get('content-range')?.split('/')[1] ?? 0);
};

// ── 방명록 ──
export interface GuestRow { id: number; user_id: string; nickname: string; body: string; reply: string | null; created_at: string }
/** v3.2 내 한마디 중 답글이 달린 것 (로비 띠 알림 점) */
export const myReplied = async (): Promise<number[]> => {
  const me = myId();
  if (!me) return [];
  return (await rest<{ id: number }[]>(`guestbook?select=id&user_id=eq.${me}&reply=not.is.null&order=id.desc&limit=50`)).map((r) => r.id);
};
export const guestbook = (limit = 30) => rest<GuestRow[]>(`guestbook?select=id,user_id,nickname,body,reply,created_at&order=created_at.desc&limit=${limit}`);
export async function writeGuest(nickname: string, body: string): Promise<void> {
  const s = await session();
  await rest('guestbook', { method: 'POST', body: JSON.stringify({ user_id: s.user_id, nickname, body }) }, true);
}
export async function reportGuest(id: number): Promise<void> {
  const s = await session();
  await rest('guestbook_reports', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ gid: id, user_id: s.user_id }) }, true);
}
/** 방명록 글 검사: 욕설·실제 부대·연락처·링크 차단 */
export function textProblem(t: string): string | null {
  const x = t.trim();
  if (x.length < 2) return '두 글자 이상 써 주세요';
  if (x.length > 100) return '100자까지 쓸 수 있어요';
  if (/\d+\s*(사단|여단|연대|대대|군단|사령부|비행단|함대|중대|소대|포대)/.test(x)) return '실제 부대 이름은 쓸 수 없어요';
  if (/(https?:|www\.|\.com|\.kr|open\.kakao)/i.test(x)) return '링크는 쓸 수 없어요';
  if (/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/.test(x)) return '연락처는 쓸 수 없어요';
  if (BANNED.some((w) => x.replace(/\s/g, '').includes(w))) return '쓸 수 없는 단어가 있어요';
  return null;
}

// ── 닉네임 검사: 욕설·실제 부대 번호 차단 ──
const BANNED = ['시발', '씨발', '병신', '좆', '개새', '니미', '썅', '존나', '섹스', '운영자', '관리자'];
export function nicknameProblem(n: string): string | null {
  const t = n.trim();
  if (t.length < 2 || t.length > 12) return '2~12자로 정해 주세요';
  if (/\d+\s*(사단|여단|연대|대대|군단|사령부|비행단|함대|중대)/.test(t)) return '실제 부대 이름은 쓸 수 없어요';
  if (BANNED.some((w) => t.replace(/\s/g, '').includes(w))) return '쓸 수 없는 단어가 있어요';
  if (IMPERSONATE.test(t.replace(/\s/g, ''))) return '운영진으로 보이는 이름은 쓸 수 없어요';
  return null;
}
/** v3.2 사칭 막기 (서버 SQL 2026-11-14_v3.2.sql 과 같은 규칙) */
const IMPERSONATE = /(개발자|운영자|운영진|운영팀|관리자|인사과장|동우캉|admin|(^|[^a-z])gm($|[^a-z]))/i;
