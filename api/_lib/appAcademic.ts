import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { academicDraftSchema } from './teacherAcademicPolicy.js';
import { canTeach, canAccessOwned, assertDraftEditable } from './teacherWorkspacePolicy.js';
import { hashStudentKey } from './security.js';
const nativeId = (id: string) => 'app-' + id;
const refs = (db: any, id: string) => [db.collection('academicRecords').doc(id), db.collection('academicRecords').doc(id.replace(/-/g, '')), db.collection('examResults').doc(id), db.collection('examResults').doc(id.replace(/-/g, ''))];
export async function identity(tx: any, db: any, actor: any, key: string, subject: string) { if (!actor.academyId || !canTeach(actor, key, subject))
    throw Error('FORBIDDEN'); const member = (await tx.get(db.collection('academyStudentMemberships').doc(key))).data(), mapping = (await tx.get(db.collection('notionStudentMappings').doc(hashStudentKey(key)))).data(); if (!member || member.disabled || member.academyId !== actor.academyId || !mapping?.internalStudentId || member.internalStudentId && member.internalStudentId !== mapping.internalStudentId)
    throw Error('STUDENT_MAPPING_CONFLICT'); if (!actor.admin) {
    const profile = (await tx.get(db.collection('teacherWorkspaceAccess').doc(actor.uid))).data(), authority = (await tx.get(db.collection('academyCoreAuthority').doc('main'))).data();
    if (!profile || profile.disabled || profile.academyId !== actor.academyId)
        throw Error('FORBIDDEN');
    if (authority?.active && !(profile.scopes || []).some((s: any) => s.studentKey === key && s.subject === subject))
        throw Error('FORBIDDEN');
} return mapping; }
export async function draftAccess(tx: any, db: any, actor: any, key: string, subject: string) { if (!actor.academyId || !canTeach(actor, key, subject))
    throw Error('FORBIDDEN'); const authority = (await tx.get(db.collection('academyCoreAuthority').doc('main'))).data(); if (authority?.active)
    return identity(tx, db, actor, key, subject); const member = (await tx.get(db.collection('academyStudentMemberships').doc(key))).data(); if (member && (member.disabled || member.academyId !== actor.academyId))
    throw Error('FORBIDDEN'); const profile = (await tx.get(db.collection('teacherWorkspaceAccess').doc(actor.uid))).data(); if (!actor.admin && profile && (profile.disabled || profile.academyId !== actor.academyId))
    throw Error('FORBIDDEN'); }
function stable(record: any) { if (record?.notionWrite?.leaseUntil > Date.now() || record?.deleteLeaseUntil > Date.now() || ['publishing', 'processing', 'notion_saved'].includes(record?.stage) && Date.now() - (record?.publishStartedAt || record?.updatedAt || 0) < 180000)
    throw Error('PUBLISH_IN_PROGRESS'); }
export async function saveAppAcademic(db: any, actor: any, body: any, replay = false) { const data = academicDraftSchema.parse(body.data), id = body.id ? z.string().uuid().parse(body.id) : randomUUID(), ref = db.collection('teacherAcademicDrafts').doc(id); return db.runTransaction(async (tx: any) => { const old = (await tx.get(ref)).data(); await draftAccess(tx, db, actor, data.studentKey, data.subject); if (old?.archived || old?.deleteRequested || old && !canAccessOwned(actor, old.ownerUid, old.academyId))
    throw Error('FORBIDDEN'); stable(old); if (replay && old && body.revision === undefined) {
    const normalized = academicDraftSchema.parse(old.data), keys = (value: any) => JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])));
    if (keys(normalized) === keys(data))
        return { id, record: { id, ...old }, alreadySaved: true };
} if (old) {
    if (old.revision !== body.revision)
        throw Error('DRAFT_CONFLICT');
    if ((old.appPublishedRevision || old.notionPageId) && (old.data.studentKey !== data.studentKey || old.data.subject !== data.subject))
        throw Error('SOURCE_IDENTITY_LOCKED');
} let projectionId = old?.appProjectionId || old?.notionPageId || null, source: any = null; if (!old && body.id) {
    const candidates = await Promise.all(refs(db, id).slice(0, 2).map(r => tx.get(r)));
    const found = candidates.filter(d => d.exists);
    if (found.length > 1)
        throw Error('SOURCE_IDENTITY_LOCKED');
    source = found[0]?.data();
    if (source) {
        if (body.notionEditedAt && body.notionEditedAt !== source.sourceUpdatedAt)
            throw Error('DRAFT_CONFLICT');
        const mapping = (await tx.get(db.collection('notionStudentMappings').doc(hashStudentKey(data.studentKey)))).data();
        if (source.internalStudentId !== mapping.internalStudentId || source.teacherDraftId && source.teacherDraftId !== id || !actor.admin && source.ownerUid !== actor.uid)
            throw Error('FORBIDDEN');
        if (source.removed || source.archived)
            throw Error('FORBIDDEN');
        projectionId = found[0].id;
    }
} if (body.notionPageId && !old && !source)
    throw Error('ACADEMIC_MIGRATION_REQUIRED'); const record = { ...old, id, data, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, revision: (old?.revision || 0) + 1, stage: 'draft', sourceMode: 'firestore', appEdited: true, appProjectionId: projectionId || nativeId(id), ...(source ? { notionPageId: id } : {}), updatedAt: Date.now() }; if (source)
    tx.set(db.collection('academicRecords').doc(projectionId), { ...source, teacherDraftId: id, teacherAppRevision: 0, sourceMode: 'firestore' }); tx.set(ref, record); tx.set(db.collection('academicAppHistory').doc(id + ':' + record.revision + ':save'), { before: old || source || null, after: record, by: actor.uid, at: record.updatedAt, reason: 'save' }); return { id, record }; }); }
