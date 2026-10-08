import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { registrationSubjects } from '../../src/lib/studentRegistration.js';
import type { EnrollmentInput, EnrollmentRecord } from '../../src/lib/studentEnrollment.js';
import { assertRegistrationAccess, type RegistrationActor } from './teacherStudentRegistration.js';
import { registrationNotion, REGISTRATION_STUDENT_DATABASE as STUDENTS, REGISTRATION_ENROLLMENT_DATABASE as ENROLLMENTS, type RegistrationNotion } from './teacherStudentRegistrationNotion.js';
import { REGISTRATION_CLASS_DATABASE as CLASSES, REGISTRATION_TEACHER_DATABASE as TEACHERS, resolveRegistrationAssignments } from './teacherRegistrationAssignments.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
import { hashStudentKey } from './security.js';
import { migrateStudentMapping } from './studentIdentity.js';
import { syncAcademicPage } from './academic.js';
import { invalidateTeacherMutation } from './teacherReadCache.js';
import {coreActive,readCoreEnrollment,saveCoreEnrollment} from './academyCore.js';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v);
const ids = z.array(z.string().uuid().transform(uuid)).max(100).refine(v => new Set(v).size === v.length);
export const enrollmentEditSchema = z.object({ subject: z.enum(registrationSubjects), status: z.enum(['등록', '대기', '중단']), startDate: date, endDate: date.nullable(), addTeacherUid: z.string().min(1).max(128).nullable(), removeTeacherIds: ids, classIds: ids }).strict().superRefine((v, c) => {
    if (v.status === '중단' ? !v.endDate : Boolean(v.endDate))
        c.addIssue({ code: 'custom', message: '중단 상태에는 중단일이 필요합니다.' });
    if (v.endDate && v.endDate < v.startDate)
        c.addIssue({ code: 'custom', message: '중단일을 확인해 주세요.' });
    if (v.status === '대기' && v.classIds.length)
        c.addIssue({ code: 'custom', message: '대기 상태에는 반 배정을 해제해 주세요.' });
});
const refFor = (db: any, key: string) => db.collection('teacherStudentEnrollmentEdits').doc(hashStudentKey(key));
const unfinished = (r: any) => r && !['synced', 'discarded'].includes(r.status);
function valid(page: any, database: string, id?: string) { if (!page || page.archived || page.in_trash || uuid(page.parent?.database_id || '') !== database || id && uuid(page.id) !== id)
    throw Error('NOTION_SOURCE_MISMATCH'); }
