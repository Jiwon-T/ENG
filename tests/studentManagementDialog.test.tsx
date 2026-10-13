import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import StudentManagementCard from '../src/components/teacher/StudentManagementCard';
import StudentManagementDialog from '../src/components/teacher/StudentManagementDialog';
import WorkspaceDialog from '../src/components/teacher/WorkspaceDialog';
import {createStudentDialogNavigation} from '../src/lib/studentDialogNavigation';

test('student card offers separate native report and management actions without nested buttons',()=>{
 const html=renderToStaticMarkup(<StudentManagementCard student={{studentDisplayName:'학생(학교 고1)',subjects:[{subject:'영어',status:'중단'}],hasGuardianContact:true}} onOpen={()=>{}}/>);
 assert.equal((html.match(/<button/g)||[]).length,3);assert.match(html,/type="button"/);assert.match(html,/리포트 확인/);assert.match(html,/영어 · 중단/);assert.match(html,/보호자 연락처 등록됨/);assert.equal(html.includes('정보 수정'),false);
});
test('administrator defaults to report and six tabs (with 입학·상담) share exactly one native dialog',()=>{
 const html=renderToStaticMarkup(<StudentManagementDialog name="학생" canManage onClose={()=>{}} onSelect={()=>{}} render={(tab,leave)=><WorkspaceDialog open title="정보 수정" onClose={leave}><p>{tab}</p></WorkspaceDialog>}/>);
 assert.equal((html.match(/<dialog/g)||[]).length,1);assert.equal((html.match(/role="tab"/g)||[]).length,6);assert.match(html,/입학·상담/);assert.match(html,/role="tabpanel"/);assert.match(html,/aria-selected="true"[^>]*>리포트 확인/);assert.match(html,/<p>review<\/p>/);assert.equal((html.match(/닫기<\/button>/g)||[]).length,1);
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
test('inline, closing 수업 작성 goes back to the report; closing the report closes the student',()=>{
 const run=(initialTab:string)=>{let closed=0,leave=()=>{};renderToStaticMarkup(<StudentManagementDialog inline name="학생" canManage={false} initialTab={initialTab} onClose={()=>{closed++;}} onSelect={()=>{}} render={(_tab,l)=>{leave=l;return null;}}/>);leave();return closed;};
 assert.equal(run('lesson'),0,'수업 작성 returns to the report');
 assert.equal(run('review'),1);
});
import {createUnsavedGuard} from '../src/lib/unsavedGuard';
const later=<T,>(value:T)=>new Promise<T>(resolve=>setTimeout(()=>resolve(value),5));
test('async close (app modal): the requested tab or student switch waits for the answer and is not lost',async()=>{
 let panel='review',student='a',closed=0,answer=true;
 const n=createStudentDialogNavigation(()=>closed++);
 // 학습 리포트 평가 box: unsaved, asks with the modal, which answers later.
 const guard=createUnsavedGuard(()=>later(answer),'저장하지 않은 평가');guard.mark(true);
 n.registerClose(()=>Promise.resolve(guard.proceed(()=>{n.leave();guard.mark(false);})));
 await n.attempt(()=>{panel='lesson';});
 assert.equal(panel,'lesson','버리고 이동 → the tab switch runs');assert.equal(closed,0,'the student dialog stays open');
 guard.mark(true);await n.attempt(()=>{student='b';});
 assert.equal(student,'b','student switch runs');assert.equal(closed,0);
});
test('async close cancelled, failed or superseded: the move is dropped and a later close does not run it',async()=>{
 let panel='review',closed=0;const n=createStudentDialogNavigation(()=>closed++);
 n.registerClose(async()=>{if(!await later(false))return;n.leave();});
 await n.attempt(()=>{panel='message';});
 assert.equal(panel,'review','계속 작성 → no switch');
 n.registerClose(()=>n.leave());n.leave();assert.equal(closed,1,'a later plain close closes, not the stale switch');assert.equal(panel,'review');
 n.registerClose(async()=>{await later(0);throw new Error('save failed');});
 await n.attempt(()=>{panel='profile';});
 n.registerClose(()=>n.leave());n.leave();assert.equal(panel,'review','failed close drops the move');assert.equal(closed,2);
 // A new request while a check is waiting is ignored, so a late answer only ever belongs to its own move.
 let release!:(ok:boolean)=>void;const first=new Promise<boolean>(r=>{release=r;});
 n.registerClose(async()=>{if(!await first)return;n.leave();});
 const old=n.attempt(()=>{panel='first';});n.attempt(()=>{panel='second';});
 assert.equal(panel,'review','nothing moves while the first check waits');release(false);await old;
 n.registerClose(()=>n.leave());n.leave();assert.equal(closed,3);assert.equal(panel,'review');
});
test('수업 작성 close is always async: with nothing unsaved the switch still happens instead of closing',async()=>{
 let panel='lesson',closed=0;const n=createStudentDialogNavigation(()=>closed++);
 const leaveLessonGuard=async()=>true; // nothing unsaved → resolves true at once, but after a microtask
 n.registerClose(async()=>{if(!await leaveLessonGuard())return;n.leave();});
 await n.attempt(()=>{panel='review';});
 assert.equal(panel,'review');assert.equal(closed,0);
 await n.attempt(()=>{panel='message';},true);assert.equal(panel,'review','busy still blocks');
});
test('a late approval (true) runs only its own move: never the newer request, never closing the student',async()=>{
 let panel='review',closed=0;const n=createStudentDialogNavigation(()=>closed++);
 let release!:(ok:boolean)=>void;const answer=new Promise<boolean>(r=>{release=r;});
 n.registerClose(async()=>{if(!await answer)return;n.leave();});
 const first=n.attempt(()=>{panel='lesson';});
 n.attempt(()=>{panel='message';}); // clicked while the first check waits
 assert.equal(panel,'review');
 release(true);await first;
 assert.equal(panel,'lesson','the approved first move runs');assert.equal(closed,0,'the student dialog stays open');
 n.registerClose(()=>n.leave());n.attempt(()=>{panel='message';});assert.equal(panel,'message','after the check, new moves work again');assert.equal(closed,0);
});
