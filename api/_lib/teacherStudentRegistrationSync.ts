import {admissionBlocks,assertAdmissionNotionSchema} from './studentAdmission.js';
import {resolveRegistrationAssignments, REGISTRATION_CLASS_DATABASE, REGISTRATION_TEACHER_DATABASE} from './teacherRegistrationAssignments.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertRegistrationAccess, studentRegistrationSchema, type RegistrationActor } from './teacherStudentRegistration.js';
import { registrationNotion, findRegistrationPages, assertRegistrationSchema, assertRegistrationPage, registrationStudentProperties, registrationEnrollmentProperties, REGISTRATION_STUDENT_DATABASE, REGISTRATION_ENROLLMENT_DATABASE, type RegistrationNotion } from './teacherStudentRegistrationNotion.js';
import { normalizeNotionPageId } from './notionPageId.js';
import { migrateStudentMapping } from './studentIdentity.js';
import { syncAcademicPage } from './academic.js';
import { invalidateTeacherMutation } from './teacherReadCache.js';
const LEASE_MS=180_000;
interface Dependencies {
    notion:RegistrationNotion;
    mapStudent:typeof migrateStudentMapping;
    syncEnrollment:typeof syncAcademicPage;
}
const defaults:Dependencies={notion:registrationNotion,mapStudent:migrateStudentMapping,syncEnrollment:syncAcademicPage};
function definiteCreationFailure(error:unknown) { return /^NOTION_4\d\d$/.test(error instanceof Error?error.message:''); }
function failureCode(error:unknown) {
    const message=error instanceof Error?error.message:'';
    return /^(NOTION_REGISTRATION_|NOTION_ADMISSION_|NOTION_EDIT_CONFLICT$|ACADEMY_MEMBERSHIP_CONFLICT$)/.test(message)?message:'NOTION_REGISTRATION_SYNC_FAILED';
}
export async function syncStudentRegistration(db:any,actor:RegistrationActor,id:unknown,revision:unknown,deps:Dependencies=defaults) {
    assertRegistrationAccess(actor);
    const key=z.string().regex(/^[a-f0-9]{64}$/).parse(id),version=z.number().int().positive().parse(revision);
    // This rollout uses the observed existing main academy databases. Do not write
    // another academy's registration into the global main student directory.
    let configuredDatabase:string|null=null;try{configuredDatabase=normalizeNotionPageId(process.env.NOTION_STUDENT_DATABASE_ID || '');}catch{}
    if(actor.academyId!=='main' || configuredDatabase!==REGISTRATION_STUDENT_DATABASE)throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED');
    const ref=db.collection('teacherStudentRegistrations').doc(key),lease=randomUUID();
    let record:any=await db.runTransaction(async(tx:any)=>{
        if((await tx.get(db.collection('academyCoreAuthority').doc('main'))).data()?.active)throw Error('CORE_NOT_READY');
        const previous=(await tx.get(ref)).data();if(!previous)throw Error('REGISTRATION_NOT_FOUND');assertRegistrationAccess(actor,previous);
        if(previous.sourceMode==='firestore')throw Error('CORE_NOT_READY');
        if(previous.revision!==version)throw Error('REGISTRATION_CONFLICT');
        if(previous.data?.purpose==='additional'||previous.data?.intakeStage==='consultation')throw Error('REGISTRATION_ENROLLMENT_REQUIRED');
        if(previous.syncStatus==='synced')return {...previous,alreadySynced:true};
        if(previous.syncStatus==='syncing' && previous.syncLeaseUntil>Date.now())throw Error('REGISTRATION_SYNC_IN_PROGRESS');
        const next={...previous,syncStatus:'syncing',syncLease:lease,syncLeaseUntil:Date.now()+LEASE_MS,syncError:null};
        tx.set(ref,next);return next;
    });
    if(record.alreadySynced)return {id:key,revision:version,syncStatus:'synced',alreadySynced:true};
    async function checkpoint(patch:any) {
        record=await db.runTransaction(async(tx:any)=>{
            const current=(await tx.get(ref)).data();
            if(current?.syncLease!==lease || current.revision!==version)throw Error('REGISTRATION_SYNC_IN_PROGRESS');
            const next={...current,...patch,updatedAt:Date.now()};tx.set(ref,next);return next;
        });
    }
    try {
        const value=studentRegistrationSchema.parse(record.data);
        const [studentSchema,enrollmentSchema]=await Promise.all([deps.notion(`databases/${REGISTRATION_STUDENT_DATABASE}`),deps.notion(`databases/${REGISTRATION_ENROLLMENT_DATABASE}`)]);
        assertRegistrationSchema(studentSchema,enrollmentSchema);
        assertAdmissionNotionSchema(studentSchema);
        const assignments=await resolveRegistrationAssignments(db,actor,value,deps.notion);
        if(record.resolvedAssignments && JSON.stringify(record.resolvedAssignments)!==JSON.stringify(assignments))throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');
        for(const subject of Object.keys(assignments.teachers)) {
            const property=enrollmentSchema.properties?.[subject+' 담당'];
            if(property?.type!=='relation' || normalizeNotionPageId(property.relation?.database_id || '')!==REGISTRATION_TEACHER_DATABASE)throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
        }
        if(assignments.classIds.length) {
            const classSchema=await deps.notion(`databases/${REGISTRATION_CLASS_DATABASE}`);
            const relation=studentSchema.properties?.['소속반'];
            const reverse=classSchema.properties?.['대상 학생'];
            // Write only the student side of Notion's reciprocal relation. Never
            // replace a shared class roster with a stale read/merge/PATCH.
            if(!relation?.id || !reverse?.id || relation?.type!=='relation' || reverse?.type!=='relation' || relation.relation?.database_id!==REGISTRATION_CLASS_DATABASE || reverse.relation?.database_id!==REGISTRATION_STUDENT_DATABASE || relation.relation?.type!=='dual_property' || relation.relation?.dual_property?.synced_property_id!==reverse.id || reverse.relation?.dual_property?.synced_property_id!==relation.id)throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
        }
        await checkpoint({resolvedAssignments:assignments});
        async function page(kind:'student'|'enrollment',database:string,properties:any,studentId?:string) {
            const field=kind==='student'?'notionStudentPageId':'notionEnrollmentPageId',attempt=kind+'CreateAttempted';
            let remote:any;
            if(record[field])remote=await deps.notion(`pages/${record[field]}`);
            else {
                const found=await findRegistrationPages(deps.notion,database,key);remote=found[0];
                if(kind==='enrollment') {
                    const related=await deps.notion(`databases/${database}/query`,'POST',{filter:{property:'학생',relation:{contains:studentId}},page_size:2});
                    if(!Array.isArray(related.results) || related.has_more || related.results.length>1 || related.results.length===1 && (!remote || normalizeNotionPageId(related.results[0].id)!==normalizeNotionPageId(remote.id)))throw Error('NOTION_DUPLICATE_ENROLLMENT');
                }
                if(!remote) {
                    if(record[attempt])throw Error('NOTION_REGISTRATION_CREATE_UNCERTAIN');
                    await checkpoint({[attempt]:true});
                    try { remote=await deps.notion('pages','POST',{parent:{database_id:database},properties,...(kind==='student'?{children:admissionBlocks(value.admission)}:{})}); }
                    catch(error) { if(definiteCreationFailure(error))await checkpoint({[attempt]:false});throw error; }
                }
            }
            const pageId=assertRegistrationPage(remote,database,key,studentId);
            // A found page is the committed result of this immutable registration.
            // Preserve any later manual changes; never PATCH it during recovery.
            await checkpoint({[field]:pageId,[kind+'Saved']:true});return remote;
        }
        const student=await page('student',REGISTRATION_STUDENT_DATABASE,registrationStudentProperties(key,value,assignments.classIds));
        const studentId=normalizeNotionPageId(student.id);
        const enrollment=await page('enrollment',REGISTRATION_ENROLLMENT_DATABASE,registrationEnrollmentProperties(key,value,studentId,assignments.teachers),studentId);
        const enrollmentId=normalizeNotionPageId(enrollment.id);
        // Conflicting academic sources or existing ownership must fail rather than
        // silently relink a Firebase account or move a student to another academy.
        const memberRef=db.collection('academyStudentMemberships').doc(studentId);
        await db.runTransaction(async(tx:any)=>{
            const member=(await tx.get(memberRef)).data();if(member?.academyId && member.academyId!==actor.academyId)throw Error('ACADEMY_MEMBERSHIP_CONFLICT');
        });
        const mapping=await deps.mapStudent(db,studentId,registrationTextTitle(student));
        await deps.syncEnrollment(db,enrollment,async()=>({notionStudentPageId:studentId,studentDisplayName:mapping.studentDisplayName,studentKey:studentId,parentPhonePinHash:''}),async()=>mapping);
        await db.runTransaction(async(tx:any)=>{
            const [memberSnapshot,currentSnapshot]=await Promise.all([tx.get(memberRef),tx.get(ref)]);
            const member=memberSnapshot.data(),current=currentSnapshot.data();
            if(member?.academyId && member.academyId!==actor.academyId)throw Error('ACADEMY_MEMBERSHIP_CONFLICT');
            if(current?.syncLease!==lease || current.revision!==version)throw Error('REGISTRATION_SYNC_IN_PROGRESS');
            tx.set(memberRef,{...member,academyId:actor.academyId,disabled:false,internalStudentId:mapping.internalStudentId,updatedAt:Date.now()});
            tx.set(ref,{...current,syncStatus:'synced',syncError:null,syncLease:null,syncLeaseUntil:0,studentSaved:true,enrollmentSaved:true,notionStudentPageId:studentId,notionEnrollmentPageId:enrollmentId,updatedAt:Date.now()});
        });
        invalidateTeacherMutation('sync-student-registration');
        return {id:key,revision:version,syncStatus:'synced',alreadySynced:false};
    } catch(error) {
        // Keep creation intents even if the process dies before the error write.
        // Lease recovery will query the marker, never issue a second create.
        const uncertain=(record.studentCreateAttempted && !record.studentSaved)||(record.enrollmentCreateAttempted && !record.enrollmentSaved);
        await checkpoint({syncStatus:uncertain?'uncertain':'failed',syncError:failureCode(error),syncLease:null,syncLeaseUntil:0}).catch(()=>{});
        throw error;
    }
}
function registrationTextTitle(page:any) { return (page.properties?.['학생']?.title || []).map((part:any)=>part.plain_text ?? part.text?.content ?? '').join('') || '학생'; }
