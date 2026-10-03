import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import TeacherClassManager from '../src/components/teacher/TeacherClassManager';
const data={uid:'teacher',admin:false,teachingScopes:[{studentKey:'current',subject:'영어'},{studentKey:'paused',subject:'영어'}],students:[{studentKey:'current',studentDisplayName:'재원 학생',subjects:[{subject:'영어',status:'등록'}]},{studentKey:'paused',studentDisplayName:'중단 학생',subjects:[{subject:'영어',status:'중단'}]}],classes:[{id:'class',ownerUid:'teacher',name:'월요반',subject:'영어',students:['current'],slots:[{weekday:1,start:'14:00',end:'15:30'}],books:[{title:'문법 교재',status:'current'}]}],curricula:[]};
const props={data,busy:false,request:async()=>({}),refresh:async()=>{},act:async()=>{}};
test('regular timetable has Monday–Sunday columns and its own repeat schedule guide',()=>{
 const html=renderToStaticMarkup(<TeacherClassManager {...props} mode="schedule"/>);
 const headings=[...html.matchAll(/<header><strong>(.*?)<\/strong><\/header>/g)].map(m=>m[1]);
 assert.deepEqual(headings,['월','화','수','목','금','토','일']);assert.ok(html.includes('14:00'));assert.ok(html.includes('날짜별 변경·보강은 위 일정표에 따로 등록'));
 assert.ok(html.includes('재원생'));assert.ok(html.includes('이외'));assert.ok(html.includes('재원 학생'));assert.equal(html.includes('중단 학생'),false);
});
test('curriculum screen shares class records and provides editable curriculum and textbook states',()=>{
 const html=renderToStaticMarkup(<TeacherClassManager {...props} mode="curriculum"/>);
 assert.ok(html.includes('월요반'));assert.ok(html.includes('교재 1권'));assert.ok(html.includes('커리큘럼 등록'));assert.ok(html.includes('진도·수업 계획'));assert.ok(html.includes('+ 교재'));
 assert.equal(html.includes('weekly-board'),false);
});
