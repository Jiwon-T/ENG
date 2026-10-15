import test from 'node:test';
import assert from 'node:assert/strict';
import { examDetailForDate, withDateExam } from '../src/lib/academicExamPeriod.ts';

test('a date picks the latest school exam that has started by then', () => {
  const at = (d: string) => examDetailForDate(d);
  assert.deepEqual(at('2026-10-15'), {detail: '2학기 중간고사', year: 2026});
  assert.deepEqual(at('2026-04-10'), {detail: '1학기 중간고사', year: 2026});
  assert.deepEqual(at('2026-06-01'), {detail: '1학기 중간고사', year: 2026}, 'between exams: the one just finished');
  assert.deepEqual(at('2026-06-10'), {detail: '1학기 기말고사', year: 2026});
  assert.deepEqual(at('2026-08-20'), {detail: '1학기 기말고사', year: 2026});
  assert.deepEqual(at('2026-09-20'), {detail: '2학기 중간고사', year: 2026});
  assert.deepEqual(at('2026-11-10'), {detail: '2학기 중간고사', year: 2026});
  assert.deepEqual(at('2026-11-15'), {detail: '2학기 기말고사', year: 2026});
  assert.deepEqual(at('2026-12-31'), {detail: '2학기 기말고사', year: 2026});
  assert.deepEqual(at('2027-01-05'), {detail: '2학기 기말고사', year: 2026}, 'January: last year\'s final');
  assert.deepEqual(at('2027-04-09'), {detail: '2학기 기말고사', year: 2026});
  assert.equal(at(''), null);
  assert.equal(at('2026-1-5'), null);
});
test('only school exams follow the date', () => {
  const school = withDateExam({examType: '학교 내신', examDate: '2026-10-15', examDetail: '', semester: null, examPeriod: null});
  assert.equal(school.examDetail, '2학기 중간고사'); assert.equal(school.semester, 2); assert.equal(school.examPeriod, '중간고사'); assert.equal(school.examYear, 2026);
  const mock = {examType: '학력평가', examDate: '2026-10-15', examDetail: '9월', examYear: 2026};
  assert.deepEqual(withDateExam(mock), mock);
  // January: school exam → last year's final (2025); switching to 학력평가 takes the date's own year again.
  const jan = withDateExam({examType: '학교 내신', examDate: '2026-01-20', examDetail: '', semester: null, examPeriod: null});
  assert.equal(jan.examYear, 2025);
  assert.equal(withDateExam({...jan, examType: '학력평가', examDetail: ''}).examYear, 2026);
});
