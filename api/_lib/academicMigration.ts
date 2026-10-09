import { randomUUID, createHash } from 'node:crypto';
import { gradeNotion, gradeFromPage } from './teacherAcademicNotion.js';
import { GRADE_DATABASE, parseAcademicPage } from './academic.js';
import { academicDraftSchema } from './teacherAcademicPolicy.js';
import { hashStudentKey } from './security.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
import { ids } from './teacherNotionWorkspace.js';
const hash = (v: any) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const progressKey = hash(['main', GRADE_DATABASE]), progressRef = (db: any) => db.collection('academicImportProgress').doc(progressKey);
/** Shared with the grade switch, which verifies a fresh completed pass. */
export const academicProgressRef = progressRef;
function access(actor: any) { if (!actor.admin || actor.academyId !== 'main')
    throw Error('FORBIDDEN'); }
async function notAppOnly(db: any) { const { academicAppActive } = await import('./academicAuthority.js'); if (await academicAppActive(db)) throw Error('ACADEMIC_APP_ACTIVE'); }
async function sourceRows(db: any, actor: any, notion: any, cursor?: string) { const page = await notion(`databases/${GRADE_DATABASE}/query`, 'POST', { page_size: 10, ...(cursor ? { start_cursor: cursor } : {}), sorts: [{ timestamp: 'last_edited_time', direction: 'ascending' }] }); if (!Array.isArray(page.results) || page.has_more && !page.next_cursor)
    throw Error('ACADEMIC_MIGRATION_REQUIRED'); const profiles = (await db.collection('teacherWorkspaceAccess').where('academyId', '==', actor.academyId).get()).docs; const rows = []; for (const raw of page.results) {
    const value = structuredClone(raw);
    if (uuid(value.parent?.database_id || '') !== GRADE_DATABASE)
        throw Error('SOURCE_IDENTITY_LOCKED');
    if (value.archived || value.in_trash)
        continue;
    for (const key of ['학생', '담당 선생님'])
        if (value.properties?.[key]?.has_more) {
            if (notion !== gradeNotion)
                throw Error('ACADEMIC_MIGRATION_REQUIRED');
            value.properties[key] = { ...value.properties[key], has_more: false, relation: (await ids(value, key)).map(id => ({ id })) };
        }
    if (value.properties?.['학생']?.relation?.length !== 1)
        throw Error('STUDENT_MAPPING_CONFLICT');
    const parsed = parseAcademicPage(value), data = academicDraftSchema.parse(gradeFromPage(value)), id = uuid(value.id);
    const mapping = (await db.collection('notionStudentMappings').doc(hashStudentKey(data.studentKey)).get()).data(), member = (await db.collection('academyStudentMemberships').doc(data.studentKey).get()).data();
    if (!mapping?.internalStudentId || !member || member.disabled || member.academyId !== actor.academyId || member.internalStudentId && member.internalStudentId !== mapping.internalStudentId)
        throw Error('STUDENT_MAPPING_CONFLICT');
    const teachers = (value.properties?.['담당 선생님']?.relation || []).map((r: any) => uuid(r.id));
    const owners = [];
    for (const profile of profiles) {
        const p = profile.data();
        if (!p.notionTeacherPageId || !teachers.includes(uuid(p.notionTeacherPageId)))
            continue;
        const user = (await db.collection('users').doc(profile.id).get()).data();
        if (profile.id === process.env.ADMIN_UID || ['teacher', 'principal'].includes(user?.role))
            owners.push(profile.id);
    }
    const marker = (value.properties?.['앱 기록 ID']?.rich_text || []).map((r: any) => r.plain_text ?? r.text?.content ?? '').join('');
    let recordId = id;
    if (/^[a-f0-9-]{36}$/i.test(marker))
        recordId = uuid(marker);
    else {
        const linked = await db.collection('teacherAcademicDrafts').where('notionPageId', '==', id).limit(2).get();
        if (linked.docs.length > 1)
            throw Error('SOURCE_IDENTITY_LOCKED');
        if (linked.docs.length)
            recordId = linked.docs[0].id;
    }
    const current = (await db.collection('teacherAcademicDrafts').doc(recordId).get()).data();
    rows.push({ id, recordId, data, mappingId: hashStudentKey(data.studentKey), internalStudentId: mapping.internalStudentId, ownerUid: owners.length === 1 ? owners[0] : null, teacherUids: owners, raw: value, parsed: parsed.data, owned: !!current && (current.sourceOrigin !== 'notion-import' || current.appEdited || current.archived), sourceKey: hash(['main', GRADE_DATABASE, id]), version: hash([value.last_edited_time, value.properties]) });
} return { rows, next: page.has_more ? page.next_cursor : null }; }
export async function previewAcademicMigration(db: any, actor: any, notion = gradeNotion) { access(actor); await notAppOnly(db); const state = (await progressRef(db).get()).data(); if (state?.done)
    return { done: true, total: state.total || 0 }; if (state?.leaseUntil > Date.now())
    throw Error('PUBLISH_IN_PROGRESS'); const page = await sourceRows(db, actor, notion, state?.cursor); return { reviewToken: hash([actor.uid, state?.cursor || null, page.rows.map(r => [r.id, r.version, r.recordId, r.ownerUid, r.owned])]), done: false, count: page.rows.length, appOwned: page.rows.filter(r => r.owned).length, unknownAuthors: page.rows.filter(r => !r.ownerUid).length, hasMore: !!page.next }; }
