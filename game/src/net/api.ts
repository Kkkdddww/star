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
  mode?: 'free' | 'daily' | 'cohort'; day?: string | null; honor?: number | null; cohort_id?: string | null;
}
export interface CardExtra { luck?: { exp: number; hit: number; pct: number } | null; pct: number; same: number; cohort: number; clean: number; awards: number; start: number; end: number; honor: boolean; reason: string }
export type NewRun = Omit<RunRow, 'id' | 'user_id' | 'ended_on' | 'created_at'>;
export class AlreadyError extends Error {}

export interface Profile { id: string; nickname: string; equipped_title: string | null }

export async function getProfile(): Promise<Profile | null> {
  const s = await session();
  const rows = await rest<Profile[]>(`profiles?id=eq.${s.user_id}&select=*`);
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
export async function dailyCount(day: string): Promise<number> {
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
export interface CohortRow { id: string; code: string; name: string; seed: number; created_by: string; created_at: string; closes_at: string; max_members: number }
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
