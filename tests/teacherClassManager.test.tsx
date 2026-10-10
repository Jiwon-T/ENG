import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import TeacherClassManager from '../src/components/teacher/TeacherClassManager';
import ClassStudentPicker,{classStudentMatches} from '../src/components/teacher/ClassStudentPicker';
const data={uid:'teacher',admin:false,teachingScopes:[{studentKey:'current',subject:'영어'},{studentKey:'paused',subject:'영어'}],students:[{studentKey:'current',studentDisplayName:'재원 학생',subjects:[{subject:'영어',status:'등록'}]},{studentKey:'paused',studentDisplayName:'중단 학생',subjects:[{subject:'영어',status:'중단'}]}],classes:[{id:'class',ownerUid:'teacher',name:'월요반',subject:'영어',students:['current'],slots:[{weekday:1,start:'14:00',end:'15:30'}],books:[{title:'문법 교재',status:'current'}]}],curricula:[]};
const props={data,busy:false,request:async()=>({}),refresh:async()=>{},act:async()=>{}};
test('regular timetable has Monday–Sunday columns and its own repeat schedule guide',()=>{
 const html=renderToStaticMarkup(<TeacherClassManager {...props} mode="schedule"/>);
 const headings=[...html.matchAll(/<header><strong>(.*?)<\/strong>/g)].map(m=>m[1]);
 assert.deepEqual(headings,['월','화','수','목','금','토','일']);assert.ok(html.includes('14:00'));assert.ok(html.includes('날짜별 변경·보강은 이번 주 일정에 등록'));
 assert.ok(html.includes('재원생'));assert.ok(html.includes('이외'));assert.equal(html.includes('재원 학생'),false,'students are listed only after a search');assert.equal(html.includes('중단 학생'),false);
});
test('curriculum screen shares class records and provides editable curriculum and textbook states',()=>{
 const html=renderToStaticMarkup(<TeacherClassManager {...props} mode="curriculum"/>);
 assert.ok(html.includes('월요반'),'classes appear as filter chips');assert.ok(html.includes('커리큘럼·교재 등록'));assert.ok(html.includes('반 관리'),'points to where classes are managed');assert.ok(html.includes('진도·수업 계획'));assert.ok(html.includes('새 교재'));
 assert.equal(html.includes('weekly-board'),false);assert.ok(html.includes('curriculum-management-board'));assert.ok(html.includes('cur-board'));assert.ok(html.includes('공통 계획에서 교재 선택'));assert.equal((html.match(/<dialog/g)||[]).length,2);
});
test('regular timetable sorts times and hides stopped classes and individual slots',()=>{
 const mk=(name:string,start:string,status?:string,slotStatus?:string)=>({...data.classes[0],id:name,name,status,slots:[{weekday:1,start,end:'22:00',status:slotStatus}]});
 const html=renderToStaticMarkup(<TeacherClassManager {...props} data={{...data,classes:[mk('늦은반','20:00'),mk('중단반','13:00','중단'),mk('대기반','16:00','대기'),mk('시간중단','14:00',undefined,'중단')]}} mode="schedule"/>);
 const board=html.split('class="schedule-board-wide"')[1]?.split('class="schedule-board-narrow"')[0]||'';
 assert.ok(board.indexOf('대기반')<board.indexOf('늦은반'));assert.equal(board.includes('중단반'),false);assert.equal(board.includes('시간중단'),false);
});
test('student picker: chosen students as chips, nobody else listed until a name or 초성 is typed',()=>{
 const people=[{studentKey:'a',studentDisplayName:'김수현 (용죽고1)'},{studentKey:'b',studentDisplayName:'정재희 (동삭중3)'}];
 const html=renderToStaticMarkup(<ClassStudentPicker current={people} others={[]} selected={['b']} nameOf={k=>people.find(p=>p.studentKey===k)!.studentDisplayName} onChange={()=>{}}/>);
 assert.ok(html.includes('정재희 (동삭중3)'));assert.equal(html.includes('김수현'),false);assert.equal(html.includes('검색 결과'),false);
 assert.deepEqual(classStudentMatches(people,'').map(p=>p.studentKey),[]);
 assert.deepEqual(classStudentMatches(people,'ㄳㅎ').map(p=>p.studentKey),['a'],'ㄱ+ㅅ typed together');
 assert.deepEqual(classStudentMatches(people,'재').map(p=>p.studentKey),['b']);
});
test('regular board shows lessons only; 정규 자습·테스트 get their own board below',()=>{
 const k={...data.classes[0],students:['current'],slots:[{weekday:1,start:'17:30',end:'18:50',kind:'lesson',study:[{start:'18:50',end:'19:50'}]},{weekday:3,start:'20:00',end:'21:00',kind:'test'}]};
 const html=renderToStaticMarkup(<TeacherClassManager {...props} data={{...data,classes:[k]}} mode="schedule"/>);
 const [lessons,extras]=html.split('class="schedule-extras"');
 const wide=(s:string)=>s.split('class="schedule-board-wide"')[1]?.split('class="schedule-board-narrow"')[0]||'';
 assert.ok(wide(lessons).includes('17:30–18:50'));assert.equal(wide(lessons).includes('20:00–21:00'),false,'test is not a lesson');
 assert.ok(extras.includes('정규 자습·테스트'));assert.ok(wide(extras).includes('18:50–19:50'));assert.ok(wide(extras).includes('20:00–21:00'));
 assert.ok(wide(extras).includes('schedule-kind is-study'));assert.ok(wide(extras).includes('schedule-kind is-test'));
 const none=renderToStaticMarkup(<TeacherClassManager {...props} mode="schedule"/>);assert.equal(none.includes('schedule-extras'),false,'hidden when there is no 자습 or 테스트');
});
