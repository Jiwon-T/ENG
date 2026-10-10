import test from 'node:test';
import assert from 'node:assert/strict';
import {assertTeacherSettingsAccess} from '../api/_lib/teacherSettingsPolicy.ts';
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
