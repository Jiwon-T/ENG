import { z } from 'zod';
import { canTeach } from './teacherWorkspacePolicy.js';
import { hashStudentKey } from './security.js';
import { linkedSourceRows, markSourceRows } from './appLessonSource.js';

/*
 * Restore a deleted lesson (app-only mode). The archive transaction stored the draft and the removed
 * public report in lessonAppHistory/{id}:{revision}:archive; restore puts both back under a new revision,
 * at the same public document ID with the same reportIdentity. Lessons deleted before the switch have no
 * public copy in history, so they come back as private drafts to be published again.
 */
const UUID = z.string().uuid();
/** Deleted lessons stay in the trash for 7 days, then the daily job removes them for good (academy decision). */
export const LESSON_TRASH_DAYS = 7;
const TRASH_MS = LESSON_TRASH_DAYS * 86400000;
function canRestore(actor: any, d: any) {
    if (actor.admin) return true;
    if (actor.principal) return Boolean(actor.academyId && d.academyId === actor.academyId);
    return d.ownerUid === actor.uid && d.academyId === actor.academyId && canTeach(actor, d.data?.studentKey, d.data?.subject);
}

/** Deleted lessons the actor may restore, newest first. Equality filters only; bounded. */
export async function listArchivedAppLessons(db: any, actor: any) {
    const c = db.collection('teacherLessonDrafts');
    const q = actor.admin ? c.where('archived', '==', true) : actor.principal ? c.where('academyId', '==', actor.academyId).where('archived', '==', true) : c.where('ownerUid', '==', actor.uid).where('archived', '==', true);
    const snap = await q.limit(501).get();
    const since = Date.now() - TRASH_MS;
    const rows = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((d: any) => canRestore(actor, d) && (d.updatedAt || 0) >= since)
        .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 100);
    const history = await Promise.all(rows.map((r: any) => db.collection('lessonAppHistory').doc(`${r.id}:${r.revision}:archive`).get()));
    return {
        records: rows.map((r: any, i: number) => ({ id: r.id, revision: r.revision, ownerUid: r.ownerUid, deletedAt: r.updatedAt || null,
            data: { date: r.data?.date, studentKey: r.data?.studentKey, subject: r.data?.subject, start: r.data?.start, classSession: r.data?.classSession },
            publicRestore: Boolean(history[i].exists && history[i].data()?.before && history[i].data()?.publicId) })),
        truncated: snap.docs.length > 500,
    };
}

