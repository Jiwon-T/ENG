import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleStudentSchedules, sortParentSchedules } from '../src/lib/studentReportLists.ts';
import type { StudentScheduleDTO } from '../src/types/lessonReport.ts';
const now = Date.parse('2026-10-15T00:00:00Z');
const item = (id: string, status: StudentScheduleDTO['status'], startAt: string, completedAt?: string): StudentScheduleDTO => ({
  scheduleId: id, status, startAt, completedAt, title: id, endAt: null, scheduleType: '수업', notice: null,
});
test('parent schedules put pending first and sort every group by distance from the Korean date', () => {
  const rows = [item('sep20', '완료', '2026-09-20'), item('sep22', '완료', '2026-09-22'),
    item('sep27', '완료', '2026-09-27'), item('oct5', '예정', '2026-10-05'),
    item('today', '예정', '2026-10-01'), item('far', '예정', '2026-10-20')];
  assert.deepEqual(sortParentSchedules(rows, Date.parse('2026-10-01T09:53:00Z')).map(s => s.scheduleId),
    ['today', 'oct5', 'far', 'sep27', 'sep22', 'sep20']);
  assert.equal(rows[0].scheduleId, 'sep20');
});
test('parent sorting handles Korean midnight, overdue pending, equal distance and invalid dates', () => {
  const rows = [item('past', '예정', '2026-09-30'), item('future', '예정', '2026-10-02'),
    item('today', '예정', '2026-09-30T15:01:00Z'), item('invalid', '예정', 'bad'),
    item('far', '예정', '2026-10-10')];
  assert.deepEqual(sortParentSchedules(rows, Date.parse('2026-09-30T15:05:00Z')).map(s => s.scheduleId),
    ['today', 'future', 'past', 'far', 'invalid']);
});
test('hides completed schedules at exactly two weeks but retains recently completed and cancelled schedules', () => {
  const rows = [
    item('old', '완료', '2026-09-01', '2026-10-01T00:00:00Z'),
    item('recent', '완료', '2026-09-01', '2026-10-01T00:00:01Z'),
    item('cancelled', '취소', '2026-09-01'),
  ];
  assert.deepEqual(visibleStudentSchedules(rows, now).map(s => s.scheduleId).sort(), ['cancelled', 'recent']);
});
test('prioritizes upcoming pending schedules by closest start and leaves input order intact', () => {
  const rows = [item('far', '예정', '2026-10-20'), item('done', '완료', '2026-10-14', '2026-10-14'),
    item('overdue', '예정', '2026-10-10'), item('near', '예정', '2026-10-16')];
  assert.deepEqual(visibleStudentSchedules(rows, now).map(s => s.scheduleId), ['near', 'far', 'overdue', 'done']);
  assert.equal(rows[0].scheduleId, 'far');
});
test('uses end time when a legacy completed schedule has no completion timestamp', () => {
  const row = { ...item('legacy', '완료', '2026-09-30'), endAt: '2026-10-02' };
  assert.equal(visibleStudentSchedules([row], now).length, 1);
});
