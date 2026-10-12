// Recent teacher-room request timings kept in memory for 관리자 설정 › 속도 점검.
// Only the action name and milliseconds are kept (no student keys, query values or bodies), and nothing is stored or sent.
export interface RequestTiming { at: number; action: string; ms: number; token: number; status: number; server: { name: string; ms: number; note?: string }[] }
const LIMIT = 40;
const timings: RequestTiming[] = [];
const listeners = new Set<() => void>();
export function actionOf(endpoint: string, init?: RequestInit) {
    try {
        const url = new URL(endpoint, 'http://local');
        const fromBody = typeof init?.body === 'string' ? (() => { try { return JSON.parse(init.body as string)?.action; } catch { return null; } })() : null;
        const action = url.searchParams.get('action') || fromBody || '';
        const section = url.searchParams.get('section');
        return `${url.pathname.replace('/api/', '')}${action ? ' · ' + action : ''}${section ? ' · ' + section : ''}`;
    } catch { return 'request'; }
}
/** Server stages from a response's Server-Timing header, e.g. `auth;dur=12.3, cold;desc="서버 깨어남", total;dur=40`.
 *  Read from the response itself: the browser's resource-timing list is shared by every request to the same URL
 *  and often not filled in yet when the request finishes. */
export function parseServerTiming(header?: string | null) {
    if (!header) return [];
    return header.split(',').map(part => {
        const [name, ...params] = part.trim().split(';').map(s => s.trim());
        const dur = params.find(p => p.startsWith('dur=')), desc = params.find(p => p.startsWith('desc='));
        return name ? { name, ms: dur ? Math.round(Number(dur.slice(4))) || 0 : 0, ...(desc ? { note: desc.slice(5).replace(/^"|"$/g, '') } : {}) } : null;
    }).filter(Boolean) as { name: string; ms: number; note?: string }[];
}
export function recordTiming(entry: RequestTiming) {
    timings.unshift(entry); if (timings.length > LIMIT) timings.length = LIMIT;
    for (const listener of listeners) listener();
}
export function recentTimings() { return [...timings]; }
export function clearTimings() { timings.length = 0; for (const listener of listeners) listener(); }
export function onTimings(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
