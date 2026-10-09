import { z } from 'zod';
import { canTeach } from './teacherWorkspacePolicy.js';
import { hashStudentKey } from './security.js';

/*
 * Restore a deleted lesson (app-only mode). The archive transaction stored the draft and the removed
 * public report in lessonAppHistory/{id}:{revision}:archive; restore puts both back under a new revision,
 * at the same public document ID with the same reportIdentity. Lessons deleted before the switch have no
 * public copy in history, so they come back as private drafts to be published again.
 */
const UUID = z.string().uuid();
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
    const rows = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((d: any) => canRestore(actor, d))
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
        const now = Date.now(), next = old.revision + 1, base = hist?.beforeDraft || old;
        const record = { ...old, data: base.data, revision: next, archived: false, deleteRequested: false, deleteLease: null, deleteLeaseUntil: 0,
            sourceMode: 'firestore', appEdited: true, failureCode: null, restoredAt: now, restoredBy: actor.uid, updatedAt: now,
            ...(publicId ? { stage: 'published', appProjectionId: publicId, appPublishedRevision: next, directReportRevision: next, lastSubmittedRevision: next }
                : { stage: 'draft', appPublishedRevision: null, lastSubmittedRevision: null }) };
        if (publicId) tx.set(db.collection('lessonReports').doc(publicId), { ...hist.before, teacherDraftId: id, teacherAppRevision: next });
        tx.set(ref, record);
        tx.set(db.collection('lessonAppHistory').doc(`${id}:${next}:restore`), { beforeDraft: old, afterDraft: record, publicId, restoredPublic: publicId ? { ...hist.before, teacherDraftId: id, teacherAppRevision: next } : null, by: actor.uid, at: now, reason: 'restore' });
        return { restored: true, publicRestored: Boolean(publicId), record: { id, ...record } };
    });
}
