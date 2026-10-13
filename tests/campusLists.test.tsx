import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'node:fs';
import {campusCounts,lessonCampus,studentCampusLabel,studentCampuses} from '../src/lib/campus';
import TeacherTodayLessons from '../src/components/teacher/TeacherTodayLessons';
import StudentMasterPanel from '../src/components/teacher/StudentMasterPanel';

const day='2026-10-07',weekday=new Date(`${day}T12:00:00+09:00`).getUTCDay();
const students=[
 {studentKey:'k1',studentDisplayName:'김규림 (용죽고1)',enrollmentStatus:'등록',subjects:[{subject:'영어',status:'등록',campus:'용죽'},{subject:'수학',status:'등록',campus:'이충'}]},
 {studentKey:'k2',studentDisplayName:'전소은 (비전고2)',enrollmentStatus:'등록',subjects:[{subject:'영어',status:'등록',campus:'이충'}]},
 {studentKey:'k3',studentDisplayName:'정재희 (동삭중3)',enrollmentStatus:'등록',subjects:[{subject:'영어',status:'등록'}]},
];
test('campus rules: a class gives its campus, other lessons use the student subject campus; labels and counts',()=>{
 const reg={id:'r',title:'',kind:'정규',subject:'영어',date:day,start:'18:00',end:'19:20',students:['k2'],campus:'용죽'} as any,extra={...reg,campus:null};
 assert.equal(lessonCampus(reg,'k2',students),'용죽','the class decides');assert.equal(lessonCampus(extra,'k2',students),'이충','보강: the student subject campus');assert.equal(lessonCampus(extra,'k3',students),null);
 assert.equal(studentCampusLabel(students[0]),'영어 용죽 · 수학 이충');assert.equal(studentCampusLabel(students[1]),'이충');assert.equal(studentCampusLabel(students[2]),'');
 assert.deepEqual(studentCampuses(students[0]),['용죽','이충']);
 assert.deepEqual(campusCounts(['이충','용죽',null,'이충','고덕']),[['용죽',1],['이충',2],['고덕',1]]);
});
test('오늘 수업: campus chips only when the day spans two or more campuses',()=>{
 const classes=[{id:'a',name:'고1 A',subject:'영어',status:'운영',ownerUid:'u',students:['k1'],campus:'용죽',slots:[{id:'1',weekday,start:'16:00',end:'17:20'}]},{id:'b',name:'고1 B',subject:'영어',status:'운영',ownerUid:'u',students:['k2'],campus:'이충',slots:[{id:'1',weekday,start:'18:00',end:'19:20'}]}];
 const html=renderToStaticMarkup(<TeacherTodayLessons data={{uid:'u',admin:true,students,classes,drafts:[],schedules:[],reflectedSchedules:[]}} date={day} onDate={()=>{}} request={async()=>({})} onStudent={()=>{}}/>);
 assert.match(html,/class="campus-chips"[^]*?전체 <b>2<\/b>[^]*?용죽 <b>1<\/b>[^]*?이충 <b>1<\/b>/);
 const one=renderToStaticMarkup(<TeacherTodayLessons data={{uid:'u',admin:true,students,classes:[classes[0]],drafts:[],schedules:[],reflectedSchedules:[]}} date={day} onDate={()=>{}} request={async()=>({})} onStudent={()=>{}}/>);
 assert.doesNotMatch(one,/campus-chips/,'one campus: no chips');
});
test('학생 관리: campus tag per student and chips when students are at two or more campuses',()=>{
 const html=renderToStaticMarkup(<StudentMasterPanel students={students} value="" onSelect={()=>{}}/>);
 assert.match(html,/class="smr-campus">영어 용죽 · 수학 이충</);assert.match(html,/class="smr-campus">이충</);
 assert.match(html,/class="campus-chips"[^]*?용죽 <b>1<\/b>[^]*?이충 <b>2<\/b>/);
});
test('학생 관리: all three campus chips (0 included) as soon as any student has a campus; none without campus data',()=>{
 const one=[{studentKey:'a',studentDisplayName:'가',enrollmentStatus:'등록',subjects:[{subject:'영어',status:'등록',campus:'용죽'}]}];
 const html=renderToStaticMarkup(<StudentMasterPanel students={one} value="" onSelect={()=>{}}/>);
 assert.match(html,/class="campus-chips"[^]*?용죽 <b>1<\/b>[^]*?이충 <b>0<\/b>[^]*?고덕 <b>0<\/b>/);
 const none=renderToStaticMarkup(<StudentMasterPanel students={[{studentKey:'b',studentDisplayName:'나',enrollmentStatus:'등록',subjects:[{subject:'영어',status:'등록'}]}]} value="" onSelect={()=>{}}/>);
 assert.doesNotMatch(none,/campus-chips/);
});
test('학생 관리: principal/admin get 전체 학생 / 내 담당 (list and dashboard follow it); teachers only see their own anyway',()=>{
 const withScope=renderToStaticMarkup(<StudentMasterPanel students={students} value="" onSelect={()=>{}} scope={{value:'mine',mine:2,onChange:()=>{}}}/>);
 assert.match(withScope,/class="student-scope"[^]*?aria-pressed="false"[^>]*>전체 학생<\/button><button[^>]*aria-pressed="true"[^>]*>내 담당 <b>2<\/b>/);
 assert.doesNotMatch(renderToStaticMarkup(<StudentMasterPanel students={students} value="" onSelect={()=>{}}/>),/student-scope/,'no switch for ordinary teachers');
 assert.ok(withScope.indexOf('student-scope')<withScope.indexOf('student-master-mobile'),'above the mobile layout too (not inside the desktop-only part)');
 const ws=fs.readFileSync(new URL('../src/components/teacher/TeacherWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ws,/const scopedStudents=canSeeAll&&studentScope==='mine'\?students\.filter\(\(s:any\)=>myStudentKeys\.has\(s\.studentKey\)\):students;/);
 assert.match(ws,/students=\{scopedStudents\} today=/);assert.match(ws,/<StudentOverview students=\{scopedStudents\}/);
});
