import React from 'react';import test from 'node:test';import assert from 'node:assert/strict';import {renderToStaticMarkup} from 'react-dom/server';
import {todayLessonState,todayLessonProgress} from '../src/lib/todayLessonProgress';import TeacherTodayLessons from '../src/components/teacher/TeacherTodayLessons';
const event={id:'e',title:'개인 보강',kind:'보강',date:'2026-10-07',subject:'영어',start:'17:00',end:'18:00',students:['a','b','c']};
const record=(studentKey:string,stage:string)=>({id:studentKey,stage,data:{studentKey,date:event.date,subject:event.subject,start:event.start}});
test('progress matches exact day student subject start and excludes deleted or unsaved records',()=>{
 const rows=[record('a','published'),record('b','draft'),{...record('c','published'),archived:true},{...record('c','draft'),data:{...record('c','draft').data,start:'18:00'}},record('c','new')];
 assert.deepEqual(todayLessonProgress([event],rows),{total:3,published:1,saved:1,empty:1});assert.equal(todayLessonState(event,'c',rows),'미작성');
 assert.equal(todayLessonState(event,'a',[{...record('a','published'),updatedAt:1},{...record('a','draft'),updatedAt:2}]),'저장됨');
});
test('today cards display loaded-record progress and explicit group denominator without another request',()=>{
 let calls=0;const props={data:{uid:'t',admin:true,classes:[],students:event.students.map(studentKey=>({studentKey,studentDisplayName:studentKey})),drafts:[record('a','published'),record('b','draft')],schedules:[{id:'e',data:{...event,status:'예정'}}]},date:event.date,onDate:()=>{},request:async()=>{calls++;return {};}};
 const single=renderToStaticMarkup(<TeacherTodayLessons {...props} onStudent={()=>{}}/>);assert.ok(single.includes('반영 1 · 저장 1 · 미작성 1'));assert.ok(single.includes('반영 완료'));assert.ok(single.includes('현재 불러온 기록 기준'));assert.equal(calls,0);
 const group=renderToStaticMarkup(<TeacherTodayLessons {...props} onGroup={()=>{}}/>);assert.ok(group.includes('반영 1/3명'));assert.ok(group.includes('학생 3명 불러오기'));assert.equal(calls,0);
});
