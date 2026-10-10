import test from 'node:test';
import assert from 'node:assert/strict';
import {cancelAcademicArchive} from '../api/_lib/teacherAcademicArchive.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
const id='11111111-1111-4111-8111-111111111111',student='22222222-2222-4222-8222-222222222222';
function fixture(extra:any={}){
 const f=registrationFirestore(),actor={uid:'t',academyId:'main',admin:false,scopes:[{studentKey:student,subject:'영어'}]};
 f.rows.set('teacherAcademicDrafts/'+id,{ownerUid:'t',academyId:'main',revision:2,stage:'published',deleteRequested:true,data:{studentKey:student,subject:'영어'},...extra});
 return {...f,actor};
}
test('only a delete intent with no remote attempt can be canceled',async()=>{
 const f=fixture();await cancelAcademicArchive(f.db,f.actor,id,2);assert.equal(f.rows.get('teacherAcademicDrafts/'+id).deleteRequested,false);
 const old=fixture({deleteAttempted:true});await assert.rejects(cancelAcademicArchive(old.db,old.actor,id,2),/NOTION_WRITE_RESULT_UNCERTAIN/);assert.equal(old.rows.get('teacherAcademicDrafts/'+id).deleteRequested,true);
 const busy=fixture({deleteLeaseUntil:Date.now()+60000});await assert.rejects(cancelAcademicArchive(busy.db,busy.actor,id,2),/PUBLISH_IN_PROGRESS/);
 await assert.rejects(cancelAcademicArchive(f.db,f.actor,id,1),/DRAFT_CONFLICT/);
 await assert.rejects(cancelAcademicArchive(f.db,{...f.actor,uid:'other'},id,2),/FORBIDDEN/);
});
