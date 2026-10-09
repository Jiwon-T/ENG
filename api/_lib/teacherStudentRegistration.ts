import {admissionSchema} from './studentAdmission.js';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { subjects } from './teacherWorkspacePolicy.js';
import { registrationGrades, type RegistrationSummary } from '../../src/lib/studentRegistration.js';

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, '날짜를 확인해 주세요.');
const phone = z.string().trim().max(30).transform(value => value.replace(/[\s()-]/g, '')).refine(value => value === '' || /^0\d{8,10}$/.test(value), '연락처를 확인해 주세요.');
export const studentRegistrationSchema = z.object({
    purpose:z.enum(['new','additional']).default('new'),
    intakeStage:z.enum(['consultation','new']).default('new'),
    existingStudentKey:z.string().uuid().nullable().default(null),
    admission:admissionSchema,
    name: z.string().trim().min(1).max(60),
    school: z.string().trim().max(80).default(''),
    grade: z.enum(['', ...registrationGrades]).default(''),
    studentPhone: phone.default(''), guardianPhone: phone.default(''),
    studentSalutation: z.string().trim().max(80).default(''),
    guardianSalutation: z.string().trim().max(80).default(''),
    guardianName: z.string().trim().max(80).default(''),
    tuition: z.number().int().nonnegative().max(100_000_000).nullable().default(null),
    paymentDeadline: z.string().trim().max(200).default(''),
    enrollments: z.array(z.object({
        subject: z.enum(subjects), status: z.enum(['등록', '대기', '중단']),
        startDate: calendarDate, endDate: calendarDate.nullable().default(null),
        teacherUid: z.string().min(1).max(128).nullable().default(null),
        classIds: z.array(z.string().uuid().transform(value=>value.toLowerCase())).max(20).default([]),
    }).strict().superRefine((value, ctx) => {
        if (new Set(value.classIds).size !== value.classIds.length) ctx.addIssue({code:'custom',message:'반을 중복 선택할 수 없습니다.'});
        if (value.classIds.length && (value.status !== '등록' || !value.teacherUid)) ctx.addIssue({code:'custom',message:'반 배정에는 등록 상태와 담당 선생님이 필요합니다.'});
        if (value.status === '중단' && !value.endDate) ctx.addIssue({code:'custom', message:'중단일을 입력해 주세요.'});
        if (value.status !== '중단' && value.endDate) ctx.addIssue({code:'custom', message:'등록 상태에는 중단일을 입력할 수 없습니다.'});
        if (value.endDate && value.endDate < value.startDate) ctx.addIssue({code:'custom', message:'중단일은 시작일 이후여야 합니다.'});
    })).min(1).max(subjects.length),
}).strict().superRefine((value, ctx) => {
    if(value.purpose==='additional'&&!value.existingStudentKey||value.purpose==='new'&&value.existingStudentKey)ctx.addIssue({code:'custom',message:'추가 과목 상담은 기존 학생을 선택해 주세요.'});
    if (new Set(value.enrollments.map(item => item.subject)).size !== value.enrollments.length) ctx.addIssue({code:'custom', message:'과목별 수강은 한 번씩 입력해 주세요.'});
});
export type StudentRegistration = z.infer<typeof studentRegistrationSchema>;
/** Same style as the existing student list: "이용준 (세교중2)" — school without "학교", then the grade number ("효명고" + "고2" → "효명고2"). */
export function studentRegistrationTitle(value: StudentRegistration) {
    const raw = String(value.school || '').replace(/\s+/g, ''), short = raw.replace(/초등학교$/, '초').replace(/중학교$/, '중').replace(/고등학교$/, '고')
        .replace(/학교$/, ''), school = short || raw;
    const grade = String(value.grade || '').trim(), year = grade.match(/\d/)?.[0] || '';
    const suffix = school ? school + (year || grade) : grade;
    return value.name.trim() + (suffix ? ` (${suffix})` : '');
}
export type RegistrationActor = {uid:string; admin:boolean; principal?:boolean; academyId:string|null};
export function assertRegistrationAccess(actor: RegistrationActor, previous?:any) {
    if (!actor.admin && !actor.principal) throw new Error('FORBIDDEN');
    if (!actor.academyId || !actor.uid) throw new Error('TEACHER_NOT_CONFIGURED');
    if (previous && previous.academyId !== actor.academyId) throw new Error('FORBIDDEN');
}
export function registrationDocumentId(academyId:string, requestId:string) {
    return createHash('sha256').update(JSON.stringify([academyId,requestId])).digest('hex');
}
// Server-only input storage; the sync worker consumes an immutable revision.
// Store the input and pending sync state atomically; never claim Notion completion here.
export async function saveStudentRegistration(db:any, actor:RegistrationActor, input:unknown, requestId:unknown, expectedRevision?:number, writeId?:unknown, sourceMode?:'firestore') {
    assertRegistrationAccess(actor);
    const key = z.string().uuid().parse(requestId);
    const value = studentRegistrationSchema.parse(input);
    const operation = z.string().uuid().parse(writeId ?? (expectedRevision === undefined ? key : randomUUID()));
    if (expectedRevision !== undefined) z.number().int().positive().parse(expectedRevision);
    const ref = db.collection('teacherStudentRegistrations').doc(registrationDocumentId(actor.academyId!,key));
    return db.runTransaction(async (transaction:any) => {
        const previous = (await transaction.get(ref)).data();
        assertRegistrationAccess(actor,previous);
        if(previous?.sourceMode==='firestore'&&sourceMode!=='firestore')throw Error('CORE_NOT_READY');
        if(sourceMode==='firestore'&&!(await transaction.get(db.collection('academyCoreAuthority').doc('main'))).data()?.active)throw Error('CORE_NOT_READY');
        if(previous?.residentAt)throw Error('REGISTRATION_ALREADY_RESIDENT');
        if(value.existingStudentKey){const member=(await transaction.get(db.collection('academyStudentMemberships').doc(value.existingStudentKey))).data();if(!member||member.disabled||member.academyId!==actor.academyId)throw Error('FORBIDDEN');}
        if (previous?.lastWriteId === operation) {
            if (JSON.stringify(studentRegistrationSchema.parse(previous.data)) !== JSON.stringify(value) || previous.lastWriteBaseRevision !== (expectedRevision ?? null)) throw new Error('REGISTRATION_REQUEST_CONFLICT');
            return {id:ref.id, revision:previous.revision, syncStatus:previous.syncStatus, alreadySaved:true};
        }
        if (previous && expectedRevision === undefined) {
            if (JSON.stringify(studentRegistrationSchema.parse(previous.data)) !== JSON.stringify(value)) throw new Error('REGISTRATION_REQUEST_CONFLICT');
            return {id:ref.id, revision:previous.revision, syncStatus:previous.syncStatus, alreadySaved:true};
        }
        if (!previous && expectedRevision !== undefined || previous && previous.revision !== expectedRevision) throw new Error('REGISTRATION_CONFLICT');
        if (previous && (['syncing','uncertain','synced'].includes(previous.syncStatus) || previous.notionStudentPageId || previous.studentCreateAttempted || previous.enrollmentCreateAttempted)) throw new Error('REGISTRATION_SYNC_IN_PROGRESS');
        const revision = (previous?.revision || 0) + 1;
        transaction.set(ref, {
            academyId:actor.academyId, ownerUid:previous?.ownerUid || actor.uid,
            requestId:key, lastWriteId:operation, lastWriteBaseRevision:expectedRevision ?? null,
            data:value, title:studentRegistrationTitle(value), revision,
            createdAt:previous?.createdAt || Date.now(), updatedAt:Date.now(),
            notionStudentPageId:previous?.notionStudentPageId || null,
            syncStatus:'pending', syncError:null,...(sourceMode?{sourceMode}:{}),
        });
        return {id:ref.id, revision, syncStatus:'pending', alreadySaved:false};
    });
}

