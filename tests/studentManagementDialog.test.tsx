import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import StudentManagementCard from '../src/components/teacher/StudentManagementCard';
import StudentManagementDialog from '../src/components/teacher/StudentManagementDialog';
import WorkspaceDialog from '../src/components/teacher/WorkspaceDialog';
import {createStudentDialogNavigation} from '../src/lib/studentDialogNavigation';

test('student card is one native keyboard-accessible action without scattered inner buttons',()=>{
 const html=renderToStaticMarkup(<StudentManagementCard student={{studentDisplayName:'학생(학교 고1)',subjects:[{subject:'영어',status:'중단'}],hasGuardianContact:true}} onOpen={()=>{}}/>);
 assert.equal((html.match(/<button/g)||[]).length,1);assert.match(html,/type="button"/);assert.match(html,/학생 관리 열기/);assert.match(html,/영어 · 중단/);assert.match(html,/보호자 연락처 등록됨/);assert.equal(html.includes('정보 수정'),false);
});
test('administrator defaults to profile and five tabs share exactly one native dialog',()=>{
 const html=renderToStaticMarkup(<StudentManagementDialog name="학생" canManage onClose={()=>{}} onSelect={()=>{}} render={(tab,leave)=><WorkspaceDialog open title="정보 수정" onClose={leave}><p>{tab}</p></WorkspaceDialog>}/>);
 assert.equal((html.match(/<dialog/g)||[]).length,1);assert.equal((html.match(/role="tab"/g)||[]).length,5);assert.match(html,/role="tabpanel"/);assert.match(html,/aria-selected="true"[^>]*>정보 수정/);assert.match(html,/<p>profile<\/p>/);assert.equal((html.match(/닫기<\/button>/g)||[]).length,1);
});
test('ordinary teacher only sees existing three authorized functions and opens report',()=>{
 const html=renderToStaticMarkup(<StudentManagementDialog name="학생" canManage={false} onClose={()=>{}} onSelect={()=>{}} render={(tab)=><p>{tab}</p>}/>);
 assert.equal((html.match(/role="tab"/g)||[]).length,3);assert.equal(html.includes('정보 수정'),false);assert.equal(html.includes('수강·담당·반 관리'),false);assert.match(html,/aria-selected="true"[^>]*>리포트 확인/);assert.match(html,/<p>review<\/p>/);
});
test('rejected or busy navigation keeps the panel and does not queue a stale switch',()=>{
 let panel='profile',closed=0;const n=createStudentDialogNavigation(()=>closed++);
 n.registerClose(()=>{});n.attempt(()=>{panel='message';});assert.equal(panel,'profile');n.leave();assert.equal(closed,1);assert.equal(panel,'profile');
 n.registerClose(()=>n.leave());n.attempt(()=>{panel='review';},true);assert.equal(panel,'profile');n.attempt(()=>{panel='lesson';});assert.equal(panel,'lesson');assert.equal(closed,1);
});
test('old panel cleanup cannot remove the new guard and standalone close still closes',()=>{
 let accepted=false,closed=0;const n=createStudentDialogNavigation(()=>closed++),old=n.registerClose(()=>n.leave());n.registerClose(()=>{});old();n.attempt(()=>{accepted=true;});assert.equal(accepted,false);
 const cleanup=n.registerClose(()=>n.leave());n.attempt(()=>{accepted=true;});assert.equal(accepted,true);cleanup();n.leave();assert.equal(closed,1);
});
