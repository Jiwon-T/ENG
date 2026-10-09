import { readSourceSchedules } from './teacherNotionWorkspace.js';
import { createHash, randomUUID } from 'node:crypto';
import { registrationNotion } from './teacherStudentRegistrationNotion.js';
import { SCHEDULE_DATABASE, schedulePlaceOptions } from './teacherSchedulePlaces.js';
import { teacherScheduleSchema } from './teacherWorkspacePolicy.js';
import { hashStudentKey } from './security.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
const hash = (value: any) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function auditScheduleReadiness(db: any, actor: any, notion = registrationNotion) { if (!actor.admin || actor.academyId !== 'main')
    throw Error('FORBIDDEN'); const core = (await db.collection('academyCoreAuthority').doc('main').get()).data(), classes = (await db.collection('academyClassAuthority').doc('main').get()).data(), config = (await db.collection('appScheduleConfig').doc('main').get()).data(); const schema = await notion(`databases/${SCHEDULE_DATABASE}`), places = schedulePlaceOptions(schema); const issues: string[] = [], proofs = []; if (!core?.active || !classes?.active)
    issues.push('CORE_NOT_READY'); if (!config?.places || JSON.stringify([...config.places].sort()) !== JSON.stringify([...places].sort()))
    issues.push('PLACES_NOT_IMPORTED'); const sourceIds = new Set<string>(); let cursor: string | undefined, count = 0; do {
    const page = await notion(`databases/${SCHEDULE_DATABASE}/query`, 'POST', { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    if (!Array.isArray(page.results) || page.has_more && !page.next_cursor)
        throw Error('SCHEDULE_CONFIG_MIGRATION_REQUIRED');
    for (const source of page.results) {
        if (source.archived || source.in_trash)
            continue;
        if (++count > 200)
            throw Error('SCHEDULE_PROJECTION_LIMIT');
        const id = uuid(source.id);
        sourceIds.add(id);
        if (uuid(source.parent?.database_id || '') !== SCHEDULE_DATABASE)
            throw Error('SOURCE_IDENTITY_LOCKED');
        const local = await db.collection('teacherSchedules').where('notionPageId', '==', id).limit(2).get();
        if (local.docs.length !== 1) {
            issues.push(id + ':SOURCE_NOT_IMPORTED');
            continue;
        }
        const doc = local.docs[0], r = doc.data();
        // Deleted in the app (or deletion requested) is the academy's decision and needs no review.
        if (r.archived || r.deleteRequested)
            continue;
        if (r.academyId !== 'main' || r.notionWrite?.leaseUntil > Date.now() || ['publishing', 'processing', 'notion_saved'].includes(r.stage)) {
            issues.push(id + ':PENDING');
            continue;
        }
        if (source.properties?.['대상 학생']?.has_more) {
            issues.push(id + ':RELATION_REVIEW_REQUIRED');
            continue;
        }
        const recipients = (source.properties?.['대상 학생']?.relation || []).map((v: any) => uuid(v.id));
        const text = (p: any) => (p?.title || p?.rich_text || []).map((v: any) => v.plain_text ?? v.text?.content ?? '').join(''), choice = (p: any) => p?.select?.name || p?.status?.name || '';
        const p = source.properties || {}, range = p['날짜 및 시간']?.date;
        const day = (v: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(v)), time = (v: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(v));
        let data: any;
        try {
            data = teacherScheduleSchema.parse({ title: text(p['일정명']), subject: choice(p['과목']) || '영어', students: recipients, date: day(range.start), start: time(range.start), end: time(range.end), kind: choice(p['일정 종류']) || '기타', status: choice(p['일정 상태']) || '예정', place: choice(p['장소']), note: text(p['안내 내용']) });
        }
        catch {
            issues.push(id + ':INVALID_SOURCE');
            continue;
        }
        // When the app and Notion differ, the app copy is right (academy decision); it is what the switch keeps.

        for (const key of r.data.students) {
            const member = (await db.collection('academyStudentMemberships').doc(key).get()).data(), mapping = (await db.collection('notionStudentMappings').doc(hashStudentKey(key)).get()).data();
            if (!member || member.disabled || member.academyId !== 'main' || !mapping?.internalStudentId || member.internalStudentId && member.internalStudentId !== mapping.internalStudentId)
                issues.push(id + ':STUDENT_LINK_REQUIRED');
        }
        proofs.push({ ref: doc.ref, revision: r.revision, editedAt: source.last_edited_time, hash: hash(r.data) });
    }
    cursor = page.has_more ? page.next_cursor : undefined;
} while (cursor); const stored = await db.collection('teacherSchedules').where('academyId', '==', 'main').limit(501).get(); if (stored.docs.length > 500)
    throw Error('SCHEDULE_PROJECTION_LIMIT'); for (const doc of stored.docs) {
    const r = doc.data();
        if(!r.archived&&(r.notionWrite?.leaseUntil>Date.now()||['publishing','processing','notion_saved'].includes(r.stage)||r.notionWrite?.attempted&&!r.notionWrite?.done))issues.push(doc.id+':PENDING_REQUEST');
    if (r.notionPageId && !r.archived && !r.deleteRequested && !r.appEdited && r.data?.status !== '취소' && !sourceIds.has(uuid(r.notionPageId)))
        issues.push(doc.id + ':SOURCE_REMOVED_REVIEW_REQUIRED');
} return { ready: issues.length === 0, count, issues, places, proofs, hash: hash([places, proofs.map(v => [v.ref.id, v.revision, v.editedAt, v.hash])]) }; }
export async function activateAppSchedules(db: any, actor: any, confirmed: unknown, notion = registrationNotion) { if (confirmed !== true)
    throw Error('INVALID_INPUT'); const proof = await auditScheduleReadiness(db, actor, notion); if (!proof.ready)
    throw Error('SCHEDULE_MIGRATION_NOT_READY'); const runId = randomUUID(); return db.runTransaction(async (tx: any) => { const authority = db.collection('appScheduleAuthority').doc('main'), old = (await tx.get(authority)).data(); if (old?.active)
    return { active: true, alreadyActive: true }; if (!(await tx.get(db.collection('academyCoreAuthority').doc('main'))).data()?.active || !(await tx.get(db.collection('academyClassAuthority').doc('main'))).data()?.active)
    throw Error('CORE_NOT_READY'); for (const item of proof.proofs) {
    const current = (await tx.get(item.ref)).data();
    if (!current || current.revision !== item.revision || hash(current.data) !== item.hash || current.notionWrite?.leaseUntil > Date.now())
        throw Error('DRAFT_CONFLICT');
} const config = (await tx.get(db.collection('appScheduleConfig').doc('main'))).data(); if (!config?.places || JSON.stringify([...config.places].sort()) !== JSON.stringify([...proof.places].sort()))
    throw Error('SCHEDULE_CONFIG_MIGRATION_REQUIRED'); tx.set(db.collection('scheduleVerificationRuns').doc(runId), { verified: true, academyId: 'main', hash: proof.hash, count: proof.count, at: Date.now(), by: actor.uid }); tx.set(authority, { active: true, schemaVersion: 1, verifiedRunId: runId, verificationHash: proof.hash, by: actor.uid, at: Date.now() }); return { active: true, count: proof.count }; }); }
/** Explicit preparation only; does not activate the normal read path. */
export async function prepareScheduleRecords(db: any, actor: any, confirmed: unknown) { if (!actor.admin || actor.academyId !== 'main')
    throw Error('FORBIDDEN'); if (confirmed !== true)
    throw Error('INVALID_INPUT'); const schema = await registrationNotion(`databases/${SCHEDULE_DATABASE}`), places = schedulePlaceOptions(schema), sources = await readSourceSchedules(db, actor, undefined, true); if (sources.length > 200)
    throw Error('SCHEDULE_PROJECTION_LIMIT'); let imported = 0, kept = 0; for (const source of sources) {
    const data = teacherScheduleSchema.parse(source.data), existing = await db.collection('teacherSchedules').where('notionPageId', '==', source.notionPageId).limit(2).get();
    if (existing.docs.length > 1)
        throw Error('SOURCE_IDENTITY_LOCKED');
    const ref = existing.docs[0]?.ref || db.collection('teacherSchedules').doc(source.id);
    const applied = await db.runTransaction(async (tx: any) => { const old = (await tx.get(ref)).data(); if (old) {
        if (old.academyId !== actor.academyId)
            throw Error('FORBIDDEN');
        return false;
    } for (const key of data.students) {
        const member = (await tx.get(db.collection('academyStudentMemberships').doc(key))).data(), mapping = (await tx.get(db.collection('notionStudentMappings').doc(hashStudentKey(key)))).data();
        if (!member || member.disabled || member.academyId !== actor.academyId || !mapping?.internalStudentId)
            throw Error('STUDENT_MAPPING_CONFLICT');
    } const record = { data, ownerUid: source.ownerUid || null, academyId: actor.academyId, revision: 1, stage: source.stage === 'published' ? 'published' : 'draft', notionPageId: source.notionPageId, notionEditedAt: source.notionEditedAt, sourceOrigin: 'notion-import', updatedAt: Date.now() }; tx.set(ref, record); tx.set(db.collection('scheduleAppHistory').doc(ref.id + ':1:import'), { before: null, after: record, by: actor.uid, at: Date.now(), reason: 'source-import' }); return true; });
    if (applied)
        imported++;
    else
        kept++;
} await db.runTransaction(async (tx: any) => { const ref = db.collection('appScheduleConfig').doc('main'), old = (await tx.get(ref)).data(); tx.set(ref, { ...old, places, sourceSchemaHash: hash(places), verifiedAt: Date.now(), by: actor.uid }); }); return { imported, kept, places: places.length }; }
