import { z } from 'zod';
import { readCoreEnrollmentSummaries } from './academyCore.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
// Per-subject 8-session prices, kept apart from the student profile so every month's tuition sheet reuses them.
const subjects = ['영어', '수학', '국어', '과학', '한국사'] as const;
const price = z.number().int().min(0).max(100_000_000).nullable();
// Only some subjects are sent at a time, so the key is checked rather than required.
export const pricesSchema = z.record(z.string(), price).refine(v => Object.keys(v).every(k => (subjects as readonly string[]).includes(k)), 'UNKNOWN_SUBJECT');
function allowed(actor: any) { if (actor.academyId !== 'main' || !(actor.admin || actor.principal)) throw Error('FORBIDDEN'); }
export const tuitionRef = (db: any, key: string) => db.collection('studentTuition').doc(uuid(key));

export async function readStudentTuition(db: any, actor: any, keyInput: unknown) {
    allowed(actor);
    const key = uuid(z.string().uuid().parse(keyInput));
    const [summaries, saved] = await Promise.all([readCoreEnrollmentSummaries(db, { ...actor, admin: true }), tuitionRef(db, key).get()]);
    const enrolled = (summaries.get(key) || summaries.get(key.replace(/-/g, '')) || []).filter((e: any) => e.status !== '중단').map((e: any) => e.subject);
    return { studentKey: key, subjects: enrolled, prices: saved.data()?.subjects || {} };
}

/** Merge prices into the transaction's writes; null removes a subject's price. Caller must have read `old` in the same transaction. */
export function mergedPrices(old: any, edits: Record<string, number | null>) {
    const next: Record<string, number> = { ...(old?.subjects || {}) };
    for (const [subject, value] of Object.entries(edits)) { if (value == null) delete next[subject]; else next[subject] = value; }
    return next;
}
export function writePrices(db: any, tx: any, actor: any, key: string, old: any, edits: Record<string, number | null>, at: number, source: string) {
    const subjectsNext = mergedPrices(old, edits);
    tx.set(tuitionRef(db, key), { academyId: 'main', studentKey: uuid(key), subjects: subjectsNext, updatedAt: at, updatedBy: actor.uid, source });
    tx.set(db.collection('studentTuitionHistory').doc(`${uuid(key)}:${at}`), { studentKey: uuid(key), before: old?.subjects || {}, after: subjectsNext, by: actor.uid, at, source });
    return subjectsNext;
}

export async function saveStudentTuition(db: any, actor: any, input: unknown, now = Date.now()) {
    allowed(actor);
    const v = z.object({ studentKey: z.string().uuid(), prices: pricesSchema }).strict().parse(input);
    return db.runTransaction(async (tx: any) => {
        const old = (await tx.get(tuitionRef(db, v.studentKey))).data();
        const prices = writePrices(db, tx, actor, v.studentKey, old, v.prices as any, now, 'profile');
        return { studentKey: uuid(v.studentKey), prices };
    });
}
