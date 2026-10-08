import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import AcademyDirectoryManager from '../src/components/teacher/AcademyDirectoryManager';
import WorkspaceSyncPanel from '../src/components/teacher/WorkspaceSyncPanel';
test('migration controls are explicit, collapsed/mounted, and perform zero requests on mount',()=>{
 let calls=0;const html=renderToStaticMarkup(<AcademyDirectoryManager busy={false} request={async()=>{calls++;}} act={()=>{}}/>);
 assert.equal(calls,0);assert.ok(html.includes('aria-expanded="false"'));assert.match(html,/<div hidden/);assert.ok(html.includes('dry-run'));assert.ok(html.includes('최종 대조 후 앱 전용 전환'));assert.ok(!html.includes('phone_number'));
});
test('only main academy admin receives migration controls',()=>{
 for(const data of [{admin:false,academyId:'main'},{admin:true,academyId:'other'},{admin:true,academyId:'main'}]){
  const html=renderToStaticMarkup(<WorkspaceSyncPanel data={data} busy={false} request={async()=>({})} act={()=>{}}/>);assert.equal(html.includes('학생·선생님·수강 이전'),data.admin&&data.academyId==='main');
 }
});
