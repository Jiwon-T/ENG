import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyBoardEvents} from '../src/lib/teacherWeekCalendar';

test('weekly calendar: app-only records without a Notion id (null), a missing time or slots do not crash the 시간표·일정 page', () => {
  const day = '2026-10-14';
  const schedules = [{id: 's1', notionPageId: null, stage: 'published', data: {date: day, title: '보강', start: null, end: null}}];
  const reflected = [{id: 'r1', notionPageId: null, date: day, title: '시험', start: '15:00'}, {id: 'r2', notionPageId: 'ab-cd', date: day, title: '반영', start: '14:00'}];
  const classes = [{id: 'c1', name: '정규', slots: null}, {id: 'c2', name: '중2', slots: [{weekday: 3, start: '16:00', end: '17:20'}]}];
  const week = weeklyBoardEvents(day, schedules, classes, reflected);
  const today = week.find(d => d.day === day)!;
  assert.deepEqual(today.events.map((e: any) => e.id), ['s1', 'r2', 'r1', 'regular-c2-0'], 'all shown, sorted by start (missing time first)');
});

test('weekly calendar: a reflected copy of an app schedule with the same Notion id is still shown only once', () => {
  const day = '2026-10-14';
  const week = weeklyBoardEvents(day, [{id: 's1', notionPageId: 'aa-bb', data: {date: day, title: 'A', start: '10:00'}}], [], [{id: 'r1', notionPageId: 'aabb', date: day, title: 'A', start: '10:00'}]);
  assert.deepEqual(week.find(d => d.day === day)!.events.map((e: any) => e.id), ['s1']);
});