export async function importAcademicMigrationStep(db: any, actor: any, confirmed: unknown, reviewToken: unknown, notion = gradeNotion) { access(actor); await notAppOnly(db); if (confirmed !== true || typeof reviewToken !== 'string' || !/^[a-f0-9]{64}$/.test(reviewToken))
    throw Error('INVALID_INPUT'); const ref = progressRef(db), lease = randomUUID(); const state = await db.runTransaction(async (tx: any) => { const old = (await tx.get(ref)).data() || { cursor: null, total: 0 }; if (old.done)
    return old; if (old.leaseUntil > Date.now())
    throw Error('PUBLISH_IN_PROGRESS'); const next = { ...old, leaseOwner: lease, leaseUntil: Date.now() + 180000, startedAt: old.startedAt || Date.now() }; tx.set(ref, next); return next; }); if (state.done)
    return { done: true, total: state.total }; let imported = 0, skipped = 0; try {
    const page = await sourceRows(db, actor, notion, state.cursor);
    if (reviewToken !== hash([actor.uid, state.cursor || null, page.rows.map(r => [r.id, r.version, r.recordId, r.ownerUid, r.owned])]))
        throw Error('DRAFT_CONFLICT');
    for (const row of page.rows) {
        const outcome = await db.runTransaction(async (tx: any) => { const checkpoint = (await tx.get(ref)).data(); if (checkpoint?.leaseOwner !== lease || checkpoint.leaseUntil < Date.now())
            throw Error('PUBLISH_IN_PROGRESS'); const target = db.collection('teacherAcademicDrafts').doc(row.recordId), old = (await tx.get(target)).data(), mapping = (await tx.get(db.collection('notionStudentMappings').doc(row.mappingId))).data(), member = (await tx.get(db.collection('academyStudentMemberships').doc(row.data.studentKey))).data(); if (!mapping || mapping.internalStudentId !== row.internalStudentId || !member || member.disabled || member.academyId !== actor.academyId || member.internalStudentId && member.internalStudentId !== row.internalStudentId)
            throw Error('STUDENT_MAPPING_CONFLICT'); if (old && (old.data.studentKey !== row.data.studentKey || old.data.subject !== row.data.subject || old.academyId !== actor.academyId))
            throw Error('SOURCE_IDENTITY_LOCKED'); const src = db.collection('academicImportSources').doc(row.sourceKey), previousSource = (await tx.get(src)).data(), versionRef = db.collection('academicImportVersions').doc(row.sourceKey + ':' + row.version); const versionExists = (await tx.get(versionRef)).exists; if (old?.sourceMode === 'firestore' && old.sourceOrigin !== 'notion-import' || old?.appEdited) {
            if (!versionExists)
                tx.set(versionRef, { raw: row.raw, sourceId: row.id, by: actor.uid, at: Date.now() });
            tx.set(src, { sourceId: row.id, recordId: row.recordId, version: row.version, appOwned: true, at: Date.now() });
            return 'skipped';
        } if (old && (old.stage !== 'published' || old.notionWrite?.leaseUntil > Date.now() || old.notionWrite?.attempted && !old.notionWrite?.done || old.ownerUid && row.ownerUid && old.ownerUid !== row.ownerUid))
            throw Error('ACADEMIC_MIGRATION_RECOVERY_REQUIRED'); if (old && previousSource?.version === row.version) {
            return 'skipped';
        } const pubRefs = [db.collection('academicRecords').doc(row.id), db.collection('academicRecords').doc(row.id.replace(/-/g, ''))], publicRows = await Promise.all(pubRefs.map(r => tx.get(r))), found = publicRows.filter(d => d.exists); if (found.length > 1)
            throw Error('SOURCE_IDENTITY_LOCKED'); const prior = found[0]?.data(); if (prior && (prior.internalStudentId !== row.internalStudentId || prior.teacherDraftId && prior.teacherDraftId !== row.recordId))
            throw Error('SOURCE_IDENTITY_LOCKED'); const projectionId = found[0]?.id || row.id, at = Date.now(), revision = (old?.revision || 0) + 1, record = { ...old, data: row.data, ownerUid: old?.ownerUid || row.ownerUid, teacherUids: row.teacherUids, academyId: actor.academyId, revision, stage: 'published', sourceMode: 'firestore', sourceOrigin: 'notion-import', notionPageId: row.id, notionEditedAt: row.raw.last_edited_time, appProjectionId: projectionId, appPublishedRevision: revision, lastSubmittedRevision: revision, updatedAt: at }; const projected = { ...prior, internalStudentId: row.internalStudentId, studentKey: row.data.studentKey, subject: row.data.subject, examType: row.data.examType === '학력평가' ? '모의고사' : row.data.examType, examDetail: row.data.examDetail, examYear: row.data.examYear ?? null, semester: row.data.semester ?? null, examPeriod: row.data.examPeriod ?? null, title: row.data.title, examDate: row.data.examDate, deadline: row.data.deadline, score: row.data.score, maxScore: row.data.maxScore, grade: row.data.grade, submissionStatus: row.data.submissionStatus, percentile: row.parsed.percentile ?? null, removed: false, archived: false, teacherDraftId: row.recordId, teacherAppRevision: revision, sourceMode: 'firestore', sourceUpdatedAt: row.raw.last_edited_time }; if (Buffer.byteLength(JSON.stringify(row.raw)) > 800000)
            throw Error('ACADEMIC_PAGE_LIMIT'); if (!versionExists)
            tx.set(versionRef, { raw: row.raw, sourceId: row.id, by: actor.uid, at }); tx.set(src, { sourceId: row.id, recordId: row.recordId, version: row.version, appOwned: false, at }); tx.set(target, record); tx.set(db.collection('academicRecords').doc(projectionId), projected); tx.set(db.collection('academicAppHistory').doc(row.recordId + ':' + revision + ':import'), { before: old || null, after: record, by: actor.uid, at, reason: 'source-import' }); return 'imported'; });
        if (outcome === 'imported')
            imported++;
        else
            skipped++;
    }
    return await db.runTransaction(async (tx: any) => { const current = (await tx.get(ref)).data(); if (current?.leaseOwner !== lease)
        throw Error('PUBLISH_IN_PROGRESS'); const next = { ...current, cursor: page.next, done: !page.next, total: (current.total || 0) + page.rows.length, leaseOwner: null, leaseUntil: 0, lastSuccessAt: Date.now(), error: null }; tx.set(ref, next); return { done: next.done, total: next.total, imported, skipped }; });
}
catch (error) {
    await db.runTransaction(async (tx: any) => { const current = (await tx.get(ref)).data(); if (current?.leaseOwner === lease)
        tx.set(ref, { ...current, leaseOwner: null, leaseUntil: 0, error: 'IMPORT_REVIEW_REQUIRED' }); });
    throw error;
} }
export async function resetAcademicMigration(db: any, actor: any, confirmed: unknown) { access(actor); await notAppOnly(db); if (confirmed !== true)
    throw Error('INVALID_INPUT'); return db.runTransaction(async (tx: any) => { const ref = progressRef(db), old = (await tx.get(ref)).data(); if (old?.leaseUntil > Date.now())
    throw Error('PUBLISH_IN_PROGRESS'); if (old)
    tx.set(db.collection('academicImportRuns').doc(progressKey + ':' + (old.startedAt || Date.now())), { ...old, by: actor.uid }); tx.set(ref, { cursor: null, total: 0, done: false, leaseUntil: 0, leaseOwner: null, startedAt: Date.now() }); return { reset: true }; }); }
