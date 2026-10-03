import test from 'node:test';
import assert from 'node:assert/strict';
import {assertTeacherSettingsAccess} from '../api/_lib/teacherSettingsPolicy.ts';
import {scheduleArchivePatch} from '../api/_lib/teacherRecordArchive.ts';
const actor={uid:'head',admin:false,principal:true,academyId:'main'};
const value={workspaceRole:'teacher',academyId:'main'};
const target={workspaceRole:'teacher',academyId:'main',disabled:false};
test('principal can update own academy teacher assignments',()=>{assert.doesNotThrow(()=>assertTeacherSettingsAccess(actor,value,target,{role:'teacher'},[{academyId:'main'}]));});
test('principal cannot promote staff, cross academies, connect outsiders, or reopen disabled staff',()=>{
 for(const [v,t,u,m] of [
 [{...value,workspaceRole:'principal'},target,{role:'teacher'},[{academyId:'main'}]],
 [{...value,academyId:'other'},target,{role:'teacher'},[{academyId:'main'}]],
 [value,{...target,academyId:'other'},{role:'teacher'},[{academyId:'main'}]],
 [value,target,{role:'teacher'},[{academyId:'other'}]],
 [value,target,{role:'teacher'},[undefined]],
 [value,{...target,disabled:true},{role:'teacher'},[{academyId:'main'}]],
 [value,target,{role:'admin'},[{academyId:'main'}]],
 ] as any[]) assert.throws(()=>assertTeacherSettingsAccess(actor,v,t,u,m),/FORBIDDEN/);
 assert.throws(()=>assertTeacherSettingsAccess({...actor,principal:false},value,target,{role:'teacher'},[]),/FORBIDDEN/);
});
test('unreflected schedule deletion archives locally, reflected deletion publishes cancellation first',()=>{
 const record={revision:2,stage:'published',data:{title:'보강',status:'예정',students:['student']}};
 assert.deepEqual(scheduleArchivePatch(record,2,123),{archived:true,updatedAt:123});
 const patch=scheduleArchivePatch({...record,notionPageId:'page'},2,123)!;
 assert.equal('archived' in patch,false);assert.equal(patch.data.status,'취소');assert.equal(patch.data.title,'보강');assert.deepEqual(patch.data.students,['student']);assert.equal(patch.revision,3);assert.equal(patch.deleteRequested,true);assert.equal(patch.stage,'publishing');
});
test('schedule deletion preserves publish lock and rejects stale editors',()=>{
 assert.throws(()=>scheduleArchivePatch({stage:'processing',revision:2},2,123),/PUBLISH_IN_PROGRESS/);
 assert.throws(()=>scheduleArchivePatch({stage:'draft',revision:2},1,123),/DRAFT_CONFLICT/);
 assert.equal(scheduleArchivePatch({archived:true},undefined,123),null);
});
