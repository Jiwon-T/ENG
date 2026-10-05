import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLessonComplete,canAccessOwned,canTeach,lessonDraftSchema} from '../api/_lib/teacherWorkspacePolicy.ts';
import {academicDraftSchema,canViewAcademyRecord} from '../api/_lib/teacherAcademicPolicy.ts';
import {canReadNotionGrade} from '../api/_lib/teacherAcademicNotion.ts';
import {workspaceError} from '../api/_lib/teacherWorkspaceError.ts';
import {teacherActor} from '../api/_lib/teacherWorkspaceAuth.ts';
const studentKey='11111111-1111-4111-8111-111111111111';
const lesson={studentKey,subject:'영어',date:'2026-10-03',classSession:'있음',start:'15:30',end:'17:40',attendance:'출석',attitude:'상',homework:'상',test:'미확인',content:'관계대명사',assignment:'10쪽',note:'',nextPlan:'',correct:27,total:30,round:1.7,selfStudy:'없음',selfStudyStart:'',selfStudyEnd:'',selfStudyRound:null};
test('academy class rounds accept 1.7 and require rounds only for an actual class',()=>{
 assert.equal(assertLessonComplete(lesson).round,1.7);
 assert.equal(lessonDraftSchema.safeParse({...lesson,round:null}).success,true); // partial drafts allowed
 assert.throws(()=>assertLessonComplete({...lesson,round:null}),/LESSON_ROUNDS_REQUIRED/);
 assert.throws(()=>assertLessonComplete({...lesson,round:0}),/LESSON_ROUNDS_REQUIRED/);
 assert.equal(assertLessonComplete({...lesson,attendance:'결석',round:0}).round,0);
});
test('self-study-only days omit class time and round but require self-study times and rounds',()=>{
 const study={...lesson,classSession:'없음',start:'',end:'',round:null,selfStudy:'있음',selfStudyStart:'19:00',selfStudyEnd:'19:47',selfStudyRound:1};
 assert.equal(assertLessonComplete(study).round,null);
 for(const change of [{selfStudyRound:null},{selfStudyRound:0},{selfStudyStart:'25:00'},{selfStudyEnd:'18:00'}]) assert.throws(()=>assertLessonComplete({...study,...change}),/SELF_STUDY_REQUIRED/);
 assert.throws(()=>assertLessonComplete({...study,selfStudy:'없음'}),/LESSON_OR_STUDY_REQUIRED/);
 assert.throws(()=>assertLessonComplete({...lesson,selfStudy:'미확인'}),/SELF_STUDY_REQUIRED/);
 assert.equal(assertLessonComplete({...lesson,selfStudy:'있음',selfStudyStart:'18:00',selfStudyEnd:'19:00',selfStudyRound:0.5}).selfStudyRound,0.5);
});
const grade={studentKey,subject:'영어',examType:'학교 내신',title:'2학기 중간',examDate:'2026-10-03',deadline:null,score:0,maxScore:100,grade:'B',submissionStatus:'제출 완료',note:''};
test('grade input preserves real zero, distinguishes unsubmitted, and validates date/score ranges',()=>{
 assert.equal(academicDraftSchema.parse(grade).score,0);
 assert.equal(academicDraftSchema.parse({...grade,submissionStatus:'미제출',score:null}).score,null);
 for(const change of [{score:101},{maxScore:0},{examDate:'2026-02-30'},{deadline:'2026-02-30'},{score:null},{submissionStatus:'미제출'}]) assert.equal(academicDraftSchema.safeParse({...grade,...change}).success,false);
 assert.equal(academicDraftSchema.safeParse({...grade,examType:'학력평가'}).success,true);
});
test('principals oversee their academy but cannot read private curricula or edit another teacher record',()=>{
 const principal={uid:'p',admin:false,principal:true,academyId:'one',scopes:[{studentKey,subject:'영어'}],teachingScopes:[]};
 assert.equal(canViewAcademyRecord(principal,{ownerUid:'t',academyId:'one'}),true);
 assert.equal(canViewAcademyRecord(principal,{ownerUid:'t',academyId:'two'}),false);
 assert.equal(canViewAcademyRecord({...principal,academyId:null},{ownerUid:'t',academyId:'one'}),false);
 assert.equal(canAccessOwned(principal,'t'),false);assert.equal(canTeach(principal,studentKey,'영어'),false);
 assert.equal(canViewAcademyRecord({...principal,admin:true},{ownerUid:'t',academyId:'two'}),true);
 assert.equal(canViewAcademyRecord({uid:'t',admin:false},{ownerUid:'t',academyId:'one'}),true);
 assert.equal(canViewAcademyRecord({uid:'u',admin:false},{ownerUid:'t',academyId:'one'}),false);
});
test('Notion grade visibility requires real teacher relation or a principal academy student',()=>{
 const teacherId='22222222-2222-4222-8222-222222222222';
 const page={parent:{database_id:'fa6ce5a8-9572-4f4d-80d9-4d1485d44e6f'},properties:{학생:{relation:[{id:studentKey}]},과목:{select:{name:'영어'}},'담당 선생님':{relation:[{id:teacherId}]}}};
 assert.equal(canReadNotionGrade({admin:false,uid:'t'},{notionTeacherPageId:teacherId},page),true);
 assert.equal(canReadNotionGrade({admin:false,uid:'u'},{notionTeacherPageId:studentKey},page),false);
 assert.equal(canReadNotionGrade({admin:false,principal:true,scopes:[{studentKey}]},{},page),true);
 assert.equal(canReadNotionGrade({admin:false,principal:true,scopes:[]},{},page),false);
 assert.equal(canReadNotionGrade({admin:true},{},{...page,archived:true}),false);
});
test('workspace errors distinguish expired authentication, server setup, and invalid records without leaking raw detail',()=>{
 const setup=workspaceError(new Error('CONFIG_ERROR: secret'), 'authentication');
 assert.equal(setup.status,500);assert.equal(setup.body.error,'SERVER_CONFIG_ERROR');assert.ok(!JSON.stringify(setup).includes('secret'));
 assert.equal(workspaceError(new Error('UNAUTHORIZED'),'authentication').status,401);
 assert.equal(workspaceError(new Error('NOTION_403'),'workspace-data').status,502);
 assert.equal(workspaceError(new Error('SELF_STUDY_REQUIRED'),'publish').status,400);
});
test('principal scope is server-approved academy membership, not user-editable role or submitted scopes',async()=>{
 const previous=process.env.ADMIN_UID;process.env.ADMIN_UID='admin';
 const request={headers:{authorization:'Bearer valid'}} as any;
 const make=(profile:any)=>()=>({auth:{verifyIdToken:async()=>({uid:'p'})},db:{collection:(name:string)=>({doc:()=>({get:async()=>({data:()=>name==='users'?{role:'principal'}:profile})}),where:()=>({get:async()=>({docs:[{id:studentKey,data:()=>({disabled:false})},{id:'disabled',data:()=>({disabled:true})}]})})})}}) as any;
 try {
  await assert.rejects(teacherActor(request,make({scopes:[]})),/TEACHER_NOT_CONFIGURED/);
  const actor=await teacherActor(request,make({workspaceRole:'principal',academyId:'one',scopes:[]}));
  assert.equal(actor.principal,true);assert.equal(actor.scopes.length,5);assert.ok(actor.scopes.every(s=>s.studentKey===studentKey));assert.equal(canTeach(actor,studentKey,'영어'),false);
 }finally{if(previous===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=previous;}
});

test('lesson content is required for publication, including absence and self-study-only reports',()=>{
 for(const content of ['', ' \n\t ']) {
  assert.equal(lessonDraftSchema.safeParse({...lesson,content}).success,true);
  assert.throws(()=>assertLessonComplete({...lesson,content}),/LESSON_CONTENT_REQUIRED/);
  assert.throws(()=>assertLessonComplete({...lesson,content,attendance:'결석',round:0}),/LESSON_CONTENT_REQUIRED/);
 }
 assert.equal(workspaceError(Error('LESSON_CONTENT_REQUIRED'),'publish').body.message,'수업 내용을 입력해 주세요.');
});
