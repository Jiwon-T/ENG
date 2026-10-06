import test from 'node:test';import assert from 'node:assert/strict';
import {readRecordConflict,resolveRecordConflict} from '../api/_lib/teacherRecordConflict.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
const id='11111111-1111-4111-8111-111111111111',key='22222222-2222-4222-8222-222222222222',pageId='33333333-3333-4333-8333-333333333333',database='44444444-4444-4444-8444-444444444444';
function fixture(kind:'academic'|'schedule'){
 const f=registrationFirestore(),rich=(s:string)=>({rich_text:[{plain_text:s}]}),select=(name:string)=>({select:{name}});
 const data:any=kind==='academic'?{studentKey:key,subject:'영어',examType:'학교 내신',examDetail:'',title:'앱',examDate:'2026-10-05',deadline:null,score:80,maxScore:100,grade:'',submissionStatus:'제출 완료',note:''}:{title:'앱',subject:'영어',students:[key],date:'2026-10-05',start:'14:00',end:'15:00',kind:'보강',status:'예정',place:'학원',note:''};
 const properties:any={'과목':select('영어'),'앱 기록 ID':rich(id),[kind==='academic'?'학생':'대상 학생']:{relation:[{id:key}]}};
 Object.assign(properties,kind==='academic'?{'시험명':{title:[{plain_text:'노션'}]},'시험 종류':select('학교 내신'),'시험일':{date:{start:'2026-10-05'}},'원점수':{number:90},'만점':{number:100},'제출 상태':select('제출 완료')}:{'일정명':{title:[{plain_text:'노션'}]},'날짜 및 시간':{date:{start:'2026-10-05T14:00:00+09:00',end:'2026-10-05T15:00:00+09:00'}},'일정 종류':select('보강'),'일정 상태':select('예정'),'장소':select('학원')});
 const path=(kind==='academic'?'teacherAcademicDrafts':'teacherSchedules')+'/'+id;
 f.rows.set(path,{ownerUid:'t',academyId:'a',revision:1,data,stage:'failed',failureCode:'NOTION_EDIT_CONFLICT',notionPageId:pageId,notionWrite:{database,pageId,properties:structuredClone(properties)}});
 f.rows.set('academyStudentMemberships/'+key,{academyId:'a'});
 const page:any={id:pageId,parent:{database_id:database},last_edited_time:'new',properties};let writes=0;
 const notion:any=async(_:string,method='GET')=>{if(method!=='GET')writes++;return structuredClone(page);};
 const actor:any={uid:'t',academyId:'a',scopes:[{studentKey:key,subject:'영어'}],teachingScopes:[{studentKey:key,subject:'영어'}]};
 return {...f,path,page,notion,actor,writes:()=>writes};
}
for(const kind of ['academic','schedule'] as const){
 test(kind+' conflict choices preserve source identity and validate Notion data',async()=>{for(const choice of ['app','notion'] as const){const f=fixture(kind),r=await readRecordConflict(f.db,f.actor,kind,id,f.notion);assert.equal(r.canUseNotion,true);await resolveRecordConflict(f.db,f.actor,kind,{id,revision:1,token:r.token,choice},f.notion);const saved=f.rows.get(f.path);assert.equal(saved.notionPageId,pageId);assert.equal(saved.data.title,choice==='app'?'앱':'노션');assert.equal(saved.revision,2);assert.equal(saved.notionWrite,null);assert.equal(f.writes(),0);}});
 test(kind+' stale snapshot, wrong owner, membership and participant changes block recovery',async()=>{const f=fixture(kind),r=await readRecordConflict(f.db,f.actor,kind,id,f.notion);await assert.rejects(readRecordConflict(f.db,{...f.actor,uid:'other'},kind,id,f.notion),/FORBIDDEN/);f.page.last_edited_time='newer';await assert.rejects(resolveRecordConflict(f.db,f.actor,kind,{id,revision:1,token:r.token,choice:'app'},f.notion),/NOTION_EDIT_CONFLICT/);f.page.last_edited_time='new';f.rows.get('academyStudentMemberships/'+key).disabled=true;await assert.rejects(resolveRecordConflict(f.db,f.actor,kind,{id,revision:1,token:r.token,choice:'app'},f.notion),/FORBIDDEN/);f.page.properties[kind==='academic'?'학생':'대상 학생'].relation=[{id:pageId}];await assert.rejects(readRecordConflict(f.db,f.actor,kind,id,f.notion),/NOTION_SOURCE_MISMATCH/);assert.equal(f.rows.get(f.path).revision,1);});
}

