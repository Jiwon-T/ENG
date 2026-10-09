/*
 * Narrow lesson reads for the review/export screens when a date and/or student is chosen.
 * Equality filters only (served by single-field indexes; no composite index deployment).
 * App lessons linked to the slice's source rows are loaded too, so mergeNotionRows gives exactly
 * the same result as the full read (an edited date or an archived app lesson still wins).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type LessonSliceFilter = { day?: string; student?: string; days?: string[] };
export const LESSON_REVIEW_PERIODS = ['7', '31', '92', 'all'] as const;

/** The last n calendar days in Korea (today included), newest first. */
export function recentLessonDays(n: number, now = Date.now()) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(now));
    const base = Date.parse(today + 'T00:00:00Z');
    return Array.from({ length: n }, (_, i) => new Date(base - i * 86400000).toISOString().slice(0, 10));
}
/** Date equality chunks ('in' takes at most 30 values) keep every query on single-field indexes. */
export function dayChunks(days: string[]) { return Array.from({ length: Math.ceil(days.length / 30) }, (_, i) => days.slice(i * 30, i * 30 + 30)); }

export function validLessonSliceFilter(day: string, student: string, period = 'all', now = Date.now()): LessonSliceFilter {
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('INVALID_INPUT');
    if (student && !UUID.test(student)) throw Error('INVALID_INPUT');
    if (!(LESSON_REVIEW_PERIODS as readonly string[]).includes(period)) throw Error('INVALID_INPUT');
    // A chosen day wins over the period; 'all' keeps the previous full read when nothing else narrows it.
    return { day: day || undefined, student: student || undefined, days: !day && period !== 'all' ? recentLessonDays(Number(period), now) : undefined };
}
export function narrowsLessonSlice(f: LessonSliceFilter) { return Boolean(f.day || f.student || f.days); }

/** Same visibility as the full read: admin all, principal own academy, teacher own lessons. */
function draftScope(db: any, actor: any) {
    const c = db.collection('teacherLessonDrafts');
    return actor.admin ? c : actor.principal ? c.where('academyId', '==', actor.academyId) : c.where('ownerUid', '==', actor.uid);
}
function inScope(actor: any, d: any) { return actor.admin || (actor.principal ? d.academyId === actor.academyId : d.ownerUid === actor.uid); }

export async function lessonDraftSlice(db: any, actor: any, filter: LessonSliceFilter, sourceRows: any[]) {
    const found = new Map<string, any>();
    for (const chunk of filter.days ? dayChunks(filter.days) : [null]) {
        let q = draftScope(db, actor);
        if (filter.day) q = q.where('data.date', '==', filter.day);
        if (chunk) q = q.where('data.date', 'in', chunk);
        if (filter.student) q = q.where('data.studentKey', '==', filter.student);
        for (const d of (await q.get()).docs) found.set(d.id, { id: d.id, ...d.data() });
    }
    // Only source rows not already matched by a loaded app lesson need the link lookup; chunks run in parallel.
    const linkedAlready = new Set([...found.values()].map(d => d.notionPageId).filter(Boolean));
    const pageIds = [...new Set(sourceRows.map(r => r.notionPageId).filter(id => id && !linkedAlready.has(id)))];
    const linked = await Promise.all(dayChunks(pageIds).map(chunk => draftScope(db, actor).where('notionPageId', 'in', chunk).get()));
    for (const snap of linked) for (const d of snap.docs) found.set(d.id, { id: d.id, ...d.data() });
    const markers = [...new Set(sourceRows.map(r => String(r.appRecordId || '').trim().toLowerCase()).filter(m => UUID.test(m)))].filter(m => !found.has(m));
    const marked = await Promise.all(markers.map(m => db.collection('teacherLessonDrafts').doc(m).get()));
    for (const d of marked) if (d.exists && inScope(actor, d.data())) found.set(d.id, { id: d.id, ...d.data() });
    return [...found.values()];
}

export function filterSourceRows(rows: any[], filter: LessonSliceFilter) {
    const days = filter.days ? new Set(filter.days) : null;
    return rows.filter(r => (!filter.day || r.data?.date === filter.day) && (!days || days.has(r.data?.date)) && (!filter.student || r.data?.studentKey === filter.student));
}
