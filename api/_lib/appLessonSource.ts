import { z } from 'zod';
import { canAccessOwned, percentage } from './teacherWorkspacePolicy.js';
import { draftAccess } from './appAcademic.js';
import { normalizeNotionPageId } from './notionPageId.js';

/*
 * App-only lesson reads (used only while lessonAppActive). The migrated Notion rows in
 * lessonSourceRecords take the place of the Notion reader with the same row shape and the same
 * visibility rules, so mergeNotionRows and the screens behave exactly as before.
 */
const SOURCE = 'lessonSourceRecords';

/** Same visibility as the Notion reader: admin all; principal own academy; teacher owned/assigned rows within scope. */
export function canReadSourceLesson(actor: any, s: any) {
    if (!s || s.removed || s.appDeleted || s.academyId !== 'main') return false;
    if (actor.admin) return true;
    if (actor.academyId !== s.academyId) return false;
    if (!(actor.scopes || []).some((x: any) => x.studentKey === s.studentKey && x.subject === s.subject)) return false;
    return Boolean(actor.principal || s.ownerUid === actor.uid || (s.assignedUids || []).includes(actor.uid));
}

export function sourceLessonRow(s: any) {
    return { id: s.sourceId, appRecordId: s.appRecordId || '', data: s.data, ownerUid: s.ownerUid, academyId: s.academyId, notionPageId: s.sourceId,
        sourceDatabaseId: s.sourceDatabaseId, notionEditedAt: s.notionEditedAt, stage: s.stage, revision: 0, source: 'notion', updatedAt: Date.parse(s.notionEditedAt) || 0 };
}

export async function readAppSourceLessons(db: any, actor: any, filter: { day?: string; student?: string; days?: string[] } = {}) {
    const col = db.collection(SOURCE);
    // Optional equality filters narrow the read to one day, a set of days and/or one student (single-field indexes only).
    const chunks = filter.days ? Array.from({ length: Math.ceil(filter.days.length / 30) }, (_, i) => filter.days!.slice(i * 30, i * 30 + 30)) : [null];
    const narrow = (q: any, chunk: string[] | null) => { if (filter.day) q = q.where('data.date', '==', filter.day); if (chunk) q = q.where('data.date', 'in', chunk); if (filter.student) q = q.where('studentKey', '==', filter.student); return q; };
    const bases = actor.admin || actor.principal ? [col.where('academyId', '==', actor.admin ? 'main' : actor.academyId)] : [col.where('ownerUid', '==', actor.uid), col.where('assignedUids', 'array-contains', actor.uid)];
    const snaps = await Promise.all(bases.flatMap(base => chunks.map(chunk => narrow(base, chunk).get())));
    const rows = new Map<string, any>();
    for (const snap of snaps) for (const d of snap.docs) { const s = d.data(); if (canReadSourceLesson(actor, s)) rows.set(d.id, sourceLessonRow(s)); }
    return [...rows.values()];
}

/**
 * Migrated rows a deleted app lesson came from. Deleting marks them (appDeleted) in the same transaction, a restore
 * within the trash period clears the mark, and the mark outlives the trash so emptying it never brings the row back.
 * Matched by identity only (source ID / app record ID), never by student and date: one day can hold several lessons.
 */
export async function linkedSourceRows(tx: any, db: any, id: string, draft: any) {
    const rows = new Map<string, any>();
    let page = '';
    try { page = draft?.notionPageId ? normalizeNotionPageId(draft.notionPageId) : ''; } catch { page = ''; }
    if (page) { const snap = await tx.get(db.collection(SOURCE).doc(page)); if (snap.exists) rows.set(snap.id, snap); }
    for (const field of ['appRecordId', 'linkedDraftId']) for (const d of (await tx.get(db.collection(SOURCE).where(field, '==', id).limit(5))).docs) rows.set(d.id, d);
    return [...rows.values()];
}
export function markSourceRows(tx: any, rows: any[], mark: { draftId: string, at: number } | null) {
    for (const r of rows) tx.set(r.ref, { ...r.data(), appDeleted: mark });
}

/**
 * The app lesson that took over a migrated row, if any. A published one carries the newer values; a deleted one hides
 * the row. One edited again after publishing is someone's private draft: the row shows the last published app values
 * (from that publish's history entry), never the draft and never the older migrated values.
 */
