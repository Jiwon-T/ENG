import test from 'node:test';
import assert from 'node:assert/strict';
import {templateFirestore} from './helpers/templateFirestore.js';
import {saveManaged,archiveManaged,readManaged,CLASS_AUTHORITY} from '../api/_lib/managedAcademy.js';
import {DIRECTORY_ROWS,directoryRowKey} from '../api/_lib/academyDirectorySource.js';
import {CORE_AUTHORITY} from '../api/_lib/academyCore.js';
const cls='11111111-1111-4111-8111-111111111111',book='22222222-2222-4222-8222-222222222222',slot='33333333-3333-4333-8333-333333333333',student='44444444-4444-4444-8444-444444444444',at='2026-10-01T00:00:00.000Z';
/** One class with a time slot, a linked common plan and a student, as the one-time Notion import left them; classes are app-only. */
function fixture(){
 const f=templateFirestore(),actor={uid:'owner',admin:true,principal:false,academyId:'main',scopes:[]};
 f.rows.set('teacherWorkspaceAccess/owner',{academyId:'main'});
 f.rows.set('academyStudentMemberships/'+student,{academyId:'main'});f.rows.set(DIRECTORY_ROWS+'/'+directoryRowKey('students',student),{kind:'students',academyId:'main',notionPageId:student,revision:1,remoteEditedAt:at,fields:{properties:{'소속반':{relation:[{id:cls}]}},archived:false}});
 const base={ownerUid:'owner',assignedUids:[],academyId:'main',subject:'영어',notionEditedAt:at,revision:1,sourceMode:'firestore',notionSyncStage:'app_saved',notionSyncRequired:false,updatedAt:1};
 f.rows.set('teacherCurricula/'+book,{...base,notionPageId:book,title:'교재',content:'계획',classId:null,isCommon:true,classIds:[],progress:'시작 전'});
 f.rows.set('teacherClasses/'+cls,{...base,notionPageId:cls,name:'반',status:'진행 중',students:[student],slots:[{weekday:1,start:'14:00',end:'15:20',id:slot,notionEditedAt:at,status:'진행 중'}],books:[{id:book,linkedPlanId:book,progress:'시작 전',title:'교재',status:'planned'}]});
 f.rows.set(CLASS_AUTHORITY+'/main',{active:true,by:'owner',at:1});f.rows.set(CORE_AUTHORITY+'/main',{active:true});
 return {...f,actor};
}
test('Notion blocked: read/update class and time, local common plan, student link, archive and history work',async()=>{
 const f=fixture(),fetcher=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw Error('NOTION_BLOCKED');}) as any;
 try{const old=f.rows.get('teacherClasses/'+cls),saved=await saveManaged(f.db,f.actor,'classes',{id:cls,revision:old.revision,data:{name:'새 반',subject:'영어',status:'진행 중',students:[],slots:[{id:slot,weekday:2,start:'16:00',end:'17:20'}],books:old.books}});
 assert.equal(saved.sourceMode,'firestore');assert.equal(f.rows.get('teacherClasses/'+cls).slots[0].weekday,2);assert.deepEqual(f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey('students',student)).fields.properties['소속반'].relation,[]);
 const plan=await saveManaged(f.db,f.actor,'curricula',{data:{title:'새 공통',subject:'영어',content:'본문',classId:null}});assert.equal(plan.record.isCommon,true);assert.equal(plan.record.notionPageId,undefined);
 const data=await readManaged(f.db,f.actor);assert.equal(data.classes[0].name,'새 반');assert.ok(data.curricula.some((r:any)=>r.id===plan.id));
 await archiveManaged(f.db,f.actor,'classes',cls,saved.revision);assert.equal((await readManaged(f.db,f.actor)).classes.length,0);assert.ok([...f.rows.keys()].some(k=>k.startsWith('academyManagedHistory/')));assert.equal(calls,0);
 }finally{globalThis.fetch=fetcher;}
});
test('foreign writer, stale revision, duplicate slots and failed commit never alter class/roster',async()=>{
 const f=fixture();const old=structuredClone(f.rows.get('teacherClasses/'+cls)),input={id:cls,revision:old.revision,data:{name:'반',subject:'영어',students:[student],slots:old.slots,books:old.books}};
 await assert.rejects(saveManaged(f.db,{...f.actor,uid:'foreign',admin:false},'classes',input),/FORBIDDEN/);await assert.rejects(saveManaged(f.db,f.actor,'classes',{...input,revision:0}),/DRAFT_CONFLICT/);
 await assert.rejects(saveManaged(f.db,f.actor,'classes',{...input,data:{...input.data,slots:[old.slots[0],old.slots[0]]}}),/INVALID_INPUT/);
 f.failNextCommit();await assert.rejects(saveManaged(f.db,f.actor,'classes',input),/FIRESTORE_UNAVAILABLE/);assert.deepEqual(f.rows.get('teacherClasses/'+cls),old);
});
