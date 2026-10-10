import { z } from 'zod';
import { registrationSubjects } from '../../src/lib/studentRegistration.js';
import type { EnrollmentInput, EnrollmentRecord } from '../../src/lib/studentEnrollment.js';
import { assertRegistrationAccess, type RegistrationActor } from './teacherStudentRegistration.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
import { hashStudentKey } from './security.js';
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
function memberAccess(actor: RegistrationActor, m: any) { if (m?.academyId && m.academyId !== actor.academyId || !actor.admin && (!m || m.disabled || m.academyId !== actor.academyId))
    throw Error('FORBIDDEN'); }
async function access(db: any, actor: RegistrationActor, key: string) { assertRegistrationAccess(actor);
    if (actor.academyId !== 'main') throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED');
    if (!await coreActive(db, actor)) throw Error('CORE_NOT_READY'); memberAccess(actor, (await db.collection('academyStudentMemberships').doc(key).get()).data()); }
export async function readStudentEnrollment(db: any, actor: RegistrationActor, id: unknown): Promise<EnrollmentRecord> {
    if (!await coreActive(db, actor)) throw Error('CORE_NOT_READY');
    return readCoreEnrollment(db, actor, id);
}
export async function saveStudentEnrollment(db: any, actor: RegistrationActor, id: unknown, request: any) {
    if (!await coreActive(db, actor)) throw Error('CORE_NOT_READY');
    const result = await saveCoreEnrollment(db, actor, id, request, v => enrollmentEditSchema.parse(v)); invalidateTeacherMutation('save-student-enrollment'); return result;
}
export async function discardStudentEnrollment(db: any, actor: RegistrationActor, id: unknown, operation: unknown) {
    const key = uuid(z.string().uuid().parse(id)), operationId = z.string().uuid().parse(operation);
    await access(db, actor, key);
    await db.runTransaction(async (tx: any) => { const ref = refFor(db, key), r = (await tx.get(ref)).data(); memberAccess(actor, (await tx.get(db.collection('academyStudentMemberships').doc(key))).data()); if (!r || r.academyId !== actor.academyId || r.operationId !== operationId || !unfinished(r) || r.steps.some((s: any) => s.attempted || s.done) || r.status === 'syncing' && r.leaseUntil > Date.now())
        throw Error('STUDENT_ENROLLMENT_IN_PROGRESS'); tx.set(ref, { ...r, status: 'discarded', lease: null, leaseUntil: 0 }); });
    return { status: 'discarded' };
}