async function takenOver(db: any, sources: any[]) {
    const ids = [...new Set(sources.flatMap((s: any) => [s.sourceId, s.appRecordId, s.linkedDraftId]).filter(Boolean))];
    const snaps = await Promise.all(ids.map(id => db.collection('teacherLessonDrafts').doc(id).get()));
    const drafts = new Map<string, any>();snaps.forEach((snap: any, i: number) => { if (snap.exists) drafts.set(ids[i], { id: ids[i], ...snap.data() }); });
    const linked = (s: any) => drafts.get(s.linkedDraftId) || drafts.get(s.appRecordId) || drafts.get(s.sourceId);
    const same = (s: any, d: any) => d?.academyId === 'main' && d.data?.studentKey === s.studentKey && d.data?.subject === s.subject;
    // Extra reads only for lessons edited again after publishing: the history entry of the last publish (or public restore).
    const pending = [...new Set(sources.map(linked).filter((d: any) => d && d.academyId === 'main' && !d.archived && !d.deleteRequested && d.stage !== 'published' && d.appPublishedRevision))];
    const published = new Map<string, any>();
    await Promise.all(pending.map(async (d: any) => {
        for (const kind of ['publish', 'restore']) {
            const h = (await db.collection('lessonAppHistory').doc(`${d.id}:${d.appPublishedRevision}:${kind}`).get()).data();
            const after = h?.afterDraft;
            if (after?.data && after.revision === d.appPublishedRevision && after.stage === 'published' && after.data.studentKey === d.data.studentKey && after.data.subject === d.data.subject) { published.set(d.id, after); return; }
        }
    }));
    const at = (s: any, r: any) => new Date(r.updatedAt || Date.parse(s.notionEditedAt) || 0).toISOString();
    return (s: any) => {
        const d = linked(s);
        if (!d || !same(s, d)) return s;
        if (d.archived || d.deleteRequested) return null;
        if (d.stage === 'published' && d.data) return { ...s, data: d.data, notionEditedAt: at(s, d) };
        const last = published.get(d.id);
        return last && same(s, last) ? { ...s, data: last.data, notionEditedAt: at(s, last) } : s;
    };
}

/** Replacement for previousNotionLesson: same fields, built from the student's migrated history, with published app edits winning. */
export async function previousAppSourceLesson(db: any, actor: any, studentKey: string, subject: string, date?: string) {
    const rows = (await db.collection(SOURCE).where('studentKey', '==', studentKey).get()).docs.map((d: any) => d.data())
        .filter((s: any) => s.subject === subject && !s.removed && !s.appDeleted && s.academyId === 'main');
    const current = await takenOver(db, rows);
    const docs = rows.map(current).filter(Boolean)
        .sort((a: any, b: any) => (b.data?.date || '').localeCompare(a.data?.date || '') || (Date.parse(b.notionEditedAt) || 0) - (Date.parse(a.notionEditedAt) || 0));
    const pick = date ? docs.find((s: any) => (s.data?.date || '') <= date) : docs[0];
    const sessionRecords = docs.map((s: any) => ({ id: s.sourceId, archived: false, updatedAt: Date.parse(s.notionEditedAt) || 0,
        data: { studentKey, subject, date: s.data.date, classSession: s.data.classSession, start: s.data.start, end: s.data.end, round: s.data.round ?? null, attendance: s.data.attendance,
            selfStudy: s.data.selfStudy, selfStudyStart: s.data.selfStudyStart, selfStudyEnd: s.data.selfStudyEnd, selfStudyRound: s.data.selfStudyRound ?? null } }));
    if (!pick) return { sessionRecords };
    const d = pick.data, wrong = d.total !== null && d.total !== undefined && d.correct !== null && d.correct !== undefined ? d.total - d.correct : null;
    const examWrong = d.examTotal !== null && d.examTotal !== undefined && d.examCorrect !== null && d.examCorrect !== undefined ? d.examTotal - d.examCorrect : null;
    return { round: d.round ?? null, selfStudyRound: d.selfStudyRound ?? null, content: d.content || '', nextPlan: d.nextPlan || '', examScope: d.examScope || '', assignment: d.assignment || '',
        attendance: d.attendance || '미확인', attitude: d.attitude || '미확인', homework: d.homework || '미확인', test: d.test || '미확인',
        total: d.total ?? null, wrong, correct: d.correct ?? null, examTotal: d.examTotal ?? null, examWrong, examCorrect: d.examCorrect ?? null, sessionRecords };
}