export async function publishAppAcademic(db: any, actor: any, idInput: any, revisionInput?: any) { const id = z.string().uuid().parse(idInput), ref = db.collection('teacherAcademicDrafts').doc(id), version = revisionInput === undefined ? (await ref.get()).data()?.revision : z.number().int().positive().parse(revisionInput); return db.runTransaction(async (tx: any) => { const old = (await tx.get(ref)).data(); if (!old || old.archived || old.deleteRequested || !canAccessOwned(actor, old.ownerUid, old.academyId))
    throw Error('FORBIDDEN'); stable(old); if (old.revision !== version) {
    if (old.appTakeoverBaseRevision === version && old.revision === version + 1 && old.appPublishedRevision === old.revision && old.stage === 'published')
        return { stage: 'published', record: { id, ...old }, alreadyPublished: true };
    throw Error('DRAFT_CONFLICT');
} const data = academicDraftSchema.parse(old.data), mapping = await identity(tx, db, actor, data.studentKey, data.subject), ownedSnapshots = await tx.get(db.collection('academicRecords').where('teacherDraftId', '==', id).limit(2)); if (ownedSnapshots.docs.length > 1)
    throw Error('SOURCE_IDENTITY_LOCKED'); const candidateRefs = old.appProjectionId ? [db.collection('academicRecords').doc(old.appProjectionId)] : old.notionPageId ? refs(db, old.notionPageId).slice(0, 2) : ownedSnapshots.docs.length ? [ownedSnapshots.docs[0].ref] : [db.collection('academicRecords').doc(nativeId(id))], candidates = await Promise.all(candidateRefs.map(r => tx.get(r))), found = candidates.filter(d => d.exists); if (found.length > 1)
    throw Error('SOURCE_IDENTITY_LOCKED'); const target = found[0]?.ref || candidateRefs[0], projectionId = target.id, prior = found[0]?.data(); if (prior && (prior.internalStudentId !== mapping.internalStudentId || prior.teacherDraftId && prior.teacherDraftId !== id))
    throw Error('SOURCE_IDENTITY_LOCKED'); if (old.stage === 'published' && old.appPublishedRevision === old.revision)
    return { stage: 'published', record: { id, ...old }, alreadyPublished: true }; const publishRevision = old.sourceMode === 'firestore' ? old.revision : old.revision + 1; const at = new Date().toISOString(), projected = { ...prior, internalStudentId: mapping.internalStudentId, studentKey: data.studentKey, subject: data.subject, examType: data.examType === '학력평가' ? '모의고사' : data.examType, examDetail: data.examDetail, examYear: data.examYear ?? null, semester: data.semester ?? null, examPeriod: data.examPeriod ?? null, title: data.title, examDate: data.examDate, deadline: data.deadline, score: data.score, maxScore: data.maxScore, grade: data.grade, submissionStatus: data.submissionStatus, percentile: prior?.percentile ?? null, removed: false, archived: false, teacherDraftId: id, teacherAppRevision: publishRevision, ownerUid: old.ownerUid, academyId: actor.academyId, sourceMode: 'firestore', sourceUpdatedAt: at, serverUpdatedAt: at }; const record = { ...old, revision: publishRevision, ...(old.sourceMode !== 'firestore' ? { appTakeoverBaseRevision: old.revision } : {}), stage: 'published', sourceMode: 'firestore', appProjectionId: projectionId, appPublishedRevision: publishRevision, lastSubmittedRevision: publishRevision, failureCode: null, updatedAt: Date.now() }; tx.set(target, projected); tx.set(ref, record); tx.set(db.collection('academicAppHistory').doc(id + ':' + publishRevision), { before: prior || null, beforeDraft: old, after: projected, draftId: id, revision: publishRevision, by: actor.uid, at, reason: 'publish' }); return { stage: 'published', record: { id, ...record } }; }); }
