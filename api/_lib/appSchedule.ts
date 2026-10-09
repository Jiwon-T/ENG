import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { teacherScheduleSchema, canAccessOwned } from './teacherWorkspacePolicy.js';
import { identity, draftAccess } from './appAcademic.js';
import { generateScheduleDocId, scheduleSourceKey } from './scheduleProjection.js';
const hash = (value: any) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function stable(record: any) { if (record?.notionWrite?.leaseUntil > Date.now() || record?.deleteLeaseUntil > Date.now() || ['publishing', 'processing', 'notion_saved'].includes(record?.stage) && Date.now() - (record.publishStartedAt || record.updatedAt || 0) < 180000)
    throw Error('PUBLISH_IN_PROGRESS'); }
export async function readAppSchedulePlaces(db: any, actor: any) { const config = (await db.collection('appScheduleConfig').doc(actor.academyId).get()).data(); if (config?.places) {
    if (!Array.isArray(config.places) || config.places.some((v: any) => typeof v !== 'string' || !v || v.length > 100))
        throw Error('SCHEDULE_CONFIG_MIGRATION_REQUIRED');
    return [...new Set<string>(config.places)];
} let query = db.collection('teacherSchedules').where('academyId', '==', actor.academyId); if (!actor.admin && !actor.principal)
    query = query.where('ownerUid', '==', actor.uid); const result = await query.limit(501).get(); if (result.docs.length > 500)
    throw Error('SCHEDULE_PROJECTION_LIMIT'); return [...new Set<string>(result.docs.map((d: any) => d.data().data?.place).filter((v: any) => typeof v === 'string' && v))]; }
export async function saveAppSchedule(db: any, actor: any, body: any) { const data = teacherScheduleSchema.parse(body.data), id = body.id ? z.string().uuid().parse(body.id) : randomUUID(), ref = db.collection('teacherSchedules').doc(id), places = await readAppSchedulePlaces(db, actor); if (data.place !== '' && !places.includes(data.place))
    throw Error('SCHEDULE_CONFIG_MIGRATION_REQUIRED'); if (new Set(data.students).size !== data.students.length)
    throw Error('INVALID_INPUT'); return db.runTransaction(async (tx: any) => { const old = (await tx.get(ref)).data(); if (old && (old.archived || old.deleteRequested || !canAccessOwned(actor, old.ownerUid, old.academyId)))
    throw Error('FORBIDDEN'); stable(old); for (const key of data.students)
    await draftAccess(tx, db, actor, key, data.subject); if (old && body.revision !== old.revision)
    throw Error('DRAFT_CONFLICT'); const at = Date.now(), record = { ...old, data, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, revision: (old?.revision || 0) + 1, stage: 'draft', sourceMode: 'firestore', appEdited: true, updatedAt: at }; tx.set(ref, record); tx.set(db.collection('scheduleAppHistory').doc(id + ':' + record.revision + ':save'), { before: old || null, after: record, by: actor.uid, at, reason: 'save' }); return { id, record: { id, ...record } }; }); }
