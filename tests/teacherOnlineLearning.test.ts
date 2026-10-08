import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {loadTeacherOnlineLearning} from '../api/_lib/teacherOnlineLearning.js';
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
  doc:(id:string)=>({get:async()=>{reads.push(name);return {data:()=>rows[name]?.[id],exists:Boolean(rows[name]?.[id])};}}),where:(...f:any[])=>query(name,[...filters,f],orders,cursor,max),orderBy:(k:any,dir:string)=>query(name,filters,[...orders,[k,dir]],cursor,max),startAfter:(...v:any[])=>query(name,filters,orders,v,max),limit:(v:number)=>query(name,filters,orders,cursor,v),
  get:async()=>{reads.push(name);let records=Object.entries(rows[name]||{}).filter(([,r]:any)=>filters.every(([k,op,v])=>op==='=='?r[k]===v:false));
   const compare=(a:any,b:any)=>{for(let i=0;i<orders.length;i++){const [k,dir]=orders[i],d=cmp(value(a[1],k,a[0]),value(b[1],k,b[0]));if(d)return dir==='desc'?-d:d;}return 0;};records.sort(compare);
   if(cursor)records=records.filter(([id,r])=>{for(let i=0;i<orders.length;i++){const [k,dir]=orders[i],d=cmp(value(r,k,id),cursor[i]);if(d)return dir==='desc'?d<0:d>0;}return false;});return {docs:records.slice(0,max).map(([id,r])=>({id,data:()=>r}))};},
  count:()=>({get:async()=>{const r=await query(name,filters).get();return {data:()=>({count:r.docs.length})};}}),
 });
 const db:any={collection:(name:string)=>query(name)},actor={uid:'teacher',admin:false,academyId:'main',scopes:[{studentKey:key,subject:'영어'}],db};
 const deps:any={readStudentMapping:async()=>rows.notionStudentMappings[hashStudentKey(key)]};return {db,actor,deps,rows,reads};
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
