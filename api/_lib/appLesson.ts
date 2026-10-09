import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { lessonDraftSchema, canAccessOwned, percentage } from './teacherWorkspacePolicy.js';
import { identity, draftAccess } from './appAcademic.js';
import { directLessonReport } from './teacherDirectReport.js';
import { normalizeNotionPageId } from './notionPageId.js';

// Foundation only: no route or authority flag activates this before migration verification.
function stable(record: any) {
    if (record?.notionWrite?.leaseUntil > Date.now() || record?.deleteLeaseUntil > Date.now() ||
        ['publishing', 'processing', 'notion_saved'].includes(record?.stage) &&
        Date.now() - (record.publishStartedAt || record.updatedAt || 0) < 180000)
        throw Error('PUBLISH_IN_PROGRESS');
    if (record?.notionWrite?.attempted && !record.notionWrite.done &&
        !record.notionPageId && !record.notionWrite.pageId)
        throw Error('NOTION_WRITE_RESULT_UNCERTAIN');
}
function owner(actor: any, old: any) {
    if (!old || !canAccessOwned(actor, old.ownerUid, old.academyId) ||
        old.academyId !== actor.academyId) throw Error('FORBIDDEN');
}
export async function saveAppLesson(db: any, actor: any, body: any) {
    const data = lessonDraftSchema.parse(body.data);
    const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
    const ref = db.collection('teacherLessonDrafts').doc(id);
    return db.runTransaction(async (tx: any) => {
        const old = (await tx.get(ref)).data();
        await draftAccess(tx, db, actor, data.studentKey, data.subject);
        if (old) {
            owner(actor, old); stable(old);
            if (old.archived || old.deleteRequested) throw Error('FORBIDDEN');
            if (body.revision !== old.revision) throw Error('DRAFT_CONFLICT');
            if ((old.notionPageId || old.directReportRevision || old.appPublishedRevision) &&
                (old.data.studentKey !== data.studentKey || old.data.subject !== data.subject))
                throw Error('SOURCE_IDENTITY_LOCKED');
        }
        const record = { ...old, data, ownerUid: old?.ownerUid || actor.uid,
            academyId: actor.academyId, revision: (old?.revision || 0) + 1,
            sourceMode: 'firestore', appEdited: true, stage: 'draft',
            percentage: percentage(data.correct, data.total), updatedAt: Date.now() };
        tx.set(ref, record);
        tx.set(db.collection('lessonAppHistory').doc(id + ':' + record.revision + ':save'),
            { before: old || null, after: record, by: actor.uid, at: record.updatedAt, reason: 'save' });
        return { id, record: { id, ...record } };
    });
}
export async function publishAppLesson(db: any, actor: any, idInput: unknown, revisionInput: unknown) {
    return changePublicLesson(db, actor, idInput, revisionInput, false);
}
export async function archiveAppLesson(db: any, actor: any, idInput: unknown, revisionInput: unknown) {
    return changePublicLesson(db, actor, idInput, revisionInput, true);
}
async function changePublicLesson(db: any, actor: any, idInput: unknown, revisionInput: unknown, archive: boolean) {
    const id = z.string().uuid().parse(idInput), revision = z.number().int().positive().parse(revisionInput);
    const ref = db.collection('teacherLessonDrafts').doc(id);
    return db.runTransaction(async (tx: any) => {
        const old = (await tx.get(ref)).data(); owner(actor, old); stable(old);
        if (old.revision !== revision) {
            if (!archive && old.appTakeoverBaseRevision === revision && old.revision === revision + 1 &&
                old.appPublishedRevision === old.revision && old.stage === 'published')
                return { stage: 'published', record: { id, ...old }, alreadyPublished: true };
            throw Error('DRAFT_CONFLICT');
        }
        if (old.archived) {
            if (archive) return { archived: true, alreadyArchived: true };
            throw Error('FORBIDDEN');
        }
        if (old.deleteRequested && !archive) throw Error('FORBIDDEN');
        const mapping = await identity(tx, db, actor, old.data.studentKey, old.data.subject);
        const linked = await tx.get(db.collection('lessonReports').where('teacherDraftId', '==', id).limit(3));
        const source = old.notionPageId || old.notionWrite?.pageId;
        const candidates = [...new Set([old.appProjectionId, id,
            ...(source ? [normalizeNotionPageId(source), normalizeNotionPageId(source).replace(/-/g, '')] : [])].filter(Boolean))];
        const snapshots = await Promise.all(candidates.map(key => tx.get(db.collection('lessonReports').doc(key))));
        const found = new Map<string, any>();
        for (const row of [...linked.docs, ...snapshots]) if (row.exists) found.set(row.id, row);
        // Do not merge distinct public identities during takeover. A migration audit must resolve them.
        if (found.size > 1) throw Error('SOURCE_IDENTITY_LOCKED');
        const previous = [...found.values()][0], prior = previous?.data();
        if (prior && (prior.internalStudentId !== mapping.internalStudentId ||
            prior.teacherDraftId && prior.teacherDraftId !== id ||
            prior.academyId && prior.academyId !== actor.academyId)) throw Error('SOURCE_IDENTITY_LOCKED');
        if (prior?.teacherAppRevision > old.revision) throw Error('DRAFT_CONFLICT');
        if (!archive && old.appPublishedRevision === old.revision && old.stage === 'published')
            return { stage: 'published', record: { id, ...old }, alreadyPublished: true };
        const version = old.sourceMode === 'firestore' ? revision : revision + 1;
        const target = previous?.ref || db.collection('lessonReports').doc(old.appProjectionId || (source ? normalizeNotionPageId(source) : 'app-' + id));
        const now = Date.now();
        const record = { ...old, revision: version, sourceMode: 'firestore', appEdited: true,
            ...(old.sourceMode !== 'firestore' ? { appTakeoverBaseRevision: revision } : {}),
            stage: archive ? 'archived' : 'published', archived: archive, deleteRequested: false,
            appProjectionId: target.id, appPublishedRevision: version, directReportRevision: version,
            lastSubmittedRevision: version, failureCode: null, reportPublishedAt: now, updatedAt: now };
        const projected = archive ? null : { ...prior, ...directLessonReport(id, record, mapping,
            prior || { reportIdentity: source || id }), notionPageId: source ? normalizeNotionPageId(source) : null,
            appLessonId: id, academyId: actor.academyId, sourceMode: 'firestore' };
        if (archive && previous) tx.delete(target);
        if (projected) tx.set(target, projected);
        tx.set(ref, record);
        tx.set(db.collection('lessonAppHistory').doc(id + ':' + version + (archive ? ':archive' : ':publish')),
            { beforeDraft: old, afterDraft: record, publicId: target.id, before: prior || null,
                after: projected, by: actor.uid, at: now, reason: archive ? 'archive' : 'publish' });
        return { stage: record.stage, archived: archive, record: { id, ...record } };
    });
}
