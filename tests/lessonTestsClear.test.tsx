import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import LessonTests from '../src/components/teacher/LessonTests';
import {attendanceOptions} from '../src/lib/lessonOptions';

test('both score boxes have a clear button, dimmed while the box is empty',()=>{
 const html=renderToStaticMarkup(<LessonTests value={{correct:18,total:20,wrong:2,examCorrect:null,examTotal:null,examWrong:null}} onChange={()=>{}}/>);
 assert.match(html,/aria-label="테스트 점수 지우기"/);assert.match(html,/aria-label="내신 대비 점수 지우기"/);
 assert.match(html,/disabled=""[^>]*aria-label="내신 대비 점수 지우기"/);assert.doesNotMatch(html,/disabled=""[^>]*aria-label="테스트 점수 지우기"/);
});
test('attendance reads 출석, 지각, 결석, then the same order for 보강',()=>{
 assert.deepEqual([...attendanceOptions],['미확인','출석','지각','결석','보강 출석','보강 지각','보강 결석']);
});