export async function archiveAppAcademic(db: any, actor: any, idInput: any, revisionInput: any, body?: any) { if (revisionInput === undefined)
    return archiveStoredAcademic(db, actor, idInput, body); const id = z.string().uuid().parse(idInput), revision = z.number().int().positive().parse(revisionInput), ref = db.collection('teacherAcademicDrafts').doc(id); return db.runTransaction(async (tx: any) => { const old = (await tx.get(ref)).data(); if (!old || !canAccessOwned(actor, old.ownerUid, old.academyId))
    throw Error('FORBIDDEN'); if (old.revision !== revision)
    throw Error('DRAFT_CONFLICT'); if (!old.appPublishedRevision && !old.notionPageId && !old.notionWrite?.pageId) {
    await draftAccess(tx, db, actor, old.data.studentKey, old.data.subject);
    const at = Date.now();
    tx.set(ref, { ...old, archived: true, appEdited: true, stage: 'archived', sourceMode: 'firestore', updatedAt: at });
    tx.set(db.collection('academicAppHistory').doc(id + ':' + revision + ':archive'), { before: old, by: actor.uid, at, reason: 'archive-private' });
    return { archived: true };
} await identity(tx, db, actor, old.data.studentKey, old.data.subject); if (old.notionWrite?.leaseUntil > Date.now() || old.deleteLeaseUntil > Date.now())
    throw Error('PUBLISH_IN_PROGRESS'); if (old.archived)
    return { archived: true }; const mapping = (await tx.get(db.collection('notionStudentMappings').doc(hashStudentKey(old.data.studentKey)))).data(), targets = [db.collection('academicRecords').doc(old.appProjectionId || old.notionPageId || nativeId(id)), ...((old.notionPageId || old.notionWrite?.pageId) ? refs(db, old.notionPageId || old.notionWrite.pageId) : [])]; const snapshots = await Promise.all(targets.map(r => tx.get(r))); for (const d of snapshots)
    if (d.exists && (d.data().internalStudentId !== mapping.internalStudentId || d.data().teacherDraftId && d.data().teacherDraftId !== id))
        throw Error('SOURCE_IDENTITY_LOCKED'); const at = Date.now(); for (let i = 0; i < snapshots.length; i++)
    tx.set(targets[i], { ...snapshots[i].data(), internalStudentId: mapping.internalStudentId, studentKey: old.data.studentKey, removed: true, archived: true, teacherDraftId: id, teacherAppRevision: revision, sourceMode: 'firestore' }); tx.set(ref, { ...old, archived: true, appEdited: true, stage: 'archived', sourceMode: 'firestore', deleteRequested: false, updatedAt: at }); tx.set(db.collection('academicAppHistory').doc(id + ':' + revision + ':archive'), { before: snapshots.filter(d => d.exists).map(d => ({ id: d.id, data: d.data() })), by: actor.uid, at, reason: 'archive' }); return { archived: true }; }); }