function relations(p: any) { if (p?.has_more || !Array.isArray(p?.relation))
    throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED'); return p.relation.map((r: any) => uuid(r.id)) as string[]; }
const title = (page: any) => Object.values(page.properties || {}).filter((p: any) => p.type === 'title' || p.title).flatMap((p: any) => p.title || []).map((p: any) => p.plain_text ?? p.text?.content ?? '').join('') || '이름 확인 필요';
function memberAccess(actor: RegistrationActor, m: any) { if (m?.academyId && m.academyId !== actor.academyId || !actor.admin && (!m || m.disabled || m.academyId !== actor.academyId))
    throw Error('FORBIDDEN'); }
async function access(db: any, actor: RegistrationActor, key: string) { assertRegistrationAccess(actor); let configured = ''; try {
    configured = uuid(process.env.NOTION_STUDENT_DATABASE_ID || '');
}
catch { } if (actor.academyId !== 'main' || configured !== STUDENTS)
    throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED'); memberAccess(actor, (await db.collection('academyStudentMemberships').doc(key).get()).data()); }
async function sources(notion: RegistrationNotion, key: string) {
    const [student, result] = await Promise.all([notion(`pages/${key}`), notion(`databases/${ENROLLMENTS}/query`, 'POST', { filter: { property: '학생', relation: { contains: key } }, page_size: 2 })]);
    valid(student, STUDENTS, key);
    if (result.has_more || result.results?.length > 1)
        throw Error('NOTION_DUPLICATE_ENROLLMENT');
    if (result.results?.length !== 1)
        throw Error('NOTION_ENROLLMENT_REQUIRED');
    const enrollment = await notion(`pages/${uuid(result.results[0].id)}`);
    valid(enrollment, ENROLLMENTS);
    const studentIds = relations(enrollment.properties?.['학생']);
    if (studentIds.length !== 1 || studentIds[0] !== key)
        throw Error('NOTION_SOURCE_MISMATCH');
    return { student, enrollment };
}
async function classPages(notion: RegistrationNotion, student: any) { return Promise.all(relations(student.properties?.['소속반']).map(async (id) => { const p = await notion(`pages/${id}`); if (uuid(p.parent?.database_id || '') !== CLASSES || uuid(p.id) !== id)
    throw Error('NOTION_SOURCE_MISMATCH'); return p; })); }
export async function readStudentEnrollment(db: any, actor: RegistrationActor, id: unknown, notion: RegistrationNotion = registrationNotion): Promise<EnrollmentRecord> {
    if(await coreActive(db,actor))return readCoreEnrollment(db,actor,id);
    const key = uuid(z.string().uuid().parse(id));
    await access(db, actor, key);
    const [{ student, enrollment }, saved] = await Promise.all([sources(notion, key), refFor(db, key).get()]);
    const classes = await classPages(notion, student), r = saved.data();
    if (r && r.academyId !== actor.academyId)
        throw Error('FORBIDDEN');
    const subjects = await Promise.all(registrationSubjects.map(async (subject) => ({ subject, status: enrollment.properties[subject]?.status?.name || '', startDate: enrollment.properties[subject + ' 시작일']?.date?.start || null, endDate: enrollment.properties[subject + ' 중단일']?.date?.start || null,
        teachers: await Promise.all(relations(enrollment.properties[subject + ' 담당']).map(async (id) => { const p = await notion(`pages/${id}`); if (uuid(p.parent?.database_id || '') !== TEACHERS)
            throw Error('NOTION_SOURCE_MISMATCH'); return { id, name: title(p) }; })),
        classes: classes.filter(p => p.properties['과목']?.select?.name === subject).map(p => ({ id: uuid(p.id), name: title(p), withdrawalReview: (p.properties['상태']?.status?.name || p.properties['상태']?.select?.name) === '진행 중' && !p.properties['대상 학생']?.has_more && Array.isArray(p.properties['대상 학생']?.relation) && p.properties['대상 학생'].relation.length === 1 && uuid(p.properties['대상 학생'].relation[0].id) === key })) })));
    return { studentKey: key, enrollmentId: uuid(enrollment.id), studentEditedAt: student.last_edited_time, enrollmentEditedAt: enrollment.last_edited_time, subjects, pending: unfinished(r) ? { operationId: r.operationId, studentEditedAt: r.studentEditedAt, enrollmentEditedAt: r.enrollmentEditedAt, data: r.data, status: r.status, canDiscard: !r.steps.some((s: any) => s.attempted || s.done) && !(r.status === 'syncing' && r.leaseUntil > Date.now()) } : null };
}
function sameProperty(actual: any, desired: any) {
    if ('relation' in desired)
        return !actual?.has_more && JSON.stringify((actual?.relation || []).map((r: any) => uuid(r.id)).sort()) === JSON.stringify(desired.relation.map((r: any) => uuid(r.id)).sort());
    if ('status' in desired)
        return actual?.status?.name === desired.status?.name;
    if ('date' in desired)
        return (actual?.date?.start || null) === (desired.date?.start || null);
    if ('multi_select' in desired)
        return JSON.stringify((actual?.multi_select || []).map((r: any) => r.name).sort()) === JSON.stringify(desired.multi_select.map((r: any) => r.name).sort());
    return false;
}
const matches = (page: any, properties: any) => Object.entries(properties).every(([k, v]) => sameProperty(page.properties?.[k], v));
async function plan(db: any, actor: RegistrationActor, key: string, data: EnrollmentInput, student: any, enrollment: any, notion: RegistrationNotion) {
    const [ss, es, cs, classes] = await Promise.all([notion(`databases/${STUDENTS}`), notion(`databases/${ENROLLMENTS}`), notion(`databases/${CLASSES}`), classPages(notion, student)]);
    const rel = ss.properties?.['소속반'], reverse = cs.properties?.['대상 학생'];
    if (rel?.type !== 'relation' || reverse?.type !== 'relation' || uuid(rel.relation?.database_id || '') !== CLASSES || uuid(reverse.relation?.database_id || '') !== STUDENTS || rel.relation?.type !== 'dual_property' || reverse.relation?.type !== 'dual_property' || rel.relation.dual_property?.synced_property_id !== reverse.id || reverse.relation.dual_property?.synced_property_id !== rel.id)
        throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
    for (const [name, type] of [[data.subject, 'status'], [data.subject + ' 시작일', 'date'], [data.subject + ' 중단일', 'date'], [data.subject + ' 담당', 'relation']])
        if (es.properties?.[name]?.type !== type)
            throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
    if (uuid(es.properties[data.subject + ' 담당'].relation?.database_id || '') !== TEACHERS)
        throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
    for (const [name, type] of [['등록상태', 'status'], ['강의명', 'multi_select'], ['수강시작일', 'date']])
        if (ss.properties?.[name]?.type !== type)
            throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
    const originalTeachers = relations(enrollment.properties[data.subject + ' 담당']);
    if (data.removeTeacherIds.some(id => !originalTeachers.includes(id)))
        throw Error('INVALID_INPUT');
    const kept = originalTeachers.filter(id => !data.removeTeacherIds.includes(id));
    if (data.addTeacherUid) {
        const resolved = await resolveRegistrationAssignments(db, actor, { enrollments: [{ subject: data.subject, status: data.status, startDate: data.startDate, endDate: data.endDate, teacherUid: data.addTeacherUid, classIds: [] }] } as any, notion);
        kept.push(resolved.teachers[data.subject]);
    }
    const teacherIds = [...new Set(kept)];
    for (const id of data.classIds) {
        const p = classes.find(p => uuid(p.id) === id) || await notion(`pages/${id}`);
        valid(p, CLASSES, id);
        const academy = (p.properties['학원']?.rich_text || []).map((r: any) => r.plain_text ?? r.text?.content ?? '').join('');
        if (data.status === '중단' ? academy !== actor.academyId || p.properties['과목']?.select?.name !== data.subject || !classes.some(c => uuid(c.id) === id) : academy !== actor.academyId || p.properties['과목']?.select?.name !== data.subject || p.properties['상태']?.status?.name !== '진행 중' || !relations(p.properties['담당 선생님']).some(t => teacherIds.includes(t)))
            throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');
    }
    const classIds = [...classes.filter(p => p.properties['과목']?.select?.name !== data.subject).map(p => uuid(p.id)), ...data.classIds];
    if (classIds.length > 100)
        throw Error('INVALID_INPUT');
    const ep: any = { [data.subject]: { status: { name: data.status } }, [data.subject + ' 시작일']: { date: { start: data.startDate } }, [data.subject + ' 중단일']: { date: data.endDate ? { start: data.endDate } : null }, [data.subject + ' 담당']: { relation: teacherIds.map(id => ({ id })) } };
    const statuses = registrationSubjects.map(s => s === data.subject ? data.status : enrollment.properties[s]?.status?.name || '');
    const starts = registrationSubjects.map(s => s === data.subject ? data.startDate : enrollment.properties[s + ' 시작일']?.date?.start).filter(Boolean).sort();
    const sp = { '소속반': { relation: classIds.map(id => ({ id })) }, '등록상태': { status: { name: statuses.includes('등록') ? '등록' : statuses.includes('대기') ? '대기' : '중단' } }, '강의명': { multi_select: registrationSubjects.filter((_, i) => statuses[i] === '등록').map(name => ({ name })) }, '수강시작일': { date: starts.length ? { start: starts[0] } : null } };
    return [{ id: uuid(enrollment.id), database: ENROLLMENTS, editedAt: enrollment.last_edited_time, properties: ep, attempted: false, done: false }, { id: key, database: STUDENTS, editedAt: student.last_edited_time, properties: sp, attempted: false, done: false }];
}
export async function saveStudentEnrollment(db: any, actor: RegistrationActor, id: unknown, request: any, notion: RegistrationNotion = registrationNotion, sync = syncAcademicPage) {
    if(await coreActive(db,actor)){const result=await saveCoreEnrollment(db,actor,id,request,v=>enrollmentEditSchema.parse(v));invalidateTeacherMutation('save-student-enrollment');return result;}
    const key = uuid(z.string().uuid().parse(id)), operationId = z.string().uuid().parse(request.operationId), data = enrollmentEditSchema.parse(request.data) as EnrollmentInput;
    const studentEditedAt = z.string().datetime().parse(request.studentEditedAt), enrollmentEditedAt = z.string().datetime().parse(request.enrollmentEditedAt);
    await access(db, actor, key);
    const ref = refFor(db, key), lease = randomUUID(), previous = (await ref.get()).data();
    if (previous && previous.academyId !== actor.academyId)
        throw Error('FORBIDDEN');
    const equal = (r: any) => r.operationId === operationId && r.studentEditedAt === studentEditedAt && r.enrollmentEditedAt === enrollmentEditedAt && JSON.stringify(r.data) === JSON.stringify(data);
    let steps: any[] | undefined;
    if (previous?.operationId === operationId) {
        if (!equal(previous))
            throw Error('STUDENT_ENROLLMENT_REQUEST_CONFLICT');
        if (previous.status === 'synced')
            return { status: 'synced', alreadySaved: true };
    }
    else {
        if (unfinished(previous))
            throw Error('STUDENT_ENROLLMENT_IN_PROGRESS');
        const { student, enrollment } = await sources(notion, key);
        if (student.last_edited_time !== studentEditedAt || enrollment.last_edited_time !== enrollmentEditedAt)
            throw Error('NOTION_EDIT_CONFLICT');
        steps = await plan(db, actor, key, data, student, enrollment, notion);
    }
    let record: any = await db.runTransaction(async (tx: any) => {
        const r = (await tx.get(ref)).data(), member = (await tx.get(db.collection('academyStudentMemberships').doc(key))).data();
        memberAccess(actor, member);
        if (r && r.academyId !== actor.academyId)
            throw Error('FORBIDDEN');
        if (r?.operationId === operationId) {
            if (!equal(r) || r.status === 'discarded')
                throw Error('STUDENT_ENROLLMENT_REQUEST_CONFLICT');
            if (r.status === 'synced')
                return { ...r, alreadySaved: true };
            if (r.status === 'syncing' && r.leaseUntil > Date.now())
                throw Error('STUDENT_ENROLLMENT_IN_PROGRESS');
        }
        else if (unfinished(r) || !steps)
            throw Error('STUDENT_ENROLLMENT_IN_PROGRESS');
        const next = { ...(r?.operationId === operationId ? r : { studentKey: key, academyId: actor.academyId, operationId, data, studentEditedAt, enrollmentEditedAt, steps, createdAt: Date.now() }), status: 'syncing', lease, leaseUntil: Date.now() + 180000, updatedAt: Date.now() };
        tx.set(ref, next);
        return next;
    });
    if (record.alreadySaved)
        return { status: 'synced', alreadySaved: true };
    async function checkpoint(patch: any, check = true) { record = await db.runTransaction(async (tx: any) => { const r = (await tx.get(ref)).data(); if (check)
        memberAccess(actor, (await tx.get(db.collection('academyStudentMemberships').doc(key))).data()); if (r?.lease !== lease || r.operationId !== operationId)
        throw Error('STUDENT_ENROLLMENT_IN_PROGRESS'); const next = { ...r, ...patch, leaseUntil: patch.lease === null ? 0 : Date.now() + 180000, updatedAt: Date.now() }; tx.set(ref, next); return next; }); }
    try {
        for (let i = 0; i < record.steps.length; i++) {
            const step = record.steps[i];
            if (step.done)
                continue;
            // A summary derived from the enrollment must not overwrite a newer subject edit.
            if (i === 1) {
                const first = record.steps[0], source = await notion(`pages/${first.id}`);
                valid(source, ENROLLMENTS, first.id);
                if (source.last_edited_time !== first.confirmedEditedAt)
                    throw Error('NOTION_EDIT_CONFLICT');
            }
            let page = await notion(`pages/${step.id}`);
            valid(page, step.database, step.id);
            if (step.database === ENROLLMENTS) {
                const links = relations(page.properties['학생']);
                if (links.length !== 1 || links[0] !== key)
                    throw Error('NOTION_SOURCE_MISMATCH');
            }
            if (!matches(page, step.properties)) {
                if (step.attempted)
                    throw Error('STUDENT_ENROLLMENT_RESULT_UNCERTAIN');
                if (page.last_edited_time !== step.editedAt)
                    throw Error('NOTION_EDIT_CONFLICT');
                if (data.addTeacherUid) {
                    const assigned = await resolveRegistrationAssignments(db, actor, { enrollments: [{ ...data, teacherUid: data.addTeacherUid, classIds: [] }] } as any, notion);
                    if (!record.steps[0].properties[data.subject + ' 담당'].relation.some((r: any) => uuid(r.id) === assigned.teachers[data.subject]))
                        throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');
                }
                if (i === 1 && data.status !== '중단')
                    for (const id of data.classIds) {
                        const p = await notion(`pages/${id}`);
                        valid(p, CLASSES, id);
                        const academy = (p.properties['학원']?.rich_text || []).map((r: any) => r.plain_text ?? r.text?.content ?? '').join('');
                        if (academy !== actor.academyId || p.properties['과목']?.select?.name !== data.subject || p.properties['상태']?.status?.name !== '진행 중' || !relations(p.properties['담당 선생님']).some(t => record.steps[0].properties[data.subject + ' 담당'].relation.some((r: any) => uuid(r.id) === t)))
                            throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');
                    }
                const latest = await notion(`pages/${step.id}`);
                valid(latest, step.database, step.id);
                if (latest.last_edited_time !== step.editedAt)
                    throw Error('NOTION_EDIT_CONFLICT');
                const next = structuredClone(record.steps);
                next[i].attempted = true;
                await checkpoint({ steps: next });
                try {
                    await notion(`pages/${step.id}`, 'PATCH', { properties: step.properties });
                }
                catch (e) {
                    if (/^NOTION_4\d\d$/.test(e instanceof Error ? e.message : '')) {
                        const next = structuredClone(record.steps);
                        next[i].attempted = false;
                        await checkpoint({ steps: next });
                    }
                    throw e;
                }
                page = await notion(`pages/${step.id}`);
                valid(page, step.database, step.id);
                if (!matches(page, step.properties))
                    throw Error('STUDENT_ENROLLMENT_RESULT_UNCERTAIN');
            }
            const next = structuredClone(record.steps);
            next[i].done = true;
            next[i].confirmedEditedAt = page.last_edited_time;
            await checkpoint({ steps: next });
        }
        const { student, enrollment } = await sources(notion, key);
        if (uuid(enrollment.id) !== record.steps[0].id)
            throw Error('NOTION_DUPLICATE_ENROLLMENT');
        // Re-read current source so recovery also preserves later manual edits.
        await access(db, actor, key);
        const guardedDb = { collection: (name: string) => db.collection(name), runTransaction: (callback: any) => db.runTransaction(async (tx: any) => { const r = (await tx.get(ref)).data(); memberAccess(actor, (await tx.get(db.collection('academyStudentMemberships').doc(key))).data()); if (r?.lease !== lease || r.operationId !== operationId || r.status !== 'syncing')
                throw Error('STUDENT_ENROLLMENT_IN_PROGRESS'); return callback(tx); }) };
        await sync(guardedDb as any, enrollment, async () => ({ notionStudentPageId: key, studentKey: key, studentDisplayName: title(student), parentPhonePinHash: '' }), migrateStudentMapping);
        await checkpoint({ status: 'synced', lease: null });
        invalidateTeacherMutation('save-student-enrollment');
        return { status: 'synced', alreadySaved: false };
    }
    catch (e) {
        await checkpoint({ status: record.steps.some((s: any) => s.attempted && !s.done) ? 'uncertain' : 'failed', lease: null }, false).catch(() => { });
        invalidateTeacherMutation('save-student-enrollment');
        throw e;
    }
}
export async function discardStudentEnrollment(db: any, actor: RegistrationActor, id: unknown, operation: unknown) {
    const key = uuid(z.string().uuid().parse(id)), operationId = z.string().uuid().parse(operation);
    await access(db, actor, key);
    await db.runTransaction(async (tx: any) => { const ref = refFor(db, key), r = (await tx.get(ref)).data(); memberAccess(actor, (await tx.get(db.collection('academyStudentMemberships').doc(key))).data()); if (!r || r.academyId !== actor.academyId || r.operationId !== operationId || !unfinished(r) || r.steps.some((s: any) => s.attempted || s.done) || r.status === 'syncing' && r.leaseUntil > Date.now())
        throw Error('STUDENT_ENROLLMENT_IN_PROGRESS'); tx.set(ref, { ...r, status: 'discarded', lease: null, leaseUntil: 0 }); });
    return { status: 'discarded' };
}