export async function publishAppSchedule(db: any, actor: any, idInput: any, revisionInput?: any, archive = false) { const id = z.string().uuid().parse(idInput), ref = db.collection('teacherSchedules').doc(id), version = revisionInput === undefined ? (await ref.get()).data()?.revision : z.number().int().positive().parse(revisionInput); return db.runTransaction(async (tx: any) => { const old = (await tx.get(ref)).data(); if (!old || !canAccessOwned(actor, old.ownerUid, old.academyId) || old.academyId && old.academyId !== actor.academyId)
    throw Error('FORBIDDEN'); if (old.revision !== version)
    throw Error('DRAFT_CONFLICT'); stable(old); if (old.archived)
    return archive ? { archived: true, alreadyArchived: true } : Promise.reject(Error('FORBIDDEN')); if (old.deleteRequested && !archive)
    throw Error('FORBIDDEN'); const data = teacherScheduleSchema.parse(old.data); const members = []; if (!archive)
    for (const key of data.students)
        members.push(await identity(tx, db, actor, key, data.subject)); if (new Set(members.map(m => m.internalStudentId)).size !== members.length)
    throw Error('STUDENT_MAPPING_CONFLICT'); const linked = await tx.get(db.collection('studentSchedules').where('teacherDraftId', '==', id).limit(401)); if (linked.docs.length > 400)
    throw Error('SCHEDULE_PROJECTION_LIMIT'); const source = old.notionPageId || old.notionWrite?.pageId; const legacy = source ? await tx.get(db.collection('studentSchedules').where('notionScheduleId', 'in', [source, source.replace(/-/g, '')])) : { docs: [] }; const previous = new Map<string, any>(); for (const row of [...linked.docs, ...legacy.docs]) {
    const r = row.data();
    if (r.teacherDraftId && r.teacherDraftId !== id || r.academyId && r.academyId !== actor.academyId)
        throw Error('SOURCE_IDENTITY_LOCKED');
    if (previous.has(r.internalStudentId) && previous.get(r.internalStudentId).id !== row.id)
        throw Error('SOURCE_IDENTITY_LOCKED');
    previous.set(r.internalStudentId, row);
} const stateRef = source ? db.collection('scheduleSyncStates').doc(scheduleSourceKey(source)) : null, state = stateRef ? (await tx.get(stateRef)).data() : null; if (state?.teacherDraftId && state.teacherDraftId !== id)
    throw Error('SOURCE_IDENTITY_LOCKED'); if (!archive && old.sourceMode === 'firestore' && old.appPublishedRevision === old.revision && old.stage === 'published')
    return { stage: 'published', record: { id, ...old }, alreadyPublished: true }; const revision = old.sourceMode === 'firestore' ? old.revision : old.revision + 1, at = new Date().toISOString(), now = Date.now(), current = new Map(members.map(m => [m.internalStudentId, m])), all = new Set([...previous.keys(), ...current.keys()]); if (all.size > 400)
    throw Error('SCHEDULE_PROJECTION_LIMIT'); const changes = []; for (const internal of all) {
    const previousDoc = previous.get(internal), prior = previousDoc?.data(), student = current.get(internal);
    const docId = prior?.scheduleDocId || (source ? generateScheduleDocId(source, internal) : hash(['app-schedule', actor.academyId, id, internal]).slice(0, 32)), target = previousDoc?.ref || db.collection('studentSchedules').doc(docId);
    const removed = archive || !student || data.status === '취소';
    const projected = { ...prior, scheduleDocId: docId, notionScheduleId: prior?.notionScheduleId || source || null, appScheduleId: id, internalStudentId: internal, studentKey: student?.studentKey || prior?.studentKey, title: data.title, startAt: data.date + 'T' + data.start + ':00+09:00', endAt: data.date + 'T' + data.end + ':00+09:00', subject: data.subject, scheduleType: data.kind, status: removed ? '취소' : data.status === '변경' ? '예정' : data.status, notice: !student && !archive ? (prior?.notice ? prior.notice + ' (대상에서 제외됨)' : '(일정 대상에서 제외됨)') : data.note || null, completedAt: !removed && data.status === '완료' ? (prior?.status === '완료' ? prior.completedAt || at : at) : null, teacherDraftId: id, teacherAppRevision: revision, academyId: actor.academyId, sourceMode: 'firestore', sourceUpdatedAt: at, serverUpdatedAt: at };
    if (prior && (archive || !student))
        Object.assign(projected, prior, { status: '취소', completedAt: null, teacherDraftId: id, teacherAppRevision: revision, appScheduleId: id, sourceMode: 'firestore', sourceUpdatedAt: at, serverUpdatedAt: at, ...(!archive ? { notice: prior.notice ? prior.notice + ' (대상에서 제외됨)' : '(일정 대상에서 제외됨)' } : {}) });
    changes.push({ target, prior, projected });
} const record = { ...old, revision, stage: archive ? 'archived' : 'published', archived: archive, deleteRequested: false, sourceMode: 'firestore', appPublishedRevision: revision, lastSubmittedRevision: revision, scheduleProjectionDoneRevision: revision, appEdited: true, updatedAt: now }; for (const change of changes)
    tx.set(change.target, change.projected); if (stateRef)
    tx.set(stateRef, { ...state, notionScheduleId: source, teacherDraftId: id, teacherAppRevision: revision, sourceMode: 'firestore', updatedAt: now }); tx.set(ref, record); tx.set(db.collection('scheduleAppHistory').doc(id + ':' + revision + (archive ? ':archive' : ':publish')), { before: old, changes: changes.map(c => ({ id: c.target.id, before: c.prior || null, after: c.projected })), by: actor.uid, at: now, reason: archive ? 'archive' : 'publish' }); return { stage: record.stage, archived: archive, cancelled: archive, record: { id, ...record } }; }); }
export async function archiveAppSchedule(db: any, actor: any, id: any, revision: any) { const ref = db.collection('teacherSchedules').doc(z.string().uuid().parse(id)), record = (await ref.get()).data(); if (record && !record.appPublishedRevision && !record.notionPageId && !record.notionWrite?.pageId)
    return db.runTransaction(async (tx: any) => { const old = (await tx.get(ref)).data(); if (!old || !canAccessOwned(actor, old.ownerUid, old.academyId))
        throw Error('FORBIDDEN'); if (old.revision !== revision)
        throw Error('DRAFT_CONFLICT'); stable(old); tx.set(ref, { ...old, archived: true, stage: 'archived', sourceMode: 'firestore', updatedAt: Date.now() }); tx.set(db.collection('scheduleAppHistory').doc(id + ':' + revision + ':archive'), { before: old, by: actor.uid, at: Date.now(), reason: 'archive-private' }); return { archived: true }; }); return publishAppSchedule(db, actor, id, revision, true); }
/** Never switch a live academy merely because the new code is deployed. */
export async function appSchedulesActive(db: any, actor: any) { if (actor.academyId !== 'main')
    return false; const mode = (await db.collection('appScheduleAuthority').doc('main').get()).data(); if (!mode?.active || !mode.verifiedRunId || mode.schemaVersion !== 1)
    return false; const proof = (await db.collection('scheduleVerificationRuns').doc(mode.verifiedRunId).get()).data(); return Boolean(proof?.verified && proof.academyId === actor.academyId && proof.hash === mode.verificationHash); }
