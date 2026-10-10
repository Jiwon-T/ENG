import { z } from 'zod';
import { DIRECTORY_ROWS, directorySourceKey } from './academyDirectorySource.js';
import { readCoreEnrollmentSummaries } from './academyCore.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
import { TUITION_SESSIONS, tuitionCharge } from '../../src/lib/tuition.js';
import { tuitionRef, writePrices } from './studentTuition.js';
const subjectsList = ['영어', '수학', '국어', '과학', '한국사'];
export { tuitionCharge };
// Monthly tuition sheet (관리자 설정 > 수강료 계산).
// 수강료 is the 8-session price. Sessions this month = lessons already written in 일지 (수업 있음, makeups included)
// + sessions still ahead on the regular timetable (minus 휴강, plus 보강). Only 8 are charged; the 9th and later are free.
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const sheetRef = (db: any, m: string) => db.collection('tuitionMonths').doc(`main:${m}`);
function allowed(actor: any) { if (actor.academyId !== 'main' || !(actor.admin || actor.principal)) throw Error('FORBIDDEN'); }
const seoulToday = (now: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(now));
function daysOf(m: string) { const [y, mo] = m.split('-').map(Number), n = new Date(Date.UTC(y, mo, 0)).getUTCDate(); return Array.from({ length: n }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`); }
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const plainTitle = (p: any) => { const t = p?.['학생'] || p?.['학생 이름'] || p?.['이름 및 일지'] || Object.values(p || {}).find((v: any) => v?.type === 'title'); return (t?.title || []).map((v: any) => v.plain_text ?? v.text?.content ?? '').join(''); };
export const rowKey = (studentKey: string, subject: string) => `${studentKey}|${subject}`;

export async function readTuitionMonth(db: any, actor: any, monthInput: unknown, now = Date.now()) {
    allowed(actor);
    const m = month.parse(monthInput), days = daysOf(m), first = days[0], last = days[days.length - 1], today = seoulToday(now);
    const ahead = days.filter(d => d > today);
    const [studentRows, enrollments, lessons, classes, schedules, tuition, sheet] = await Promise.all([
        db.collection(DIRECTORY_ROWS).where('sourceKey', '==', directorySourceKey('students')).limit(1001).get(),
        readCoreEnrollmentSummaries(db, { ...actor, admin: true }),
        db.collection('teacherLessonDrafts').where('data.date', '>=', first).where('data.date', '<=', last).get(),
        db.collection('teacherClasses').where('academyId', '==', 'main').limit(501).get(),
        ahead.length ? db.collection('teacherSchedules').where('data.date', '>=', ahead[0]).where('data.date', '<=', last).get() : { docs: [] },
        db.collection('studentTuition').where('academyId', '==', 'main').get(),
        sheetRef(db, m).get(),
    ]);
    const saved = sheet.data() || { rows: {}, revision: 0 };
    // Every student row, including withdrawn or archived ones: a student who leaves mid-month still gets a final bill.
    const people = new Map<string, any>();
    for (const d of studentRows.docs) { const r = d.data(); if (r.academyId !== 'main') continue; const key = uuid(r.entityId || r.notionPageId || ''); if (key) people.set(key, { name: r.summaryOverride?.studentDisplayName || plainTitle(r.fields?.properties) || '학생', tuition: typeof r.fields?.properties?.['수강료']?.number === 'number' ? r.fields.properties['수강료'].number : null, enrollment: r.fields?.properties?.['등록상태']?.status?.name || r.fields?.properties?.['등록상태']?.select?.name || '', archived: Boolean(r.fields?.archived) }); }
    const bySubject = new Map<string, Record<string, number>>(tuition.docs.map((d: any) => [uuid(d.id), d.data().subjects || {}]));
    // Lessons already written this month (수업 있음 only; trash excluded). Makeup lessons are ordinary lesson records.
    const written = new Map<string, { count: number; round: number | null; writers: Record<string, number> }>();
    for (const d of lessons.docs) { const r = d.data(), x = r.data || {}; if (r.academyId !== 'main' || r.archived || x.classSession === '없음' || x.date > today) continue; const k = rowKey(uuid(x.studentKey || ''), x.subject); const w = written.get(k) || { count: 0, round: null, writers: {} }; w.count++; if (r.ownerUid) w.writers[r.ownerUid] = (w.writers[r.ownerUid] || 0) + 1; if (typeof x.round === 'number') w.round = Math.max(w.round ?? 0, x.round); written.set(k, w); }
    const live = classes.docs.map((d: any) => d.data()).filter((c: any) => !c.archived && c.status !== '중단' && Array.isArray(c.slots));
    const events = schedules.docs.map((d: any) => d.data()).filter((s: any) => s.academyId === 'main' && !s.archived && s.data && s.data.status !== '취소');
    // Rows: every subject being taken now (등록), every subject stopped this month, and — whatever the status says
    // (중단 with or without a date, 대기, archived) — every student+subject that has lessons written this month.
    const subjectsOf = new Map<string, any[]>([...enrollments].map(([key, list]) => [uuid(key), list]));
    const candidates = new Map<string, { key: string; subject: string; e: any }>();
    for (const [key, list] of subjectsOf) for (const e of list) if (e.status === '등록' || e.status === '중단' && e.endDate && e.endDate >= first) candidates.set(rowKey(key, e.subject), { key, subject: e.subject, e });
    for (const k of written.keys()) if (!candidates.has(k)) { const [key, subject] = k.split('|'); if (key) candidates.set(k, { key, subject, e: (subjectsOf.get(key) || []).find((x: any) => x.subject === subject) || null }); }
    const rows: any[] = [];
    for (const [k, { key, subject, e }] of candidates) {
        const person = people.get(key) || { name: '학생 (정보 없음)', tuition: null, enrollment: '', archived: true };
        const w = written.get(k) || { count: 0, round: null, writers: {} };
        const mine = live.filter((c: any) => c.subject === subject && (c.students || []).map((s: string) => uuid(s)).includes(key));
        // Sessions ahead only while still enrolled: 등록, or 중단 up to its 중단일. Otherwise only written lessons count.
        const until = e?.status === '등록' ? last : e?.status === '중단' && e.endDate ? e.endDate : '';
        let planned = 0;
        for (const date of ahead) {
            if (!until || date > until || e?.startDate && date < e.startDate) continue;
            const on = (kind: string) => events.filter((s: any) => s.data.date === date && s.data.kind === kind && s.data.subject === subject && (s.data.students || []).map((x: string) => uuid(x)).includes(key)).length;
            const slots = mine.reduce((n: number, c: any) => n + c.slots.filter((s: any) => s.weekday === weekday(date) && s.kind !== 'test' && s.status !== '중단' && (!s.students?.length || s.students.map((x: string) => uuid(x)).includes(key))).length, 0);
            planned += Math.max(slots - on('휴강'), 0) + on('보강');
        }
        const subjectCount = new Set([...(subjectsOf.get(key) || []).map((x: any) => x.subject), subject]).size;
        const own = bySubject.get(key)?.[subject], fallback = subjectCount === 1 ? person.tuition : null;
        const edit = saved.rows?.[k] || {};
        const price = typeof edit.tuition === 'number' ? edit.tuition : typeof own === 'number' ? own : fallback;
        const sessions = typeof edit.sessions === 'number' ? edit.sessions : w.count + planned, free = typeof edit.free === 'number' ? edit.free : 0;
        if (e?.status === '중단' && !w.count && !planned && !saved.rows?.[k]) continue; // stopped before teaching anything this month
        const status = e?.status || '기록만', left = e?.status === '중단' || !e || person.archived || /퇴원|탈퇴|중단/.test(person.enrollment);
        rows.push({ key: k, studentKey: key, name: person.name, subject, status, left, enrollment: person.enrollment, endDate: e?.endDate || null, classes: mine.map((c: any) => c.name).filter(Boolean), written: w.count, writers: w.writers, lastRound: w.round, planned, expected: w.count + planned, sessions, free, tuition: price, tuitionSource: typeof edit.tuition === 'number' ? 'edited' : typeof own === 'number' ? 'subject' : fallback != null ? 'student' : 'missing', note: String(edit.note || ''), edited: Boolean(edit.sessions != null || edit.free != null || edit.tuition != null), ...tuitionCharge(price, sessions, free) });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.subject.localeCompare(b.subject, 'ko'));
    // After the month is confirmed, flag rows whose bill no longer matches what was confirmed (a lesson edited, added or removed).
    const snapshot = saved.confirmedAt && saved.snapshot ? saved.snapshot : null;
    const removedSinceConfirm: any[] = [];
    if (snapshot) {
        for (const r of rows) { const was = snapshot[r.key]; r.changedSinceConfirm = !was ? ((r.amount || 0) > 0 ? { charged: 0, amount: 0, written: 0 } : null) : was.charged !== r.charged || (was.amount ?? null) !== (r.amount ?? null) ? was : null; }
        const now = new Set(rows.map(r => r.key));
        for (const [key, was] of Object.entries(snapshot) as [string, any][]) if (!now.has(key) && (was.amount || 0) > 0) removedSinceConfirm.push({ key, name: was.name || '학생', subject: was.subject || '', ...was });
    }
    return { month: m, today, sessionsPerPrice: TUITION_SESSIONS, revision: saved.revision || 0, confirmedAt: saved.confirmedAt || null, confirmedBy: saved.confirmedByName || null, changedSinceConfirm: rows.filter(r => r.changedSinceConfirm).length + removedSinceConfirm.length, removedSinceConfirm, rows, total: rows.reduce((n, r) => n + (r.amount || 0), 0) };
}

const editSchema = z.object({ sessions: z.number().int().min(0).max(62).nullable().optional(), free: z.number().int().min(0).max(31).nullable().optional(), tuition: z.number().int().min(0).max(100_000_000).nullable().optional(), note: z.string().max(300).optional() }).strict();
/** Save the admin's per-row corrections (and optionally mark the month confirmed). Computed values are never stored as truth.
 *  A price typed here is the student's price for that subject from now on (studentTuition), not just for this month. */
export async function saveTuitionMonth(db: any, actor: any, input: unknown, now = Date.now()) {
    allowed(actor);
    const v = z.object({ month, revision: z.number().int().min(0), rows: z.record(z.string().max(200), editSchema), confirm: z.boolean().optional() }).strict().parse(input);
    if (Object.keys(v.rows).length > 2000) throw Error('TUITION_TOO_MANY_ROWS');
    const prices = new Map<string, Record<string, number | null>>();
    for (const [k, e] of Object.entries(v.rows)) {
        if (e.tuition === undefined) continue;
        const [student, subject] = k.split('|');
        if (!z.string().uuid().safeParse(student).success || !subjectsList.includes(subject)) throw Error('TUITION_ROW_INVALID');
        const key = uuid(student); prices.set(key, { ...(prices.get(key) || {}), [subject]: e.tuition });
    }
    if (prices.size > 400) throw Error('TUITION_TOO_MANY_ROWS');
    const ref = sheetRef(db, v.month);
    const result = await db.runTransaction(async (tx: any) => {
        const old = (await tx.get(ref)).data() || { rows: {}, revision: 0 };
        const priceDocs = await Promise.all([...prices.keys()].map(async key => [key, (await tx.get(tuitionRef(db, key))).data()] as const));
        if ((old.revision || 0) !== v.revision) throw Error('TUITION_CONFLICT');
        const rows: Record<string, any> = { ...(old.rows || {}) };
        for (const [k, e] of Object.entries(v.rows)) {
            // Field by field: a sent value replaces, null clears back to the computed value, an absent field is kept.
            const merged: Record<string, any> = { ...(rows[k] || {}) };
            for (const [field, x] of Object.entries(e)) { if (x === undefined) continue; if (field === 'tuition' || x === null || x === '') delete merged[field]; else merged[field] = x; }
            if (Object.keys(merged).length) rows[k] = merged; else delete rows[k];
        }
        for (const [key, oldPrices] of priceDocs) writePrices(db, tx, actor, key, oldPrices, prices.get(key)!, now, 'tuition-sheet');
        const next = { academyId: 'main', month: v.month, rows, ...(old.snapshot && !v.confirm ? { snapshot: old.snapshot } : {}), revision: (old.revision || 0) + 1, updatedAt: now, updatedBy: actor.uid, ...(v.confirm ? { confirmedAt: now, confirmedBy: actor.uid, confirmedByName: actor.name || '' } : { confirmedAt: old.confirmedAt || null, confirmedBy: old.confirmedBy || null, confirmedByName: old.confirmedByName || null }) };
        tx.set(ref, next);
        tx.set(db.collection('tuitionMonthHistory').doc(`${v.month}:${next.revision}`), { month: v.month, before: old.rows || {}, after: rows, prices: Object.fromEntries(prices), by: actor.uid, at: now, confirm: Boolean(v.confirm) });
        return { revision: next.revision, confirmedAt: next.confirmedAt };
    });
    // What was confirmed, so later lesson changes that move a bill can be pointed out.
    if (v.confirm) {
        const sheet = await readTuitionMonth(db, actor, v.month, now);
        const snapshot = Object.fromEntries(sheet.rows.map((r: any) => [r.key, { name: r.name, subject: r.subject, written: r.written, charged: r.charged, amount: r.amount ?? null }]));
        await db.runTransaction(async (tx: any) => { const cur = (await tx.get(ref)).data(); if (cur && cur.revision === result.revision) tx.set(ref, { ...cur, snapshot }); });
    }
    return result;
}
