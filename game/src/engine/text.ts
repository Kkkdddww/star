// 한국어 조사 붙이기
const jong = (w: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 ? c % 28 : -1; };
const hasJong = (w: string) => { const j = jong(w); if (j === -1) return /[0136780LMNR]$/i.test(w); return j !== 0; };
export const eul = (w: string) => w + (hasJong(w) ? '을' : '를');
export const iga = (w: string) => w + (hasJong(w) ? '이' : '가');
export const eunNeun = (w: string) => w + (hasJong(w) ? '은' : '는');
export const wa = (w: string) => w + (hasJong(w) ? '과' : '와');
export const ro = (w: string) => { const j = jong(w); return w + (j === 0 || j === 8 || j === -1 && !hasJong(w) ? '로' : '으로'); };
export { hasJong };
