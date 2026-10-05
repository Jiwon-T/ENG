import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {registrationAssignmentOptions,resolveRegistrationAssignments,REGISTRATION_CLASS_DATABASE as classDB,REGISTRATION_TEACHER_DATABASE as teacherDB} from '../api/_lib/teacherRegistrationAssignments.js';
import {studentRegistrationSchema} from '../api/_lib/teacherStudentRegistration.js';
const actor={uid:'principal',admin:false,principal:true,academyId:'main'};
const teacherId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',classId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rich=(value:string)=>({rich_text:[{plain_text:value}]});
function fixture() {
 const memory=registrationFirestore();
 memory.rows.set('teacherWorkspaceAccess/teacher',{academyId:'main',notionTeacherPageId:teacherId});
 memory.rows.set('users/teacher',{role:'teacher'});
 const teacher:any={id:teacherId,parent:{database_id:teacherDB},properties:{선생님:{title:[{plain_text:'담당 선생님'}]},상태:{select:{name:'재직'}},'담당 과목':{multi_select:[{name:'영어'}]},'선생님 연락처':{phone_number:'00000000000'}}};
 const classroom:any={id:classId,parent:{database_id:classDB},properties:{학원:rich('main'),상태:{status:{name:'진행 중'}},과목:{select:{name:'영어'}},'담당 선생님':{relation:[{id:teacherId}]},수업명:{title:[{plain_text:'영어반'}]}}};
 const requests:any[]=[];
 const notion=async(path:string,method='GET',body?:any)=>{
  requests.push({path,method,body});
  if(path===`pages/${teacherId}`)return structuredClone(teacher);
  if(path===`pages/${classId}`)return structuredClone(classroom);
  if(path.endsWith('/query'))return {results:[structuredClone(classroom)],has_more:false};
  throw Error('Unexpected call');
 };
 const value=()=>studentRegistrationSchema.parse({name:'학생',enrollments:[{subject:'영어',status:'등록',startDate:'2026-10-05',teacherUid:'teacher',classIds:[classId]}]});
 return {...memory,teacher,classroom,notion,requests,value};
}
test('registration choices expose only active same-academy teachers and matching running classes without contacts',async()=>{
 const f=fixture(),options=await registrationAssignmentOptions(f.db,actor,f.notion);
 assert.deepEqual(options,{teachers:[{uid:'teacher',name:'담당 선생님',subjects:['영어']}],classes:[{id:classId,name:'영어반',subject:'영어',teacherUids:['teacher']}]});
 assert.equal(JSON.stringify(options).includes('00000000000'),false);assert.equal(JSON.stringify(options).includes(teacherId),false);
 f.classroom.properties.학원=rich('other');assert.equal((await registrationAssignmentOptions(f.db,actor,f.notion)).classes.length,0);
 f.teacher.properties.상태.select.name='휴직';assert.equal((await registrationAssignmentOptions(f.db,actor,f.notion)).teachers.length,0);
});
test('assignment validation rechecks teacher identity, academy, active role, subject and class before creating any pages',async()=>{
 const f=fixture();assert.deepEqual(await resolveRegistrationAssignments(f.db,actor,f.value(),f.notion),{teachers:{영어:teacherId},classIds:[classId]});
 for(const change of [()=>{f.classroom.properties.상태.status.name='중단';},()=>{f.classroom.properties.과목.select.name='수학';},()=>{f.classroom.properties.학원=rich('other');},()=>{f.classroom.properties['담당 선생님'].relation=[];}]) {
  const g=fixture();const previous=structuredClone(f.classroom);change();
  await assert.rejects(resolveRegistrationAssignments(g.db,actor,g.value(),async(path,...args)=>path===`pages/${classId}`?structuredClone(f.classroom):g.notion(path,...args)),/NOTION_REGISTRATION_ASSIGNMENT_REQUIRED/);
  Object.assign(f.classroom,previous);
 }
 f.rows.set('users/teacher',{role:'student'});await assert.rejects(resolveRegistrationAssignments(f.db,actor,f.value(),f.notion),/NOTION_REGISTRATION_ASSIGNMENT_REQUIRED/);
 f.rows.set('users/teacher',{role:'teacher'});f.rows.set('teacherWorkspaceAccess/teacher',{academyId:'other',notionTeacherPageId:teacherId});
 await assert.rejects(resolveRegistrationAssignments(f.db,actor,f.value(),f.notion),/NOTION_REGISTRATION_ASSIGNMENT_REQUIRED/);
 assert.ok(f.requests.every(r=>r.method==='GET'));
});
test('registration choices and assignments reject ordinary teachers, foreign academies and duplicate teacher identity',async()=>{
 const f=fixture();
 await assert.rejects(registrationAssignmentOptions(f.db,{...actor,principal:false},f.notion),/FORBIDDEN/);
 await assert.rejects(resolveRegistrationAssignments(f.db,{...actor,academyId:'other'},f.value(),f.notion),/NOTION_REGISTRATION_SOURCE_REQUIRED/);
 f.rows.set('teacherWorkspaceAccess/duplicate',{academyId:'main',notionTeacherPageId:teacherId});f.rows.set('users/duplicate',{role:'teacher'});
 await assert.rejects(registrationAssignmentOptions(f.db,actor,f.notion),/NOTION_TEACHER_ID_CONFLICT/);
});
test('class selections require active enrollment and teacher, reject duplicates and normalize IDs',()=>{
 const f=fixture();const base=f.value();
 for(const row of [{...base.enrollments[0],status:'대기'},{...base.enrollments[0],teacherUid:null},{...base.enrollments[0],classIds:[classId,classId.toUpperCase()]}])assert.equal(studentRegistrationSchema.safeParse({...base,enrollments:[row]}).success,false);
 assert.deepEqual(studentRegistrationSchema.parse({...base,enrollments:[{...base.enrollments[0],classIds:[classId.toUpperCase()]}]}).enrollments[0].classIds,[classId]);
});

