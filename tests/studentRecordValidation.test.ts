import test from 'node:test';
import assert from 'node:assert/strict';
import {assertContactEditAllowsIssuance} from '../api/_lib/studentContactEdit.js';
import {enrollmentEditSchema} from '../api/_lib/teacherStudentEnrollment.js';
import {studentRegistrationSchema} from '../api/_lib/teacherStudentRegistration.js';

/* Input and issuance rules kept from the Notion-era profile/enrollment/registration tests; the app paths use the same rules. */
const baseline='2026-10-05T01:00:00.000Z',classId='44444444-4444-4444-8444-444444444444';
test('new report issuance is blocked while contact sync is pending and rejects stale phone reads after completion',()=>{
 for(const status of ['syncing','failed','uncertain'])assert.throws(()=>assertContactEditAllowsIssuance({contactChanged:true,status},baseline),/STUDENT_PROFILE_CONTACT_PENDING/);
 const edit={contactChanged:true,status:'synced',remoteEditedAt:'2026-10-05T02:00:00.000Z'};
 assert.throws(()=>assertContactEditAllowsIssuance(edit,baseline));assert.throws(()=>assertContactEditAllowsIssuance(edit));
 assert.doesNotThrow(()=>assertContactEditAllowsIssuance(edit,'2026-10-05T03:00:00.000Z'));assert.doesNotThrow(()=>assertContactEditAllowsIssuance({...edit,status:'discarded'},baseline));
});
test('date, state and duplicate validation rejects invalid enrollment input',()=>{
 const input={subject:'영어',status:'등록',startDate:'2026-01-06',endDate:null,addTeacherUid:null,removeTeacherIds:[],classIds:[classId]};
 assert.equal(enrollmentEditSchema.safeParse(input).success,true);
 for(const patch of [{startDate:'2026-02-30'},{status:'중단'},{status:'대기',endDate:'2026-10-05'},{status:'중단',endDate:'2025-01-01',classIds:[]},{classIds:[classId,classId]}])
  assert.equal(enrollmentEditSchema.safeParse({...input,...patch}).success,false,JSON.stringify(patch));
});
test('class selections require active enrollment and teacher, reject duplicates and normalize IDs',()=>{
 const base=studentRegistrationSchema.parse({name:'학생',enrollments:[{subject:'영어',status:'등록',startDate:'2026-10-05',teacherUid:'teacher',classIds:[classId]}]});
 for(const row of [{...base.enrollments[0],status:'대기'},{...base.enrollments[0],teacherUid:null},{...base.enrollments[0],classIds:[classId,classId.toUpperCase()]}])assert.equal(studentRegistrationSchema.safeParse({...base,enrollments:[row]}).success,false);
 assert.deepEqual(studentRegistrationSchema.parse({...base,enrollments:[{...base.enrollments[0],classIds:[classId.toUpperCase()]}]}).enrollments[0].classIds,[classId]);
});
