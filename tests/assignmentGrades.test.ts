import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentGrades, lessonReportId } from '../api/_lib/reportAudienceDTO.js';

const r = (id: string, date: string, extra: any = {}) => ({ reportIdentity: id, notionPageId: id, lessonDateStart: date + 'T07:00:00.000Z', subject: '영어', homework: '', derivedAssignment: '', ...extra }) as any;

test('선생님이 확인한 과제: a 과제 is checked by the next lesson of its subject that decided the 숙제 평가', () => {
  const reports = [
    r('a', '2026-10-16', { derivedAssignment: '문법 워크북' }),
    r('b', '2026-10-20', { derivedAssignment: '단어 Day 30~31', homework: '미제출' }),
    r('m', '2026-10-21', { subject: '수학', homework: '상' }),
    r('c', '2026-10-23', { derivedAssignment: 'p.12~14', homework: '상' }),
    r('d', '2026-10-24', { derivedAssignment: '오답 정리', homework: '미확인' }),
  ];
  const g = assignmentGrades(reports);
  assert.deepEqual(g.get(lessonReportId(reports[0])), { grade: '미제출', date: '2026-10-20' }, 'the next 영어 lesson graded it 미제출');
  assert.deepEqual(g.get(lessonReportId(reports[1])), { grade: '상', date: '2026-10-23' }, 'a 수학 lesson does not count');
  assert.equal(g.has(lessonReportId(reports[2])), false, 'no 과제, nothing');
  assert.equal(g.has(lessonReportId(reports[3])), false, '미확인 next: not checked yet');
  assert.equal(g.has(lessonReportId(reports[4])), false, 'the newest: still to do');
  assert.equal(assignmentGrades([r('x', '2026-10-01', { derivedAssignment: 'p.1' }), r('y', '2026-10-02', { homework: '없는 날' })]).size, 0, '없는 날: not a check');
});

test('선생님이 확인한 과제: one 평가 grades one 과제 — the latest before it; older open ones were passed without a grade', () => {
  const reports = [
    r('a', '2026-10-16', { derivedAssignment: '문법 워크북' }),
    r('b', '2026-10-20', { derivedAssignment: '단어 Day 30~31', homework: '미확인' }),
    r('c', '2026-10-23', { derivedAssignment: 'p.12~14', homework: '상' }),
  ];
  const g = assignmentGrades(reports);
  assert.deepEqual(g.get(lessonReportId(reports[1])), { grade: '상', date: '2026-10-23' }, 'the 10/23 평가 is for the 10/20 과제');
  assert.deepEqual(g.get(lessonReportId(reports[0])), { grade: null, date: '2026-10-23' }, 'the 10/16 과제: passed, not given the same 평가');
  assert.equal(g.has(lessonReportId(reports[2])), false);
  const same = assignmentGrades([r('x', '2026-10-01', { derivedAssignment: 'p.1' }), r('y', '2026-10-01', { homework: '상', derivedAssignment: 'p.2' })]);
  assert.equal(same.size, 0, 'a lesson on the same day does not grade it');
});

test('선생님이 확인한 과제: a 과제 written again word for word (carried to the 누적 테스트 day) is one 과제, listed at the later 일지', () => {
  const reports = [
    r('a', '2026-10-20', { derivedAssignment: '어법 프린트  3장', homework: '상' }),
    r('t', '2026-10-22', { derivedAssignment: '어법 프린트 3장', homework: '없는 날' }),
    r('b', '2026-10-23', { derivedAssignment: '독해 2지문', homework: '상' }),
  ];
  const g = assignmentGrades(reports);
  assert.deepEqual(g.get(lessonReportId(reports[0])), { grade: null, date: '2026-10-22', carried: true }, 'the earlier copy goes on in the test-day 일지');
  assert.deepEqual(g.get(lessonReportId(reports[1])), { grade: '상', date: '2026-10-23' }, 'the 10/23 평가 grades it once');
  assert.equal(g.has(lessonReportId(reports[2])), false);
  const other = assignmentGrades([r('x', '2026-10-01', { derivedAssignment: 'p.1' }), r('y', '2026-10-02', { derivedAssignment: 'p.2', homework: '없는 날' }), r('z', '2026-10-03', { homework: '중' })]);
  assert.deepEqual([other.get(lessonReportId(r('x', '2026-10-01')))?.grade, other.get(lessonReportId(r('y', '2026-10-02')))?.grade], [null, '중'], 'a different 과제 written: each its own (the older passed)');
});
