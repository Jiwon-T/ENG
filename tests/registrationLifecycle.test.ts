import test from 'node:test';import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {saveStudentRegistration,listStudentRegistrations,convertRegistrationToResident} from '../api/_lib/teacherStudentRegistration.js';
import {syncStudentRegistration} from '../api/_lib/teacherStudentRegistrationSync.js';
import {REGISTRATION_STUDENT_DATABASE} from '../api/_lib/teacherStudentRegistrationNotion.js';
const actor={uid:'principal',admin:false,principal:true,academyId:'main'},requestId='11111111-1111-4111-8111-111111111111',student='22222222-2222-4222-8222-222222222222';
const input={name:'학생',enrollments:[{subject:'영어',status:'등록',startDate:'2026-10-05'}]};
test('resident transition removes intake listing while preserving identities and replay result',async()=>{
 const f=registrationFirestore(),saved=await saveStudentRegistration(f.db,actor,input,requestId);
 const record=f.rows.get('teacherStudentRegistrations/'+saved.id);Object.assign(record,{syncStatus:'synced',notionStudentPageId:student,notionEnrollmentPageId:requestId});f.rows.set('academyStudentMemberships/'+student,{academyId:'main',internalStudentId:'stable'});f.rows.set('reportSlugs/stable',{slug:'unchanged'});
 const before=structuredClone(record);await convertRegistrationToResident(f.db,actor,saved.id,1);assert.deepEqual(await listStudentRegistrations(f.db,actor),[]);assert.equal((await convertRegistrationToResident(f.db,actor,saved.id,1)).alreadyConverted,true);
 const after=f.rows.get('teacherStudentRegistrations/'+saved.id);assert.deepEqual(after.data,before.data);assert.equal(after.notionStudentPageId,student);assert.equal(after.notionEnrollmentPageId,requestId);assert.equal(f.rows.get('reportSlugs/stable').slug,'unchanged');
 await assert.rejects(saveStudentRegistration(f.db,actor,input,requestId,1),/REGISTRATION_ALREADY_RESIDENT/);
});
test('consultation cannot create Notion students or become resident before actual registration',async()=>{
 const f=registrationFirestore(),saved=await saveStudentRegistration(f.db,actor,{...input,intakeStage:'consultation'},requestId),previous=process.env.NOTION_STUDENT_DATABASE_ID;process.env.NOTION_STUDENT_DATABASE_ID=REGISTRATION_STUDENT_DATABASE;
 try{await assert.rejects(syncStudentRegistration(f.db,actor,saved.id,1,{notion:async()=>assert.fail('no Notion write'),mapStudent:async()=>assert.fail(),syncEnrollment:async()=>assert.fail()} as any),/REGISTRATION_ENROLLMENT_REQUIRED/);}finally{if(previous===undefined)delete process.env.NOTION_STUDENT_DATABASE_ID;else process.env.NOTION_STUDENT_DATABASE_ID=previous;}
 await assert.rejects(convertRegistrationToResident(f.db,actor,saved.id,1),/REGISTRATION_ENROLLMENT_REQUIRED/);assert.equal((await listStudentRegistrations(f.db,actor)).length,1);
});
test('additional consultation requires existing academy member and confirmed active subjects',async()=>{
 const f=registrationFirestore(),data={...input,purpose:'additional',existingStudentKey:student,intakeStage:'consultation'};
 await assert.rejects(saveStudentRegistration(f.db,actor,data,requestId),/FORBIDDEN/);f.rows.set('academyStudentMemberships/'+student,{academyId:'main'});const saved=await saveStudentRegistration(f.db,actor,data,requestId);
 await assert.rejects(convertRegistrationToResident(f.db,actor,saved.id,1,async()=>({pending:null,subjects:[{subject:'영어',status:'대기'}]})),/REGISTRATION_ENROLLMENT_REQUIRED/);
 await convertRegistrationToResident(f.db,actor,saved.id,1,async()=>({pending:null,subjects:[{subject:'영어',status:'등록'}]}));assert.equal((await listStudentRegistrations(f.db,actor)).length,0);assert.equal(f.rows.size,2);
});
test('cross academy, regular teacher, stale revisions and failed conversion never hide the intake',async()=>{
 const f=registrationFirestore(),saved=await saveStudentRegistration(f.db,actor,input,requestId);Object.assign(f.rows.get('teacherStudentRegistrations/'+saved.id),{syncStatus:'synced',notionStudentPageId:student});f.rows.set('academyStudentMemberships/'+student,{academyId:'main'});
 for(const candidate of [{...actor,academyId:'other'},{...actor,principal:false}])await assert.rejects(convertRegistrationToResident(f.db,candidate,saved.id,1),/FORBIDDEN/);
 await assert.rejects(convertRegistrationToResident(f.db,actor,saved.id,2),/REGISTRATION_CONFLICT/);f.failNextCommit();await assert.rejects(convertRegistrationToResident(f.db,actor,saved.id,1),/FIRESTORE_UNAVAILABLE/);assert.equal((await listStudentRegistrations(f.db,actor)).length,1);
});
