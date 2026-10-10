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
/** Server stages for the latest response from this URL (Server-Timing), when the browser exposes them. */
export function serverStages(endpoint: string) {
    try {
        if (typeof performance === 'undefined' || typeof location === 'undefined') return [];
        const entries = performance.getEntriesByName(new URL(endpoint, location.href).href) as PerformanceResourceTiming[];
        const last = entries[entries.length - 1];
        return (last?.serverTiming || []).map(t => ({ name: t.name, ms: Math.round(t.duration), ...(t.description ? { note: t.description } : {}) }));
    } catch { return []; }
}
export function recordTiming(entry: RequestTiming) {
    timings.unshift(entry); if (timings.length > LIMIT) timings.length = LIMIT;
    for (const listener of listeners) listener();
}
export function recentTimings() { return [...timings]; }
export function clearTimings() { timings.length = 0; for (const listener of listeners) listener(); }
export function onTimings(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
