import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {loadTeacherOnlineLearning,saveOnlineEvaluation} from '../api/_lib/teacherOnlineLearning.js';
import {handleWorkspace} from '../api/teacher/workspace.js';
import {hashStudentKey} from '../api/_lib/security.js';
const key='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
process.env.PARENT_SESSION_SECRET='cursor-test-only'.repeat(4);
function fixture(n=23){
 const reads:string[]=[],rows:any={users:{student:{role:'student',notionStudentKey:key}},studySessions:{},wordProgress:{a:{uid:'student',status:'learned'},b:{uid:'student',status:'learning'},x:{uid:'foreign',status:'learned'}},assignments:{a:{studentUid:'student',content:'앱 과제',isDone:true,createdAt:Timestamp.fromMillis(1000)},x:{studentUid:'foreign',content:'FOREIGN'}}};
 rows.notionStudentMappings={[hashStudentKey(key)]:{studentKey:key,notionStudentPageId:key,internalStudentId:'internal',firebaseUid:'student'}};
 for(let i=0;i<n;i++)rows.studySessions['s'+String(i).padStart(2,'0')]={uid:'student',createdAt:new Timestamp(100,1000000),wordbookTitle:'단어장 '+i,type:i%2?'flashcard':'quiz',duration:60,score:0,totalItems:10,category:'word',incorrectAnswers:[{word:'word',meaning:'뜻',userChoice:'오답',correctAnswer:'정답',isReviewed:false}]};
 rows.studySessions.foreign={uid:'foreign',createdAt:Timestamp.fromMillis(200000),wordbookTitle:'FOREIGN'};
 const value=(r:any,key:any,id:string)=>typeof key==='string'?r[key]:id;
 const cmp=(a:any,b:any)=>a?.toMillis&&b?.toMillis?a.seconds-b.seconds||a.nanoseconds-b.nanoseconds:a===b?0:a<b?-1:1;
 const query=(name:string,filters:any[]=[],orders:any[]=[],cursor?:any[],max=Infinity):any=>({
  doc:(id:string)=>({get:async()=>{reads.push(name);return {data:()=>rows[name]?.[id],exists:Boolean(rows[name]?.[id])};},set:async(v:any)=>{(rows[name]=rows[name]||{})[id]=v;}}),where:(...f:any[])=>query(name,[...filters,f],orders,cursor,max),orderBy:(k:any,dir:string)=>query(name,filters,[...orders,[k,dir]],cursor,max),startAfter:(...v:any[])=>query(name,filters,orders,v,max),limit:(v:number)=>query(name,filters,orders,cursor,v),
  get:async()=>{reads.push(name);let records=Object.entries(rows[name]||{}).filter(([,r]:any)=>filters.every(([k,op,v])=>op==='=='?r[k]===v:false));
   const compare=(a:any,b:any)=>{for(let i=0;i<orders.length;i++){const [k,dir]=orders[i],d=cmp(value(a[1],k,a[0]),value(b[1],k,b[0]));if(d)return dir==='desc'?-d:d;}return 0;};records.sort(compare);
   if(cursor)records=records.filter(([id,r])=>{for(let i=0;i<orders.length;i++){const [k,dir]=orders[i],d=cmp(value(r,k,id),cursor[i]);if(d)return dir==='desc'?d<0:d>0;}return false;});return {docs:records.slice(0,max).map(([id,r])=>({id,data:()=>r}))};},
  count:()=>({get:async()=>{const r=await query(name,filters).get();return {data:()=>({count:r.docs.length})};}}),
 });
 rows.users.teacher={role:'teacher'};rows.teacherWorkspaceAccess={teacher:{academyId:'main',workspaceRole:'teacher',scopes:[{studentKey:key,subject:'영어'}]}};rows.academyStudentMemberships={[key]:{academyId:'main'}};
 const hooks:{beforeTransaction?:()=>void}={};
 const db:any={collection:(name:string)=>query(name),runTransaction:async(fn:any)=>{hooks.beforeTransaction?.();return fn({get:(ref:any)=>ref.get(),set:(ref:any,v:any)=>ref.set(v)});}},actor={uid:'teacher',admin:false,academyId:'main',scopes:[{studentKey:key,subject:'영어'}],db};
 const deps:any={readStudentMapping:async()=>rows.notionStudentMappings[hashStudentKey(key)]};return {db,actor,deps,rows,reads,hooks};
}
test('linked student online records include zero scores, activity, mistakes and progress; never foreign records or private IDs',async()=>{
 const f=fixture();const r=await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps);assert.equal(r.online.sessions.length,20);assert.equal(r.online.sessions[0].score,0);assert.equal(r.online.progress?.recorded,2);assert.equal(r.online.progress?.learned,1);assert.equal(r.online.assignments[0].isDone,true);
 assert.ok(r.online.nextCursor);assert.ok(!JSON.stringify(r).includes('FOREIGN'));assert.ok(!JSON.stringify(r).includes('firebaseUid'));assert.ok(!f.reads.includes('lessonReports'));assert.equal(r.online.sessions[0].incorrectAnswers[0].correctAnswer,'정답');
});
test('cursor uses timestamp precision and stable doc tie ordering without overlap; foreign actor/filter cursors fail',async()=>{
 const f=fixture();const first=await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps),second=await loadTeacherOnlineLearning(f.db,f.actor,key,'',first.online.nextCursor,f.deps);assert.equal(second.online.sessions.length,3);assert.equal(new Set([...first.online.sessions,...second.online.sessions].map(r=>r.id)).size,23);
 await assert.rejects(loadTeacherOnlineLearning(f.db,{...f.actor,uid:'another-teacher'},key,'',first.online.nextCursor,f.deps));await assert.rejects(loadTeacherOnlineLearning(f.db,f.actor,key,'영어',first.online.nextCursor,f.deps));
});
test('unassigned or maths-only teacher cannot read English online histories',async()=>{
 const f=fixture();await assert.rejects(loadTeacherOnlineLearning(f.db,{...f.actor,scopes:[]},key,'',undefined,f.deps),/FORBIDDEN/);assert.equal(f.reads.length,0);
 const r=await loadTeacherOnlineLearning(f.db,{...f.actor,scopes:[{studentKey:key,subject:'수학'}]},key,'',undefined,f.deps);assert.equal(r.online.reason,'subject-not-available');assert.equal(f.reads.length,0);
});
test('missing, mismatched, disabled and mid-read unlinked accounts never fall back to another student',async()=>{
 const f=fixture();const r=await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,{readStudentMapping:async()=>null} as any);assert.equal(r.online.reason,'account-not-linked');assert.equal(f.reads.length,0);
 f.rows.users.student.notionStudentKey=other;assert.equal((await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps)).online.reason,'account-link-mismatch');assert.ok(!f.reads.includes('studySessions'));
 f.rows.users.student.notionStudentKey=key;f.rows.users.student.disabled=true;assert.equal((await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps)).online.reason,'account-not-linked');
 delete f.rows.users.student.disabled;let calls=0;const deps:any={readStudentMapping:async()=>++calls===1?f.deps.readStudentMapping():null};assert.equal((await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,deps)).online.reason,'account-link-mismatch');
});
test('actual teacher report endpoint exposes online only in student view and remains read-only',async()=>{
 const f=fixture(),before=JSON.stringify(f.rows);let body:any;const res:any={setHeader:()=>{},end:(v:string)=>body=JSON.parse(v)};
 await handleWorkspace({method:'POST',body:{action:'report-review',studentKey:key,audience:'student',section:'online',page:1}} as any,res,async()=>f.actor as any);assert.equal(res.statusCode,200);assert.equal(body.online.sessions.length,20);assert.equal(JSON.stringify(f.rows),before);
 await handleWorkspace({method:'POST',body:{action:'report-review',studentKey:key,audience:'parent',section:'online'}} as any,res,async()=>f.actor as any);assert.equal(res.statusCode,403);
});
test('학습 성취도 평가 comes with the first page and is saved where the student report reads it, with the same access',async()=>{
 const f=fixture();
 const first=await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps);assert.deepEqual(first.online.evaluation,{text:'',updatedAt:null});
 const saved=await saveOnlineEvaluation(f.db,f.actor,{studentKey:key,text:'  단어 복습을 꾸준히 해요. ',expectedUpdatedAt:null},f.deps);
 assert.equal(saved.evaluation.text,'단어 복습을 꾸준히 해요.');
 const row=f.rows.evaluations.student;assert.equal(row.evaluation,'단어 복습을 꾸준히 해요.');assert.equal(row.teacherUid,'teacher');assert.ok(row.updatedAt instanceof Timestamp,'same field types the student report reads');
 assert.equal((await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps)).online.evaluation.text,'단어 복습을 꾸준히 해요.');
 const next=await loadTeacherOnlineLearning(f.db,f.actor,key,'',first.online.nextCursor,f.deps);assert.equal(next.online.evaluation,undefined,'later pages do not read it again');
 for(const actor of [{...f.actor,scopes:[]},{...f.actor,scopes:[{studentKey:key,subject:'수학'}]}])await assert.rejects(saveOnlineEvaluation(f.db,actor,{studentKey:key,text:'x',expectedUpdatedAt:saved.evaluation.updatedAt},f.deps),/FORBIDDEN/);
 await assert.rejects(saveOnlineEvaluation(f.db,f.actor,{studentKey:key,text:'x',expectedUpdatedAt:saved.evaluation.updatedAt},{readStudentMapping:async()=>null} as any),/STUDENT_ACCOUNT_NOT_LINKED/);
 await assert.rejects(saveOnlineEvaluation(f.db,f.actor,{studentKey:key,text:'가'.repeat(1001),expectedUpdatedAt:saved.evaluation.updatedAt},f.deps));
 assert.equal(f.rows.evaluations.student.evaluation,'단어 복습을 꾸준히 해요.','refused requests change nothing');
 await saveOnlineEvaluation(f.db,{...f.actor,admin:true,scopes:[]},{studentKey:key,text:'',expectedUpdatedAt:saved.evaluation.updatedAt},f.deps);assert.equal(f.rows.evaluations.student.evaluation,'','an empty note clears it (the student sees the waiting message)');
});
test('평가 저장 re-checks the link, the account and live access inside the transaction, and refuses a stale screen',async()=>{
 const save=(f:any,extra:any={},actor:any=f.actor)=>saveOnlineEvaluation(f.db,actor,{studentKey:key,text:'평가',expectedUpdatedAt:null,...extra},f.deps);
 // The link changes right after the first check: the mapping points elsewhere, the account points at another student, it is disabled or unlinked.
 for(const change of [(f:any)=>{f.rows.notionStudentMappings[hashStudentKey(key)]={...f.rows.notionStudentMappings[hashStudentKey(key)],firebaseUid:'someone-else'};},(f:any)=>{f.rows.users.student.notionStudentKey=other;},(f:any)=>{f.rows.users.student.disabled=true;},(f:any)=>{delete f.rows.notionStudentMappings[hashStudentKey(key)];}]){
  const f=fixture(1);f.hooks.beforeTransaction=()=>change(f);
  await assert.rejects(save(f),/STUDENT_ACCOUNT_NOT_LINKED/);assert.equal(f.rows.evaluations,undefined,'nothing written to the old account');
 }
 // Access revoked after sign-in (the request still carries the old scopes).
 for(const change of [(f:any)=>{f.rows.teacherWorkspaceAccess.teacher.scopes=[];},(f:any)=>{f.rows.teacherWorkspaceAccess.teacher.disabled=true;},(f:any)=>{f.rows.academyStudentMemberships[key].disabled=true;}]){
  const f=fixture(1);f.hooks.beforeTransaction=()=>change(f);
  await assert.rejects(save(f),/FORBIDDEN/);assert.equal(f.rows.evaluations,undefined);
 }
 // Two teachers: saving from an older screen is refused instead of overwriting.
 const f=fixture(1);const first=await save(f,{expectedUpdatedAt:null});
 await assert.rejects(save(f,{text:'늦은 저장',expectedUpdatedAt:null}),/EVALUATION_CONFLICT/);assert.equal(f.rows.evaluations.student.evaluation,'평가');
 const second=await save(f,{text:'최신 평가',expectedUpdatedAt:first.evaluation.updatedAt});assert.equal(second.evaluation.text,'최신 평가');
});
test('평가 저장 needs the version it was edited from, and the current role and workspace profile',async()=>{
 // No version: refused as invalid input, nothing written (a request cannot skip the overwrite check).
 const f=fixture(1);await saveOnlineEvaluation(f.db,f.actor,{studentKey:key,text:'최신',expectedUpdatedAt:null},f.deps);
 await assert.rejects(saveOnlineEvaluation(f.db,f.actor,{studentKey:key,text:'늦은 저장'} as any,f.deps));assert.equal(f.rows.evaluations.student.evaluation,'최신');
 // Role or workspace taken away after sign-in (the request still carries the old teacher/principal snapshot).
 const revoked=[(g:any)=>{g.rows.users.teacher.role='student';},(g:any)=>{delete g.rows.teacherWorkspaceAccess.teacher;},(g:any)=>{g.rows.teacherWorkspaceAccess.teacher.academyId='other';}];
 for(const change of revoked){const g=fixture(1);g.hooks.beforeTransaction=()=>change(g);await assert.rejects(saveOnlineEvaluation(g.db,g.actor,{studentKey:key,text:'x',expectedUpdatedAt:null},g.deps),/FORBIDDEN/);assert.equal(g.rows.evaluations,undefined);}
 const principal=(g:any)=>{g.rows.users.teacher.role='principal';g.rows.teacherWorkspaceAccess.teacher={academyId:'main',workspaceRole:'principal',scopes:[]};return {...g.actor,principal:true,scopes:[{studentKey:key,subject:'영어'}]};};
 const ok=fixture(1);await saveOnlineEvaluation(ok.db,principal(ok),{studentKey:key,text:'원장 평가',expectedUpdatedAt:null},ok.deps);assert.equal(ok.rows.evaluations.student.evaluation,'원장 평가');
 for(const change of [(g:any)=>{g.rows.teacherWorkspaceAccess.teacher.disabled=true;},(g:any)=>{g.rows.teacherWorkspaceAccess.teacher.workspaceRole='teacher';},(g:any)=>{g.rows.users.teacher.role='student';}]){
  const g=fixture(1),actor=principal(g);g.hooks.beforeTransaction=()=>change(g);
  await assert.rejects(saveOnlineEvaluation(g.db,actor,{studentKey:key,text:'x',expectedUpdatedAt:null},g.deps),/FORBIDDEN/);assert.equal(g.rows.evaluations,undefined);
 }
});
