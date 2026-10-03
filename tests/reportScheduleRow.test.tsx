import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReportScheduleRow from '../src/components/teacher/ReportScheduleRow';

test('teacher report schedule renders formatter fields as text instead of a React object child',()=>{
 const html=renderToStaticMarkup(<ReportScheduleRow schedule={{title:'영어 보강',status:'예정',startAt:'2026-10-03T14:00:00+09:00',endAt:'2026-10-03T15:30:00+09:00',notice:'교재 준비'}}/>);
 assert.ok(html.includes('2026년 10월 3일'));
 assert.ok(html.includes('오후 2:00 ~ 오후 3:30'));
 assert.ok(html.includes('교재 준비'));
 assert.equal(html.includes('[object Object]'),false);
});
test('missing schedule dates render a useful fallback without crashing the report',()=>{
 const html=renderToStaticMarkup(<ReportScheduleRow schedule={{title:'시간 확인 필요',status:'예정',startAt:null,endAt:null}}/>);
 assert.ok(html.includes('일정 날짜 확인 중'));
});