test('existing main administrator without page ID exposes 지원T and resolves the same teacher for registration',async()=>{
 const f=fixture(),old=process.env.ADMIN_UID;process.env.ADMIN_UID='admin';f.rows.set('teacherWorkspaceAccess/admin',{academyId:'main',workspaceRole:'principal'});
 const notion=async(path:string,method?:string,body?:any)=>path==='pages/3ec0d0f1-c79a-8108-b714-c1d6fc390ba2'?{...structuredClone(f.teacher),id:'3ec0d0f1-c79a-8108-b714-c1d6fc390ba2',properties:{...f.teacher.properties,선생님:{title:[{plain_text:'영어 이지원T'}]}}}:f.notion(path,method,body);
 try{const options=await registrationAssignmentOptions(f.db,actor,notion);assert.ok(options.teachers.some(t=>t.uid==='admin'&&t.name==='영어 이지원T'));assert.deepEqual(await resolveRegistrationAssignments(f.db,actor,studentRegistrationSchema.parse({name:'학생',enrollments:[{subject:'영어',status:'등록',startDate:'2026-10-05',teacherUid:'admin'}]}),notion),{teachers:{영어:'3ec0d0f1-c79a-8108-b714-c1d6fc390ba2'},classIds:[]});assert.equal(f.rows.get('teacherWorkspaceAccess/admin').notionTeacherPageId,undefined);}
 finally{if(old===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=old;}
});
test('administrator fallback never enables a disabled or foreign-academy profile',async()=>{
 const f=fixture(),old=process.env.ADMIN_UID;process.env.ADMIN_UID='admin';
 try{for(const profile of [{academyId:'main',disabled:true},{academyId:'other'},{disabled:true}]){f.rows.set('teacherWorkspaceAccess/admin',profile);const options=await registrationAssignmentOptions(f.db,actor,f.notion);assert.equal(options.teachers.some(t=>t.uid==='admin'),false);}}
 finally{if(old===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=old;}
});
