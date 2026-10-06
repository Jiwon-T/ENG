import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveTeacherAcademic,cancelAcademicArchive} from '../api/_lib/teacherAcademicArchive.js';
import {syncAcademicPage,GRADE_DATABASE} from '../api/_lib/academic.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {hashStudentKey} from '../api/_lib/security.js';
const id='11111111-1111-4111-8111-111111111111',student='22222222-2222-4222-8222-222222222222',pageId='33333333-3333-4333-8333-333333333333';
function fixture(){
 const f=registrationFirestore(),actor={uid:'t',academyId:'main',admin:false,scopes:[{studentKey:student,subject:'영어'}]};
 f.rows.set('teacherAcademicDrafts/'+id,{ownerUid:'t',academyId:'main',revision:2,stage:'published',notionPageId:pageId,notionEditedAt:'2026-10-05T00:00:00Z',data:{studentKey:student,subject:'영어'}});
 f.rows.set('notionStudentMappings/'+hashStudentKey(student),{notionStudentPageId:student,studentKey:student,internalStudentId:'internal'});
 f.rows.set('academicRecords/'+pageId,{internalStudentId:'internal',score:0,sourceUpdatedAt:'2026-10-05T00:00:00Z',teacherDraftId:id,teacherAppRevision:2});
 const page:any={id:pageId,parent:{database_id:GRADE_DATABASE},last_edited_time:'2026-10-05T00:00:00Z',archived:false,properties:{학생:{relation:[{id:student}]},'앱 기록 ID':{rich_text:[{plain_text:id}]}}};
 let lost=false,writes=0;
 const notion:any=async(path:string,method='GET',body:any)=>{if(path.endsWith('/query'))return {results:[structuredClone(page)],has_more:false};if(method==='PATCH'){writes++;page.archived=body.archived;if(lost){lost=false;throw Error('TIMEOUT');}}return structuredClone(page);};
 return {...f,actor,page,notion,lose:()=>{lost=true;},writes:()=>writes};
}
test('academic archive preserves zero score and source ID as tombstones and rejects late restoration',async()=>{
 const f=fixture();await archiveTeacherAcademic(f.db,f.actor,id,2,f.notion);
 assert.equal(f.page.archived,true);const r=f.rows.get('academicRecords/'+pageId);assert.equal(r.score,0);assert.equal(r.removed,true);assert.equal(r.teacherDraftId,id);
 const restored={...f.page,archived:false,last_edited_time:'2026-10-06T00:00:00Z',properties:{...f.page.properties,과목:{select:{name:'영어'}},'시험 종류':{select:{name:'학력평가'}}}};
 const result=await syncAcademicPage(f.db as any,restored,async()=>{throw Error('Must not resolve student on blocked Make');});
 assert.equal(result.reason,'APP_OWNED');assert.equal(f.rows.get('academicRecords/'+pageId).removed,true);
 await archiveTeacherAcademic(f.db,f.actor,id,2,f.notion);assert.equal(f.writes(),1);
});
test('lost archive response reconciles same page without a second remote archive',async()=>{
 const f=fixture();f.lose();await assert.rejects(archiveTeacherAcademic(f.db,f.actor,id,2,f.notion),/TIMEOUT/);
 assert.equal(f.rows.get('teacherAcademicDrafts/'+id).deleteRequested,true);assert.equal(f.rows.get('academicRecords/'+pageId).removed,undefined);
 await archiveTeacherAcademic(f.db,f.actor,id,2,f.notion);assert.equal(f.writes(),1);assert.equal(f.rows.get('academicRecords/'+pageId).removed,true);
});
test('academic archive refuses other authors, foreign academies, changed originals and live leases',async()=>{
 const f=fixture();await assert.rejects(archiveTeacherAcademic(f.db,{...f.actor,uid:'other'},id,2,f.notion),/FORBIDDEN/);
 await assert.rejects(archiveTeacherAcademic(f.db,{...f.actor,academyId:'other'},id,2,f.notion),/FORBIDDEN/);
 f.rows.get('teacherAcademicDrafts/'+id).notionWrite={leaseUntil:Date.now()+10000};await assert.rejects(archiveTeacherAcademic(f.db,f.actor,id,2,f.notion),/PUBLISH_IN_PROGRESS/);
 f.rows.get('teacherAcademicDrafts/'+id).notionWrite=null;f.page.last_edited_time='2026-10-06T00:00:00Z';await assert.rejects(archiveTeacherAcademic(f.db,f.actor,id,2,f.notion),/NOTION_EDIT_CONFLICT/);assert.equal(f.writes(),0);
});
test('academic archive will not hide another student report or recreate an uncertain absent page',async()=>{
 const f=fixture();f.rows.get('academicRecords/'+pageId).internalStudentId='other';await assert.rejects(archiveTeacherAcademic(f.db,f.actor,id,2,f.notion),/SOURCE_IDENTITY_LOCKED/);assert.equal(f.rows.get('academicRecords/'+pageId).removed,undefined);
 const g=fixture(),r=g.rows.get('teacherAcademicDrafts/'+id);r.notionPageId=null;r.notionWrite={attempted:true};await assert.rejects(archiveTeacherAcademic(g.db,g.actor,id,2,async()=>({results:[],has_more:false})),/NOTION_WRITE_RESULT_UNCERTAIN/);assert.equal(g.writes(),0);
});
test('only a delete intent with no remote attempt can be canceled',async()=>{
 const f=fixture();f.page.last_edited_time='2026-10-06T00:00:00Z';await assert.rejects(archiveTeacherAcademic(f.db,f.actor,id,2,f.notion),/NOTION_EDIT_CONFLICT/);
 await cancelAcademicArchive(f.db,f.actor,id,2);assert.equal(f.rows.get('teacherAcademicDrafts/'+id).deleteRequested,false);
 f.page.last_edited_time='2026-10-05T00:00:00Z';f.lose();await assert.rejects(archiveTeacherAcademic(f.db,f.actor,id,2,f.notion),/TIMEOUT/);
 await assert.rejects(cancelAcademicArchive(f.db,f.actor,id,2),/NOTION_WRITE_RESULT_UNCERTAIN/);assert.equal(f.rows.get('teacherAcademicDrafts/'+id).deleteRequested,true);
});