export async function restoreAppLesson(db: any, actor: any, input: { id?: unknown, revision?: unknown, confirmed?: unknown }) {
    if (input.confirmed !== true) throw Error('INVALID_INPUT');
    const id = UUID.parse(input.id), revision = z.number().int().positive().parse(input.revision);
    const ref = db.collection('teacherLessonDrafts').doc(id);
    return db.runTransaction(async (tx: any) => {
        const old = (await tx.get(ref)).data();
        if (!old || !canRestore(actor, old)) throw Error('FORBIDDEN');
        if (old.revision !== revision) throw Error('DRAFT_CONFLICT');
        if (!old.archived) return { restored: true, alreadyRestored: true, record: { id, ...old } };
        if ((old.updatedAt || 0) < Date.now() - TRASH_MS) throw Error('LESSON_TRASH_EXPIRED');
        const key = old.data?.studentKey;
        const member = (await tx.get(db.collection('academyStudentMemberships').doc(key))).data();
        const mapping = (await tx.get(db.collection('notionStudentMappings').doc(hashStudentKey(key)))).data();
        if (!member || member.disabled || member.academyId !== old.academyId || !mapping?.internalStudentId || member.internalStudentId && member.internalStudentId !== mapping.internalStudentId) throw Error('STUDENT_MAPPING_CONFLICT');
        const hist = (await tx.get(db.collection('lessonAppHistory').doc(`${id}:${old.revision}:archive`))).data();
        const publicId = hist?.before && hist.publicId ? String(hist.publicId) : null;
        if (publicId) {
            // Never overwrite or duplicate a public identity that appeared after the deletion.
            const target = await tx.get(db.collection('lessonReports').doc(publicId));
            const owned = await tx.get(db.collection('lessonReports').where('teacherDraftId', '==', id).limit(2));
            if (target.exists || owned.docs.length) throw Error('SOURCE_IDENTITY_LOCKED');
            if (hist.before.internalStudentId && hist.before.internalStudentId !== mapping.internalStudentId) throw Error('SOURCE_IDENTITY_LOCKED');
        }
        const sourceRows = await linkedSourceRows(tx, db, id, old);
        const now = Date.now(), next = old.revision + 1, base = hist?.beforeDraft || old;
        const record = { ...old, data: base.data, revision: next, archived: false, deleteRequested: false, deleteLease: null, deleteLeaseUntil: 0,
            sourceMode: 'firestore', appEdited: true, failureCode: null, restoredAt: now, restoredBy: actor.uid, updatedAt: now,
            ...(publicId ? { stage: 'published', appProjectionId: publicId, appPublishedRevision: next, directReportRevision: next, lastSubmittedRevision: next }
                : { stage: 'draft', appPublishedRevision: null, lastSubmittedRevision: null }) };
        if (publicId) tx.set(db.collection('lessonReports').doc(publicId), { ...hist.before, teacherDraftId: id, teacherAppRevision: next });
        tx.set(ref, record);
        markSourceRows(tx, sourceRows.filter((r: any) => r.data().appDeleted), null);
        tx.set(db.collection('lessonAppHistory').doc(`${id}:${next}:restore`), { beforeDraft: old, afterDraft: record, publicId, restoredPublic: publicId ? { ...hist.before, teacherDraftId: id, teacherAppRevision: next } : null, by: actor.uid, at: now, reason: 'restore' });
        return { restored: true, publicRestored: Boolean(publicId), record: { id, ...record } };
    });
}

/**
 * Daily: permanently delete lessons that have been in the trash longer than 7 days — the deleted draft and the
 * archive history entry that holds its removed public report copy. Nothing that is not archived is touched.
 */
// Pages through every trashed lesson (not just the first 500), so recent trash cannot hide older expired items.
// Only the single-field index on `archived` is needed. A run looks at up to 5,000 trashed lessons; `more` says to continue tomorrow.
const PURGE_PAGE = 500, PURGE_PAGES = 10;
export async function purgeExpiredLessonTrash(db: any, now = Date.now()) {
    const expired: any[] = [];let cursor: any = null, pages = 0, full = false;
    do {
        let q = db.collection('teacherLessonDrafts').where('archived', '==', true).limit(PURGE_PAGE);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();pages++;
        for (const d of snap.docs) if ((d.data().updatedAt || 0) < now - TRASH_MS) expired.push(d);
        full = snap.docs.length === PURGE_PAGE;cursor = snap.docs[snap.docs.length - 1];
    } while (full && pages < PURGE_PAGES);
    let purged = 0;
    for (const d of expired) purged += await db.runTransaction(async (tx: any) => {
        const current = (await tx.get(d.ref)).data();
        if (!current?.archived || (current.updatedAt || 0) >= now - TRASH_MS) return 0; // restored or touched since listing
        // The migrated row stays (kept as history) but marked, so it never returns to lists, previous lesson or re-import.
        const sourceRows = await linkedSourceRows(tx, db, d.id, current);
        markSourceRows(tx, sourceRows.filter((r: any) => !r.data().appDeleted), { draftId: d.id, at: current.updatedAt || now });
        tx.delete(d.ref);
        tx.delete(db.collection('lessonAppHistory').doc(`${d.id}:${current.revision}:archive`));
        return 1;
    });
    return { purged, more: full };
}
