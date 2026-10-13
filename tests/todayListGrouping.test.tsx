import fs from 'node:fs';
import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import TeacherTodayLessons from '../src/components/teacher/TeacherTodayLessons';
import {setTodayVisibility} from '../src/lib/todayLessonVisibility';

const day='2026-10-07',weekday=new Date(`${day}T12:00:00+09:00`).getUTCDay();
const students=['류현수 (용죽고1)','이현준 (용죽고1)','김규림 (용죽고1)','김경현 (용죽고1)'].map((n,i)=>({studentKey:'k'+i,studentDisplayName:n}));
const classes=[
 {id:'a',name:'고1 독해 A',subject:'영어',status:'운영',ownerUid:'u',students:['k0','k1'],slots:[{id:'1',weekday,start:'18:50',end:'20:10'}]},
 {id:'b',name:'고1 독해 B',subject:'영어',status:'운영',ownerUid:'u',students:['k2','k3'],slots:[{id:'2',weekday,start:'18:50',end:'20:10'}]},
];
const render=(uid:string)=>renderToStaticMarkup(<TeacherTodayLessons data={{uid,admin:true,students,classes,drafts:[],schedules:[],reflectedSchedules:[]}} date={day} onDate={()=>{}} request={async()=>({})} onStudent={()=>{}}/>);

test('lessons at the same time and type share one card with every student by name only',()=>{
 const html=render('u1');
 assert.equal((html.match(/today-time-card/g)||[]).length,1,'two classes at 18:50 in one card');
 assert.match(html,/정규 · 4명/);
 for(const name of ['류현수','이현준','김규림','김경현'])assert.ok(html.includes(`>${name}<`),name);
 assert.ok(!html.includes('>류현수 (용죽고1)<'),'school only in the tooltip');
 assert.equal((html.match(/학생을 오늘 이 수업에서 빼기/g)||[]).length,4,'a hide button per student');
 assert.match(html,/수업 전체를 오늘 목록에서 숨기기/);
});
test('a student hidden for today leaves that card; hiding every student removes the card',()=>{
 const lessonId=(cls:string)=>`regular:${cls}:1`.replace(':1',cls==='a'?':1':':2');
 setTodayVisibility('u2',day,[`${lessonId('a')}|k1`]);
 const one=render('u2');assert.ok(!one.includes('>이현준<'));assert.match(one,/정규 · 3명/);
 setTodayVisibility('u3',day,[`${lessonId('a')}|k0`,`${lessonId('a')}|k1`,lessonId('b')]);
 assert.ok(!render('u3').includes('today-time-card'),'nothing left at that time');
});
test('hiding a lesson or a student never moves that saved lesson onto another event of the day',()=>{
 // 류현수 has 영어 at 14:00 (class x) and 16:00 (class y); the 14:00 lesson is published.
 const two=[
  {id:'x',name:'고1 문법',subject:'영어',status:'운영',ownerUid:'u',students:['k0'],slots:[{id:'1',weekday,start:'14:00',end:'15:20'}]},
  {id:'y',name:'고1 독해',subject:'영어',status:'운영',ownerUid:'u',students:['k0'],slots:[{id:'1',weekday,start:'16:00',end:'17:20'}]},
 ];
 const drafts=[{id:'d14',stage:'published',ownerUid:'u',data:{studentKey:'k0',date:day,subject:'영어',start:'14:00',end:'15:20'}}];
 const view=(uid:string)=>renderToStaticMarkup(<TeacherTodayLessons data={{uid,admin:true,students,classes:two,drafts,schedules:[],reflectedSchedules:[]}} date={day} onDate={()=>{}} request={async()=>({})} onStudent={()=>{}}/>);
 const shown=view('u4');
 assert.match(shown,/반영 1 · 저장 0 · 미작성 1/,'both lessons listed: 14:00 done, 16:00 unwritten');
 for(const [uid,hidden] of [['u5','regular:x:1|k0'],['u6','regular:x:1']] as const){
  setTodayVisibility(uid,day,[hidden]);
  const html=view(uid);
  assert.ok(!html.includes('14:00–15:20'),hidden);
  assert.match(html,/반영 0 · 저장 0 · 미작성 1/,`${hidden}: the 16:00 lesson stays unwritten`);
  assert.ok(!html.includes('→ 14:00'),'no moved-time line pointing at the hidden lesson');
 }
});
test('여러 학생 mode: after hiding, each class card badge agrees with the top progress',()=>{
 const two=[
  {id:'x',name:'고1 문법',subject:'영어',status:'운영',ownerUid:'u',students:['k0'],slots:[{id:'1',weekday,start:'14:00',end:'15:20'}]},
  {id:'y',name:'고1 독해',subject:'영어',status:'운영',ownerUid:'u',students:['k0'],slots:[{id:'1',weekday,start:'16:00',end:'17:20'}]},
 ];
 const drafts=[{id:'d14',stage:'published',ownerUid:'u',data:{studentKey:'k0',date:day,subject:'영어',start:'14:00',end:'15:20'}}];
 const view=(uid:string)=>renderToStaticMarkup(<TeacherTodayLessons data={{uid,admin:true,students,classes:two,drafts,schedules:[],reflectedSchedules:[]}} date={day} onDate={()=>{}} request={async()=>({})} onGroup={()=>{}}/>);
 const shown=view('g4');
 assert.match(shown,/반영 1 · 저장 0 · 미작성 1/);
 assert.equal((shown.match(/>반영 1\/1명</g)||[]).length,1,'only the 14:00 card is done');
 assert.equal((shown.match(/>반영 0\/1명</g)||[]).length,1,'the 16:00 card is not');
 for(const [uid,hidden] of [['g5','regular:x:1|k0'],['g6','regular:x:1']] as const){
  setTodayVisibility(uid,day,[hidden]);
  const html=view(uid);
  assert.match(html,/반영 0 · 저장 0 · 미작성 1/,hidden);
  assert.ok(html.includes('반영 0/1명')&&!html.includes('반영 1/1명'),`${hidden}: the 16:00 card stays 0/1`);
 }
});
test('skipping a lesson or a student asks in the same centered confirm as other actions (no wide dialog)',()=>{
 const src=fs.readFileSync(new URL('../src/components/teacher/TeacherTodayLessons.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(src,/WorkspaceDialog/);assert.match(src,/askConfirm\(studentKey\?\{title:`\$\{who\} 학생이 오늘 이 수업에 빠지나요\?`/);
 assert.match(src,/onClick=\{\(\)=>void askExclude\(\{events:\[event\],studentKey:key\}\)\}/);assert.match(src,/onClick=\{\(\)=>void askExclude\(\{events:group\}\)\}/);
});
