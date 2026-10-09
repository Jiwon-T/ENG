import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { templateFirestore } from './helpers/templateFirestore.js';
import { hashStudentKey } from '../api/_lib/security.js';
import { saveAppLesson, publishAppLesson, archiveAppLesson } from '../api/_lib/appLesson.js';
const key = '11111111-1111-4111-8111-111111111111';
function fixture() {
 const f=templateFirestore(), actor={uid:'teacher',academyId:'main',admin:false,scopes:[{studentKey:key,subject:'영어'}]};
 f.rows.set('academyCoreAuthority/main',{active:true});
 f.rows.set('teacherWorkspaceAccess/teacher',{academyId:'main',scopes:actor.scopes});
 f.rows.set('academyStudentMemberships/'+key,{academyId:'main',internalStudentId:'internal'});
 f.rows.set('notionStudentMappings/'+hashStudentKey(key),{studentKey:key,internalStudentId:'internal'});
 const data={studentKey:key,subject:'영어',date:'2026-10-09',start:'14:00',end:'15:20',classSession:'있음',round:1,selfStudy:'없음',attendance:'출석',attitude:'상',homework:'상',test:'상',content:'수업 내용',assignment:'복습',note:'',nextPlan:'',correct:9,total:10};
 return {...f,actor,data};
}
test('private saves and two same-day lessons stay separate; publication replay has no writes',async()=>{
 const f=fixture(),a=randomUUID(),b=randomUUID(); await saveAppLesson(f.db,f.actor,{id:a,data:f.data});
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('lessonReports/')).length,0);
 await saveAppLesson(f.db,f.actor,{id:b,data:{...f.data,start:'17:00',end:'18:20',round:2}});
 await publishAppLesson(f.db,f.actor,a,1);await publishAppLesson(f.db,f.actor,b,1);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('lessonReports/')).length,2);
 const writes=f.metrics.writes;await publishAppLesson(f.db,f.actor,a,1);assert.equal(f.metrics.writes,writes);
 assert.equal(f.rows.get('lessonReports/app-'+a).notionPageId,null);
});
test('edited draft leaves public values unchanged until publish and preserves public identity',async()=>{
 const f=fixture(),id=randomUUID();await saveAppLesson(f.db,f.actor,{id,data:f.data});await publishAppLesson(f.db,f.actor,id,1);
 const prior=f.rows.get('lessonReports/app-'+id);await saveAppLesson(f.db,f.actor,{id,revision:1,data:{...f.data,content:'새 수업',round:1.5,end:'16:00'}});
 assert.deepEqual(f.rows.get('lessonReports/app-'+id),prior);await assert.rejects(publishAppLesson(f.db,f.actor,id,1),/DRAFT_CONFLICT/);
 await publishAppLesson(f.db,f.actor,id,2);assert.equal(f.rows.get('lessonReports/app-'+id).reportIdentity,prior.reportIdentity);
 assert.equal(f.rows.get('teacherLessonDrafts/'+id).data.round,1.5);
});
test('failed transaction exposes no public record; revoked scope rejects publication',async()=>{
 const f=fixture(),id=randomUUID();await saveAppLesson(f.db,f.actor,{id,data:f.data});const before=structuredClone([...f.rows]);f.failNextCommit();
 await assert.rejects(publishAppLesson(f.db,f.actor,id,1),/FIRESTORE_UNAVAILABLE/);assert.deepEqual([...f.rows],before);
 f.rows.get('teacherWorkspaceAccess/teacher').scopes=[];await assert.rejects(publishAppLesson(f.db,f.actor,id,1),/FORBIDDEN/);
});
test('legacy compact report ID and identity survive takeover; duplicate originals are refused',async()=>{
 const f=fixture(),id=randomUUID(),source=randomUUID(),compact=source.replace(/-/g,'');
 f.rows.set('teacherLessonDrafts/'+id,{ownerUid:'teacher',academyId:'main',data:f.data,revision:3,stage:'published',notionPageId:source});
 f.rows.set('lessonReports/'+compact,{internalStudentId:'internal',notionPageId:source,reportIdentity:'existing-public',teacherDraftId:id});
 await publishAppLesson(f.db,f.actor,id,3);assert.equal(f.rows.get('teacherLessonDrafts/'+id).revision,4);
 assert.equal(f.rows.get('lessonReports/'+compact).reportIdentity,'existing-public');await publishAppLesson(f.db,f.actor,id,3);
 f.rows.set('lessonReports/'+source,{internalStudentId:'internal',teacherDraftId:id});
 await assert.rejects(archiveAppLesson(f.db,f.actor,id,4),/SOURCE_IDENTITY_LOCKED/);
});
test('uncertain Notion create and active lease block takeover; foreign owner is rejected',async()=>{
 const f=fixture(),id=randomUUID();await saveAppLesson(f.db,f.actor,{id,data:f.data});const r=f.rows.get('teacherLessonDrafts/'+id);
 r.notionWrite={attempted:true,done:false};await assert.rejects(publishAppLesson(f.db,f.actor,id,1),/NOTION_WRITE_RESULT_UNCERTAIN/);
 r.notionWrite={leaseUntil:Date.now()+60000};await assert.rejects(publishAppLesson(f.db,f.actor,id,1),/PUBLISH_IN_PROGRESS/);
 r.notionWrite=null;await assert.rejects(publishAppLesson(f.db,{...f.actor,uid:'other'},id,1),/FORBIDDEN/);
});
test('selected lesson deletion keeps full history and other same-day lesson',async()=>{
 const f=fixture(),a=randomUUID(),b=randomUUID();for(const id of [a,b]){await saveAppLesson(f.db,f.actor,{id,data:f.data});await publishAppLesson(f.db,f.actor,id,1);}
 await archiveAppLesson(f.db,f.actor,a,1);assert.equal(f.rows.has('lessonReports/app-'+a),false);assert.equal(f.rows.has('lessonReports/app-'+b),true);
 const history=f.rows.get('lessonAppHistory/'+a+':1:archive');assert.equal(history.before.reportIdentity,a);assert.equal(history.beforeDraft.data.content,f.data.content);
 const writes=f.metrics.writes;await archiveAppLesson(f.db,f.actor,a,1);assert.equal(f.metrics.writes,writes);
});