/**
 * Editing or deleting a migrated row: reuse the existing app lesson for that Notion page, or create one
 * with the Notion page ID as its ID. The public report ID and reportIdentity are carried by appProjectionId.
 */
export async function ensureAppLessonDraft(db: any, actor: any, idInput: unknown) {
    const id = z.string().uuid().parse(idInput);
    return db.runTransaction(async (tx: any) => {
        const ref = db.collection('teacherLessonDrafts').doc(id), existing = (await tx.get(ref)).data();
        if (existing) { if (!canAccessOwned(actor, existing.ownerUid, existing.academyId)) throw Error('FORBIDDEN'); return { id, ...existing }; }
        const s = (await tx.get(db.collection(SOURCE).doc(id))).data();
        if (!s || s.removed || s.appDeleted || !canReadSourceLesson(actor, s) || !canAccessOwned(actor, s.ownerUid, s.academyId)) throw Error('FORBIDDEN');
        const linked = await tx.get(db.collection('teacherLessonDrafts').where('notionPageId', '==', id).limit(2));
        if (linked.docs.length > 1) throw Error('DUPLICATE_NOTION_RECORD');
        if (linked.docs.length) { const d = linked.docs[0].data(); if (!canAccessOwned(actor, d.ownerUid, d.academyId)) throw Error('FORBIDDEN'); return { id: linked.docs[0].id, ...d }; }
        if (s.linkedDraftId || s.appRecordId) {
            // The app lesson this row points to must be used, never duplicated.
            const marked = (await tx.get(db.collection('teacherLessonDrafts').doc(s.linkedDraftId || s.appRecordId))).data();
            if (marked) { if (!canAccessOwned(actor, marked.ownerUid, marked.academyId)) throw Error('FORBIDDEN'); return { id: s.linkedDraftId || s.appRecordId, ...marked }; }
        }
        await draftAccess(tx, db, actor, s.studentKey, s.subject);
        const now = Date.now();
        const record = { data: s.data, ownerUid: s.ownerUid, academyId: 'main', revision: 1, stage: s.stage, source: 'notion', sourceOrigin: 'notion-import',
            notionPageId: s.sourceId, sourceDatabaseId: s.sourceDatabaseId, notionEditedAt: s.notionEditedAt, appRecordId: s.appRecordId || null,
            appProjectionId: s.publicReportId || null, lastSubmittedRevision: s.stage === 'published' ? 1 : null, notionWrite: null,
            percentage: percentage(s.data?.correct, s.data?.total), updatedAt: now };
        tx.set(ref, record);
        tx.set(db.collection('lessonAppHistory').doc(id + ':1:import'), { before: null, source: s, after: record, by: actor.uid, at: now, reason: 'source-import' });
        return { id, ...record };
    });
}

/**
 * An old Notion creation whose result was never confirmed is settled with the migration's evidence:
 * page found => link it; no page after a full scan => clear the pending write. No evidence => unchanged.
 */
export async function settleUncertainLessonWrite(db: any, id: string) {
    return db.runTransaction(async (tx: any) => {
        const ref = db.collection('teacherLessonDrafts').doc(id), d = (await tx.get(ref)).data();
        if (!d?.notionWrite?.attempted || d.notionWrite.done || d.notionPageId || d.notionWrite.pageId) return null;
        const evidence = (await tx.get(db.collection('lessonWriteEvidence').doc(id))).data();
        if (!evidence || evidence.revision !== d.revision) return null;
        const found = await tx.get(db.collection(SOURCE).where('appRecordId', '==', id).limit(2));
        let patch: any;
        if (evidence.result === 'source-page-found' && found.docs.length === 1) patch = { notionPageId: found.docs[0].id, notionWrite: { ...d.notionWrite, done: true, pageId: found.docs[0].id, settledBy: 'migration-evidence' } };
        else if (evidence.result === 'no-source-page' && found.docs.length === 0) patch = { notionWrite: null };
        else return null;
        const now = Date.now();
        tx.set(ref, { ...d, ...patch, updatedAt: now });
        tx.set(db.collection('lessonAppHistory').doc(id + ':' + d.revision + ':settle'), { before: d, after: { ...d, ...patch }, evidence, at: now, reason: 'settle-uncertain-notion-write' });
        return patch;
    });
}