export function registrationSummary(id:string, record:any): RegistrationSummary {
    return {id, title:record.title, revision:record.revision, syncStatus:record.syncStatus, updatedAt:record.updatedAt,
        purpose:record.data?.purpose||'new',intakeStage:record.data?.intakeStage||'new',existingStudentKey:record.data?.existingStudentKey||null,sourceMode:record.sourceMode||'notion',studentKey:record.studentKey||record.notionStudentPageId||record.data?.existingStudentKey||null,
        canEdit:!(['syncing','uncertain','synced'].includes(record.syncStatus) || record.notionStudentPageId || record.studentCreateAttempted || record.enrollmentCreateAttempted),
        studentSaved:Boolean(record.studentSaved),enrollmentSaved:Boolean(record.enrollmentSaved),
        enrollments:(record.data?.enrollments || []).map((item:any)=>({subject:item.subject, status:item.status,startDate:item.startDate}))};
}
export async function listStudentRegistrations(db:any, actor:RegistrationActor) {
    assertRegistrationAccess(actor);
    const result = await db.collection('teacherStudentRegistrations').where('academyId','==',actor.academyId).get();
    return result.docs.filter((doc:any)=>doc.data().academyId === actor.academyId&&!doc.data().residentAt)
        .map((doc:any)=>registrationSummary(doc.id,doc.data()))
        .sort((a:RegistrationSummary,b:RegistrationSummary)=>b.updatedAt-a.updatedAt || a.id.localeCompare(b.id));
}
/** Move only the intake-list state; preserve student, enrollment, accounts and report IDs. */
export async function convertRegistrationToResident(db:any,actor:RegistrationActor,id:unknown,revision:unknown,verifyAdditional?:(key:string)=>Promise<any>){
    assertRegistrationAccess(actor);
    const key=z.string().regex(/^[a-f0-9]{64}$/).parse(id),version=z.number().int().positive().parse(revision),ref=db.collection('teacherStudentRegistrations').doc(key);
    const initial=(await ref.get()).data();if(!initial)throw Error('REGISTRATION_NOT_FOUND');assertRegistrationAccess(actor,initial);
    if(initial.residentAt)return {id:key,studentKey:initial.studentKey||initial.notionStudentPageId||initial.data.existingStudentKey,alreadyConverted:true};
    const data=studentRegistrationSchema.parse(initial.data);
    if(data.purpose==='additional'){
        if(!verifyAdditional)throw Error('REGISTRATION_ENROLLMENT_REQUIRED');
        const enrolled=await verifyAdditional(data.existingStudentKey!);
        if(enrolled.pending||data.enrollments.some(e=>!enrolled.subjects.some((s:any)=>s.subject===e.subject&&s.status==='등록')))throw Error('REGISTRATION_ENROLLMENT_REQUIRED');
    }
    return db.runTransaction(async(tx:any)=>{
        const current=(await tx.get(ref)).data();if(!current)throw Error('REGISTRATION_NOT_FOUND');assertRegistrationAccess(actor,current);
        if(current.residentAt)return {id:key,studentKey:current.studentKey||current.notionStudentPageId||current.data.existingStudentKey,alreadyConverted:true};
        if(current.revision!==version||JSON.stringify(current.data)!==JSON.stringify(initial.data))throw Error('REGISTRATION_CONFLICT');
        if(data.purpose==='new'&&(data.intakeStage==='consultation'||current.syncStatus!=='synced'||!data.enrollments.some(e=>e.status==='등록')))throw Error('REGISTRATION_ENROLLMENT_REQUIRED');
        const studentKey=current.studentKey||current.notionStudentPageId||data.existingStudentKey;
        if(!studentKey)throw Error('REGISTRATION_ENROLLMENT_REQUIRED');
        const member=(await tx.get(db.collection('academyStudentMemberships').doc(studentKey))).data();
        if(!member||member.disabled||member.academyId!==actor.academyId)throw Error('FORBIDDEN');
        tx.set(ref,{...current,residentAt:Date.now(),residentBy:actor.uid,updatedAt:Date.now()});
        return {id:key,studentKey,alreadyConverted:false};
    });
}
export async function readStudentRegistration(db:any, actor:RegistrationActor, id:unknown) {
    assertRegistrationAccess(actor);
    const key = z.string().regex(/^[a-f0-9]{64}$/).parse(id);
    const record = (await db.collection('teacherStudentRegistrations').doc(key).get()).data();
    if (!record) throw new Error('REGISTRATION_NOT_FOUND');
    assertRegistrationAccess(actor,record);
    return {...registrationSummary(key,record),requestId:record.requestId,data:studentRegistrationSchema.parse(record.data)};
}

