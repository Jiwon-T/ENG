import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {loadLessonDayStudy,loadTeacherOnlineLearning,saveOnlineEvaluation} from '../api/_lib/teacherOnlineLearning.js';
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
  doc:(id:string)=>({get:async()=>{reads.push(name);hooks.onRead?.(name);return {data:()=>rows[name]?.[id],exists:Boolean(rows[name]?.[id])};},set:async(v:any)=>{(rows[name]=rows[name]||{})[id]=v;},collection:(sub:string)=>query(name+'/'+id+'/'+sub)}),where:(...f:any[])=>query(name,[...filters,f],orders,cursor,max),orderBy:(k:any,dir:string)=>query(name,filters,[...orders,[k,dir]],cursor,max),startAfter:(...v:any[])=>query(name,filters,orders,v,max),limit:(v:number)=>query(name,filters,orders,cursor,v),select:()=>query(name,filters,orders,cursor,max),
  get:async()=>{reads.push(name);hooks.onRead?.(name,orders);let records=Object.entries(rows[name]||{}).filter(([,r]:any)=>filters.every(([k,op,v])=>op==='=='?r[k]===v:op==='>='?cmp(r[k],v)>=0:op==='<'?cmp(r[k],v)<0:false));
   const compare=(a:any,b:any)=>{for(let i=0;i<orders.length;i++){const [k,dir]=orders[i],d=cmp(value(a[1],k,a[0]),value(b[1],k,b[0]));if(d)return dir==='desc'?-d:d;}return 0;};records.sort(compare);
   if(cursor)records=records.filter(([id,r])=>{for(let i=0;i<orders.length;i++){const [k,dir]=orders[i],d=cmp(value(r,k,id),cursor[i]);if(d)return dir==='desc'?d<0:d>0;}return false;});return {docs:records.slice(0,max).map(([id,r])=>({id,data:()=>r}))};},
  count:()=>({get:async()=>{const r=await query(name,filters).get();return {data:()=>({count:r.docs.length})};}}),
 });
 rows.users.teacher={role:'teacher'};rows.teacherWorkspaceAccess={teacher:{academyId:'main',workspaceRole:'teacher',scopes:[{studentKey:key,subject:'영어'}]}};rows.academyStudentMemberships={[key]:{academyId:'main'}};
 const hooks:{beforeTransaction?:()=>void;onRead?:(name:string,orders?:any[])=>void}={};
 const db:any={collection:(name:string)=>query(name),runTransaction:async(fn:any)=>{hooks.beforeTransaction?.();return fn({get:(ref:any)=>ref.get(),set:(ref:any,v:any)=>ref.set(v)});}},actor={uid:'teacher',admin:false,academyId:'main',scopes:[{studentKey:key,subject:'영어'}],db};
 const deps:any={readStudentMapping:async()=>rows.notionStudentMappings[hashStudentKey(key)]};return {db,actor,deps,rows,reads,hooks};
}
test('linked student online records include zero scores, activity, mistakes and progress; never foreign records or private IDs',async()=>{
 const f=fixture();const r=await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps);assert.equal(r.online.sessions.length,20);assert.equal(r.online.sessions[0].score,0);assert.equal(r.online.progress?.recorded,2);assert.equal(r.online.progress?.learned,1);assert.equal(r.online.assignments[0].isDone,true);
 assert.ok(r.online.nextCursor);assert.ok(!JSON.stringify(r).includes('FOREIGN'));assert.ok(!JSON.stringify(r).includes('firebaseUid'));assert.equal(r.online.sessions[0].incorrectAnswers[0].correctAnswer,'정답');
});
test('과제 is one list: lesson-log 과제 (English only, completion by current wording) and old 과제 메모, newest first; first page only',async()=>{
 const f=fixture();
 const lesson=(id:string,subject:string,day:string,task:string)=>({internalStudentId:'internal',reportIdentity:id,notionPageId:id,subject,lessonDateStart:day+'T14:00:00+09:00',derivedAssignment:task});
 f.rows.lessonReports={r1:lesson('r1','영어','2026-10-08','교재 3과 풀기'),r2:lesson('r2','영어','2026-10-01','단어 시험 준비'),m:lesson('m','수학','2026-10-09','MATH TASK'),e:lesson('e','영어','2026-10-05',''),x:{...lesson('x','영어','2026-10-09','OTHER STUDENT'),internalStudentId:'foreign'}};
 const {lessonReportId,assignmentContentHash}=await import('../api/_lib/reportAudienceDTO.js');
 const completions:any=f.rows['users/student/assignmentCompletions']={};
 const done=(r:any,hash:string)=>{completions[lessonReportId(r)]={contentHash:hash};};
 done(f.rows.lessonReports.r1,assignmentContentHash(f.rows.lessonReports.r1));done(f.rows.lessonReports.r2,'old-wording');
 const r=await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps),list=r.online.assignments as any[];
 assert.deepEqual(list.map(a=>a.content),['교재 3과 풀기','단어 시험 준비','앱 과제']);
 assert.deepEqual(list.map(a=>a.isDone),[true,false,true],'a completion for older wording does not count');
 assert.ok(!JSON.stringify(r).includes('MATH TASK')&&!JSON.stringify(r).includes('OTHER STUDENT'));
 const next=await loadTeacherOnlineLearning(f.db,f.actor,key,'',r.online.nextCursor,f.deps);assert.equal(next.online.assignments,undefined);
});
test('과제 reads lessons newest first in pages and never walks a long history',async()=>{
 const lessons=(n:number,task:(i:number)=>string)=>Object.fromEntries(Array.from({length:n},(_,i)=>['l'+String(i).padStart(3,'0'),{internalStudentId:'internal',reportIdentity:'l'+i,subject:'영어',lessonDateStart:new Date(Date.UTC(2026,0,1)+(1000-i)*86400000).toISOString(),derivedAssignment:task(i)}]));
 const pages=(f:any)=>f.reads.filter((r:string)=>r==='lessonReports').length;
 let f=fixture();f.rows.lessonReports=lessons(120,i=>'과제 '+i);
 let r=await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps);
 assert.equal(pages(f),1,'10 found in the first page of 20');assert.deepEqual((r.online.assignments as any[]).slice(0,2).map(a=>a.content),['과제 0','과제 1']);
 f=fixture();f.rows.lessonReports=lessons(150,i=>i===2||i===110?'과제 '+i:'');
 r=await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps);
 assert.equal(pages(f),5,'stops after 100 lessons');assert.deepEqual((r.online.assignments as any[]).map(a=>a.content),['과제 2','앱 과제'],'a 과제 older than the newest 100 lessons is not read');
});
test('without the lesson date index, 과제 falls back to one field-limited read of this student',async()=>{
 const f=fixture();f.rows.lessonReports={a:{internalStudentId:'internal',reportIdentity:'a',subject:'영어',lessonDateStart:'2026-10-08T14:00:00+09:00',derivedAssignment:'교재 풀기'}};
 f.hooks.onRead=(name,orders)=>{if(name==='lessonReports'&&orders?.length)throw Object.assign(Error('The query requires an index.'),{code:9});};
 const r=await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps);assert.equal((r.online.assignments as any[])[0].content,'교재 풀기');
});
test('a link removed while 과제 completions are read returns no records of the old account',async()=>{
 const f=fixture();f.rows.lessonReports={a:{internalStudentId:'internal',reportIdentity:'a',subject:'영어',lessonDateStart:'2026-10-08T14:00:00+09:00',derivedAssignment:'교재 풀기'}};
 f.hooks.onRead=name=>{if(name==='users/student/assignmentCompletions')f.rows.notionStudentMappings[hashStudentKey(key)]={...f.rows.notionStudentMappings[hashStudentKey(key)],firebaseUid:null};};
 const r=await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps);
 assert.equal(r.online.reason,'account-link-mismatch');assert.deepEqual(r.online.sessions,[]);assert.deepEqual(r.online.assignments,[]);assert.ok(!JSON.stringify(r).includes('교재 풀기'));
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

test('수업 일지 › 이날 앱 학습: only that Seoul day of the linked student, summary fields, newest first; any teacher of the student', async () => {
 const f=fixture(0),at=(iso:string)=>Timestamp.fromMillis(Date.parse(iso));
 f.rows.studySessions={
  morning:{uid:'student',createdAt:at('2026-10-18T09:10:00+09:00'),wordbookTitle:'능률VOCA 어원편 중등',type:'quiz',category:'word',score:18,totalItems:20,duration:300,dayStart:3,dayEnd:3,incorrectAnswers:[{word:'predict'},{word:'prefer'}]},
  test:{uid:'student',createdAt:at('2026-10-18T13:52:00+09:00'),wordbookTitle:'능률VOCA 어원편 중등',type:'test',category:'word',score:27,totalItems:30,duration:540,dayStart:3,dayEnd:4,incorrectAnswers:['a','b','c','d','e','f'].map(word=>({word,meaning:'뜻'}))},
  lateNight:{uid:'student',createdAt:at('2026-10-18T23:59:00+09:00'),wordbookTitle:'밤',type:'quiz',category:'word',score:1,totalItems:1},
  nextDay:{uid:'student',createdAt:at('2026-10-19T00:00:00+09:00'),wordbookTitle:'다음 날',type:'quiz',category:'word'},
  dayBefore:{uid:'student',createdAt:at('2026-10-17T23:59:59+09:00'),wordbookTitle:'전날',type:'quiz',category:'word'},
  math:{uid:'student',createdAt:at('2026-10-18T10:00:00+09:00'),wordbookTitle:'수학',type:'quiz',subject:'수학'},
  foreign:{uid:'foreign',createdAt:at('2026-10-18T10:00:00+09:00'),wordbookTitle:'FOREIGN'},
 };
 const r=await loadLessonDayStudy(f.db,f.actor,key,'2026-10-18',f.deps);
 assert.deepEqual(r.sessions.map((s:any)=>s.id),['lateNight','test','morning']);
 const test=r.sessions[1] as any;
 assert.deepEqual([test.score,test.totalItems,test.dayStart,test.dayEnd,test.incorrectCount,test.wrongWords],[27,30,3,4,6,['a','b','c','d','e']]);
 assert.equal('incorrectAnswers' in test,false,'no answer details on the lesson screen');
 assert.equal((await loadLessonDayStudy(f.db,{...f.actor,scopes:[{studentKey:key,subject:'수학'}]},key,'2026-10-18',f.deps)).sessions.length,3,'a 수학 teacher of this student sees them too');
 assert.equal((await loadTeacherOnlineLearning(f.db,{...f.actor,scopes:[{studentKey:key,subject:'수학'}]},key,'',undefined,f.deps)).online.reason,'subject-not-available','the full online report stays 영어 only');
 assert.deepEqual((await loadLessonDayStudy(f.db,{...f.actor,scopes:[]},key,'2026-10-18',f.deps)).sessions,[],'not this student: none, no error');
 assert.deepEqual((await loadLessonDayStudy(f.db,f.actor,key,'2026-10-18',{readStudentMapping:async()=>null} as any)).sessions,[],'no linked account: none');
 await assert.rejects(loadLessonDayStudy(f.db,f.actor,key,'10/18',f.deps));
});
test('관리자 설정 › 앱 사용자 › 학습 기록: admin only, an account not linked yet, its own records and 출석 체크',async()=>{
 const {readAppUserStudy}=await import('../api/_lib/adminAppUserStudy.js');
 const f=fixture(3),admin={uid:'admin',admin:true,academyId:'main'};f.rows.users.foreign={role:'student'};
 f.rows.attendance={a:{studentId:'foreign',status:'present',date:'2026-10-02'},b:{studentId:'foreign',status:'present',date:'2026-10-20'},c:{studentId:'foreign',status:'absent',date:'2026-10-21'},d:{studentId:'student',status:'present',date:'2026-10-22'}};
 await assert.rejects(readAppUserStudy(f.db,f.actor,'foreign'),/FORBIDDEN/,'a teacher cannot');
 await assert.rejects(readAppUserStudy(f.db,admin,'student'),/FORBIDDEN/,'a linked account is seen in 학생 관리');
 f.rows.users.someTeacher={role:'teacher'};await assert.rejects(readAppUserStudy(f.db,admin,'someTeacher'),/FORBIDDEN/);
 const r:any=await readAppUserStudy(f.db,admin,'foreign');
 assert.deepEqual(r.online.sessions.map((s:any)=>s.wordbookTitle),['FOREIGN']);assert.equal(r.online.progress.recorded,1);assert.equal(r.online.progress.learned,1);
 assert.deepEqual(r.attendance.days,['2026-10-20','2026-10-02']);assert.ok(!JSON.stringify(r).includes('단어장 '),'never another account');
});
test('앱 사용자 › 학습 기록: 변형 문제, 지문 분석 and 워크북 of an account not linked yet, its own only, admin only',async()=>{
 const {readAppUserQuestions,readAppUserMaterials}=await import('../api/_lib/adminAppUserStudy.js');
 const f=fixture(1),admin={uid:'admin',admin:true,academyId:'main'};f.rows.users.foreign={role:'student'};
 f.rows.questionAttempts={q1:{id:'q1',uid:'foreign',kind:'self',title:'관계대명사',status:'submitted',createdAt:1,updatedAt:5,score:{correct:3,total:4},results:[]},q2:{id:'q2',uid:'foreign',kind:'self',title:'새 문제',status:'draft',createdAt:2,updatedAt:9},q3:{id:'q3',uid:'student',kind:'self',title:'OTHER',status:'draft',createdAt:3,updatedAt:10}};
 f.rows.passageViews={'foreign_p1':{uid:'foreign',passageId:'p1',at:100},'foreign_p2':{uid:'foreign',passageId:'p2',at:200},'student_p3':{uid:'student',passageId:'p3',at:300}};
 f.rows.passages={p1:{title:'모의고사 20번',sentences:['First sentence.']},p2:{title:'',sentences:['Second one.']},p3:{title:'OTHER'}};
 f.rows.workbookHistory={'foreign:k1':{ownerUid:'foreign',key:'k1',title:'모의고사 20번',updatedAt:50,versions:[{version:1,at:40,sentences:8},{version:2,at:50,sentences:8}]},'student:k2':{ownerUid:'student',key:'k2',title:'OTHER',updatedAt:60,versions:[]}};
 await assert.rejects(readAppUserQuestions(f.db,f.actor,'foreign'),/FORBIDDEN/);await assert.rejects(readAppUserMaterials(f.db,admin,'student'),/FORBIDDEN/);
 const q:any=await readAppUserQuestions(f.db,admin,'foreign');assert.deepEqual(q.attempts.map((a:any)=>a.title),['새 문제','관계대명사']);
 const m:any=await readAppUserMaterials(f.db,admin,'foreign');
 assert.deepEqual(m.passages.map((p:any)=>p.id),['p2','p1']);assert.equal(m.passages[1].first,'First sentence.');
 assert.equal(m.workbooks.length,1);assert.equal(m.workbooks[0].versions.length,2);assert.ok(!JSON.stringify([q,m]).includes('OTHER'),'never another account');
});
test('과제 list: a 과제 checked in a later 영어 lesson carries that 숙제 평가 (graded), as the student app shows it',async()=>{
 const f=fixture();
 const lesson=(id:string,subject:string,day:string,task:string,homework='')=>({internalStudentId:'internal',reportIdentity:id,notionPageId:id,subject,lessonDateStart:day+'T14:00:00+09:00',derivedAssignment:task,homework});
 f.rows.lessonReports={a:lesson('a','영어','2026-10-01','교재 3과'),b:lesson('b','영어','2026-10-05','','상'),m:lesson('m','수학','2026-10-06','','미제출'),c:lesson('c','영어','2026-10-08','단어 Day 5','미확인')};
 const list=(await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps)).online.assignments as any[];
 const by=(t:string)=>list.find(a=>a.content===t);
 assert.deepEqual(by('교재 3과').graded,{grade:'상',date:'2026-10-05'});
 assert.equal(by('단어 Day 5').graded,null,'not checked yet (미확인 is not a check)');
});
test('과제 list: a 과제 carried to the next 일지 word for word is listed once, at the later one',async()=>{
 const f=fixture();
 const lesson=(id:string,day:string,task:string,homework='')=>({internalStudentId:'internal',reportIdentity:id,notionPageId:id,subject:'영어',lessonDateStart:day+'T14:00:00+09:00',derivedAssignment:task,homework});
 f.rows.lessonReports={a:lesson('a','2026-10-20','어법 프린트 3장'),t:lesson('t','2026-10-22','어법 프린트 3장','없는 날'),b:lesson('b','2026-10-23','독해 2지문','상')};
 const list=(await loadTeacherOnlineLearning(f.db,f.actor,key,'',undefined,f.deps)).online.assignments as any[];
 const rows=list.filter(a=>a.content==='어법 프린트 3장');
 assert.equal(rows.length,1,'once');
 assert.deepEqual(rows[0].graded,{grade:'상',date:'2026-10-23'});
});