export async function appAcademicStudents(db: any, actor: any) { const members = actor.admin || actor.principal ? (await db.collection('academyStudentMemberships').where('academyId', '==', actor.academyId).limit(501).get()).docs : await Promise.all([...new Set<string>((actor.scopes || []).map((s: any) => s.studentKey))].map(key => db.collection('academyStudentMemberships').doc(key).get())); if (members.length > 500)
    throw Error('ACADEMIC_PAGE_LIMIT'); const result = []; for (const d of members) {
    const member = d.data();
    if (!d.exists || member.disabled || member.academyId !== actor.academyId)
        continue;
    const mapping = (await db.collection('notionStudentMappings').doc(hashStudentKey(d.id)).get()).data();
    if (mapping?.internalStudentId && member.internalStudentId && member.internalStudentId !== mapping.internalStudentId)
        throw Error('STUDENT_MAPPING_CONFLICT');
    if (mapping?.internalStudentId)
        result.push({ studentKey: d.id, studentDisplayName: mapping.studentDisplayName, internalStudentId: mapping.internalStudentId });
} return result; }
export async function listAppAcademicSources(db: any, actor: any, options?: {
    studentKey?: string;
    subject?: string;
}) { const students = (await appAcademicStudents(db, actor)).filter(s => !options?.studentKey || s.studentKey === options.studentKey), records = []; for (const student of students) {
    let query = db.collection('academicRecords').where('internalStudentId', '==', student.internalStudentId);
    if (options?.subject)
        query = query.where('subject', '==', options.subject);
    const result = await query.limit(501).get();
    if (result.docs.length > 500 || records.length + result.docs.length > 1000)
        throw Error('ACADEMIC_PAGE_LIMIT');
    for (const d of result.docs) {
        const r = d.data();
        if (r.removed || r.archived || r.teacherDraftId || !actor.admin && !actor.principal && r.ownerUid !== actor.uid)
            continue;
        if (!actor.admin && !actor.principal && !canTeach(actor, student.studentKey, r.subject))
            continue;
        let id: string;
        try {
            id = z.string().uuid().parse(d.id.length === 32 ? d.id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5') : d.id);
        }
        catch {
            continue;
        }
        records.push({ id, notionPageId: id, ownerUid: r.ownerUid || null, academyId: actor.academyId, readOnly: !actor.admin && r.ownerUid !== actor.uid, source: 'firestore', notionEditedAt: r.sourceUpdatedAt, stage: 'published', data: { studentKey: student.studentKey, subject: r.subject, examType: r.examType === '모의고사' ? '학력평가' : r.examType, examDetail: r.examDetail || '', examYear: r.examYear ?? null, semester: r.semester ?? null, examPeriod: r.examPeriod ?? null, title: r.title, examDate: r.examDate?.slice(0, 10) || '', deadline: r.deadline || null, score: r.score ?? null, maxScore: r.maxScore ?? null, grade: r.grade || '', submissionStatus: r.submissionStatus || '미제출', note: '' } });
    }
} return records; }
async function archiveStoredAcademic(db: any, actor: any, idInput: any, body: any) { const id = z.string().uuid().parse(idInput), key = z.string().uuid().parse(body?.studentKey), stamp = z.string().datetime().parse(body?.sourceEditedAt), ref = db.collection('teacherAcademicDrafts').doc(id); return db.runTransaction(async (tx: any) => { if ((await tx.get(ref)).exists)
    throw Error('DRAFT_CONFLICT'); const candidates = await Promise.all(refs(db, id).map(r => tx.get(r))), found = candidates.filter(d => d.exists); if (!found.length)
    throw Error('ACADEMIC_MIGRATION_REQUIRED'); const source = found.find(d => d.ref.path.startsWith('academicRecords/')) || found[0], r = source.data(); const mapping = await identity(tx, db, actor, key, r.subject); if (r.sourceUpdatedAt !== stamp)
    throw Error('DRAFT_CONFLICT'); for (const d of found) {
    const value = d.data();
    if (value.internalStudentId !== mapping.internalStudentId || value.teacherDraftId && value.teacherDraftId !== id || !actor.admin && value.ownerUid !== actor.uid)
        throw Error('FORBIDDEN');
} const at = Date.now(); for (const d of found)
    tx.set(d.ref, { ...d.data(), removed: true, archived: true, teacherDraftId: id, teacherAppRevision: 1, sourceMode: 'firestore' }); tx.set(ref, { ownerUid: actor.uid, academyId: actor.academyId, data: { studentKey: key, subject: r.subject, title: r.title || '', examDate: r.examDate || '', examType: r.examType === '모의고사' ? '학력평가' : r.examType, score: r.score ?? null, maxScore: r.maxScore ?? null, grade: r.grade || '', submissionStatus: r.submissionStatus || '미제출' }, revision: 1, notionPageId: id, appProjectionId: source.id, sourceMode: 'firestore', archived: true, appEdited: true, stage: 'archived', updatedAt: at }); tx.set(db.collection('academicAppHistory').doc(id + ':1:archive'), { before: found.map(d => ({ id: d.id, data: d.data() })), by: actor.uid, at, reason: 'archive-imported' }); return { archived: true }; }); }
