import { AsyncLocalStorage } from 'node:async_hooks';

/*
 * Evidence for disconnecting Notion and Make: counts Notion API calls (by request route and Notion
 * database area) and Make webhook deliveries per Korean day in notionUsage/{YYYY-MM-DD}.
 * Fire-and-forget: a counting failure never affects the request. No IDs, names or contents are stored.
 */
const scope = new AsyncLocalStorage<{ route: string }>();
const AREAS: Record<string, string> = {
    'ab289f5b1cf54160809e10d268c9c385': 'lesson', 'fa6ce5a895724f4d80d94d1485d44e6f': 'grade', '3430f1a49dde4b4ca5cf0d11b913b38c': 'schedule',
    '1a55402420f242c58837983bd1a4f61e': 'class', '3390d0f1c79a80f596b0e7dfe294b8f3': 'class', '5553cc9c01824f0da6613f3c1c83dc39': 'class',
    '3ec0d0f1c79a80b2bb52ea162888fe9a': 'directory', '3d274aff32ce4a33870d2689259113a6': 'directory', 'e2b0d0f1c79a8262a2088116c9201cfc': 'directory',
    'ec10d0f1c79a8312946b811e86041ee2': 'template',
};
/** Map a Notion API path to a coarse area. Page paths carry no database, so they count as 'page'. */
export function notionArea(path: string) {
    const m = /^(databases|pages|blocks)\/([0-9a-f-]{32,36})/i.exec(path || '');
    if (!m) return 'other';
    if (m[1] !== 'databases') return 'page';
    const id = m[2].replace(/-/g, '').toLowerCase();
    const student = String(process.env.NOTION_STUDENT_DATABASE_ID || '').replace(/-/g, '').toLowerCase();
    return AREAS[id] || (id === student ? 'directory' : 'database');
}
const safeKey = (v: string) => String(v || 'unlabeled').replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 80);
export function kstDay(now = Date.now()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(now)); }

/** Label every Notion call made while handling this request. */
export function withNotionUsageRoute<T>(route: string, fn: () => T): T { return scope.run({ route }, fn); }
/** Refine the label once the action is known (POST bodies are parsed inside the handler). */
export function setNotionUsageRoute(route: string) { const s = scope.getStore(); if (s) s.route = route; }

async function bump(path: Record<string, any>) {
    const [{ getFirebaseAdmin }, { FieldValue }] = await Promise.all([import('./firebaseAdmin.js'), import('firebase-admin/firestore')]);
    const { db } = getFirebaseAdmin(), day = kstDay();
    const inc = (o: any): any => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? FieldValue.increment(v) : inc(v)]));
    await db.collection('notionUsage').doc(day).set({ day, ...inc(path), updatedAt: Date.now() }, { merge: true });
}
// Tests and local tools without Firebase settings simply skip counting.
const enabled = () => Boolean(process.env.FIREBASE_PROJECT_ID);
let sink: ((entry: Record<string, any>) => void) | null = null;
/** Test hook: capture counts in memory instead of Firestore. */
export function captureNotionUsage(fn: ((entry: Record<string, any>) => void) | null) { sink = fn; }

export function recordNotionCall(path: string) {
    const entry = { notion: { [safeKey(scope.getStore()?.route || 'unlabeled')]: { [notionArea(path)]: 1 } } };
    if (sink) return sink(entry);
    if (enabled()) bump(entry).catch(() => {});
}
export function recordMakeWebhook(kind: 'lesson' | 'schedule' | 'academic', outcome: string) {
    const entry = { webhook: { [kind]: { [safeKey(outcome)]: 1 } } };
    if (sink) return sink(entry);
    if (enabled()) bump(entry).catch(() => {});
}
