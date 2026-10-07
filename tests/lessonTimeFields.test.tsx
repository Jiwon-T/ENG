import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LessonAcademyFields from '../src/components/teacher/LessonAcademyFields';

test('class and study each render start/end and decimal round inputs in the same row', () => {
 const html = renderToStaticMarkup(<LessonAcademyFields value={{classSession:'있음',start:'14:00',end:'15:30',round:1.7,selfStudy:'있음',selfStudyStart:'15:30',selfStudyEnd:'16:30',selfStudyRound:1}} onChange={() => {}}/>);
 const rows = html.split('class="lesson-time-row"').slice(1);
 assert.equal(rows.length, 2);
 for (const [row, prefix] of rows.map((row, index) => [row, index ? '자습' : '수업'])) {
   assert.ok(row.includes(`aria-label="${prefix} 시작"`));
   assert.ok(row.includes(`aria-label="${prefix} 종료"`));
   assert.ok(row.includes(`aria-label="${prefix} 회차"`));
   assert.ok(row.includes('step="any"'));
 }
 assert.ok(html.includes('value="1.7"'));
 assert.equal(html.includes('<textarea'), false);
});

test('self-study-only records disable only the absent class inputs', () => {
 const html = renderToStaticMarkup(<LessonAcademyFields value={{classSession:'없음',start:'',end:'',round:null,selfStudy:'있음',selfStudyStart:'15:30',selfStudyEnd:'16:30',selfStudyRound:1}} onChange={() => {}}/>);
 const rows = html.split('class="lesson-time-row"').slice(1);
 assert.equal((rows[0].match(/<input[^>]*disabled=""/g) || []).length, 3);
 assert.equal((rows[1].match(/disabled=""/g) || []).length, 0);
});
