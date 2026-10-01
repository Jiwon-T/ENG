import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleStudentSchedules } from '../src/lib/studentReportLists.ts';
import type { StudentScheduleDTO } from '../src/types/lessonReport.ts';
const now = Date.parse('2026-10-15T00:00:00Z');
const item = (id: string, status: StudentScheduleDTO['status'], startAt: string, completedAt?: string): StudentScheduleDTO => ({
  scheduleId: id, status, startAt, completedAt, title: id, endAt: null, scheduleType: '수업', notice: null,
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
