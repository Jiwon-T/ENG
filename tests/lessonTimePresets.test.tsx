import React from 'react';import test from 'node:test';import assert from 'node:assert/strict';import {renderToStaticMarkup} from 'react-dom/server';
import {timeAfterMinutes,lessonDurationMinutes,regularLessonTime} from '../src/lib/lessonTimePresets';import LessonAcademyFields from '../src/components/teacher/LessonAcademyFields';
test('preset calculations keep HH:mm and refuse midnight or invalid input',()=>{
 assert.deepEqual(lessonDurationMinutes,[60,80,90,120]);assert.equal(timeAfterMinutes('14:30',80),'15:50');assert.equal(timeAfterMinutes('22:00',119),'23:59');
 for(const [start,duration]of [['23:00',60],['24:00',80],['14:60',60],['',80]] as const)assert.equal(timeAfterMinutes(start,duration),null);
});
test('regular preset only uses visible permitted classes on today, not past lesson dates',()=>{
 const data={uid:'t',admin:false,scopes:[{studentKey:'a',subject:'영어'}],classes:[{id:'c',ownerUid:'t',subject:'영어',students:['a'],slots:[{weekday:3,start:'14:00',end:'15:20'}]}]};
 assert.equal(regularLessonTime(data,'a','영어','2026-10-07','2026-10-07')?.start,'14:00');assert.equal(regularLessonTime(data,'foreign','영어','2026-10-07','2026-10-07'),undefined);assert.equal(regularLessonTime(data,'a','영어','2026-10-07','2026-10-08'),undefined);
});
test('class and study reuse preset groups, retain required native inputs and show manual inputs without a disclosure',()=>{
 const html=renderToStaticMarkup(<LessonAcademyFields value={{classSession:'있음',selfStudy:'있음',start:'14:00',end:'15:20',selfStudyStart:'15:20',selfStudyEnd:'16:40',round:1,selfStudyRound:2}} regularTime={{start:'14:00',end:'15:20'}} onChange={()=>{}}/>);
 assert.ok(html.includes('오늘 정규 14:00–15:20'));assert.ok(!html.includes('<details'));assert.ok(!html.includes('<summary'));assert.equal((html.match(/class="lesson-time-direct-inputs"/g)||[]).length,2);assert.equal((html.match(/aria-pressed="true"/g)||[]).length,2);assert.ok(html.includes('aria-label="자습 시작"'));assert.ok(html.includes('value="15:20"'));assert.ok(html.includes('type="time"'));
});

