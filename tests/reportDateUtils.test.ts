import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  formatReportDetailDate,
  formatReportListDate,
  formatAssignedTime,
  sortReportsByDate,
  groupReportsByMonth,
} from '../src/lib/reportDateUtils.ts';
import {
  getDisplayStatus,
  getStatusBadgeClass,
  getAttendanceBadgeClass,
} from '../src/components/parent/ParentReportView.tsx';

describe('Parent Report Date, Time, and Formatting Unit Tests', () => {
  const sampleStart = '2026-09-29T18:00:00+09:00';
  const sampleEnd = '2026-09-29T19:30:00+09:00';

  it('1. formatReportDetailDate outputs full Korean date with day of week in Asia/Seoul', () => {
    const formatted = formatReportDetailDate(sampleStart);
    assert.equal(formatted, '2026년 9월 29일 (화)');
    // Raw ISO characters must NOT appear
    assert.ok(!formatted.includes('T'));
    assert.ok(!formatted.includes('+09:00'));
    assert.ok(!formatted.includes('KST'));
  });

  it('2. formatReportListDate outputs short Korean date with day of week for list cards', () => {
    const formatted = formatReportListDate(sampleStart);
    assert.equal(formatted, '9월 29일 (화)');
    assert.ok(!formatted.includes('T'));
    assert.ok(!formatted.includes('+09:00'));
  });

  it('3. formatAssignedTime combines lessonDateStart and lessonDateEnd into Korean period time', () => {
    const formatted = formatAssignedTime(sampleStart, sampleEnd);
    assert.equal(formatted, '오후 6:00 ~ 오후 7:30');
    assert.ok(!formatted.includes('T'));
    assert.ok(!formatted.includes(':00:00'));
  });

  it('4. formatAssignedTime handles missing lessonDateEnd gracefully by showing start time only', () => {
    const formatted = formatAssignedTime(sampleStart, null);
    assert.equal(formatted, '오후 6:00');
  });

  it('5. formatReportDetailDate handles invalid date without throwing or leaking raw ISO', () => {
    const invalidInput = 'not-a-valid-date';
    const formatted = formatReportDetailDate(invalidInput);
    assert.equal(formatted, '수업 날짜 확인 중');
    assert.ok(!formatted.includes('not-a-valid-date'));
  });

  it('6. formatAssignedTime handles null/undefined inputs cleanly', () => {
    const formatted = formatAssignedTime(null, undefined);
    assert.equal(formatted, null);
  });

  it('7. lessonTime is never overwritten by assigned time and maintains its distinct value', () => {
    const actualLessonTime = '오후 6:10 ~ 오후 7:25';
    const assignedTime = formatAssignedTime(sampleStart, sampleEnd);
    assert.equal(assignedTime, '오후 6:00 ~ 오후 7:30');
    assert.notEqual(actualLessonTime, assignedTime);
    assert.equal(actualLessonTime, '오후 6:10 ~ 오후 7:25');
  });

  it('8. Score conditional visibility logic correctly identifies valid numeric scores vs null/undefined', () => {
    const isValidNumberScore = (score: number | null | undefined): boolean => {
      return score !== null && score !== undefined && typeof score === 'number' && !isNaN(score);
    };

    assert.equal(isValidNumberScore(92), true);
    assert.equal(isValidNumberScore(0), true, '0 is a valid score and must be displayed as 0점');
    assert.equal(isValidNumberScore(null), false, 'null score must be hidden');
    assert.equal(isValidNumberScore(undefined), false, 'undefined score must be hidden');
    assert.equal(isValidNumberScore(NaN), false, 'NaN must be hidden');
  });

  it('9. getDisplayStatus strictly returns Notion raw text without alteration, and only defaults to 미확인 when empty', () => {
    // Empty / null cases -> '미확인'
    assert.equal(getDisplayStatus(''), '미확인');
    assert.equal(getDisplayStatus(null), '미확인');
    assert.equal(getDisplayStatus(undefined), '미확인');
    assert.equal(getDisplayStatus('   '), '미확인');

    // All exact Notion statuses must be preserved without reinterpretation or word changes
    assert.equal(getDisplayStatus('출석'), '출석');
    assert.equal(getDisplayStatus('지각'), '지각');
    assert.equal(getDisplayStatus('결석'), '결석');
    assert.equal(getDisplayStatus('미확인'), '미확인');
    assert.equal(getDisplayStatus('미제출'), '미제출');
    assert.equal(getDisplayStatus('없는 날'), '없는 날');
    assert.equal(getDisplayStatus('최하'), '최하');
    assert.equal(getDisplayStatus('하'), '하');
    assert.equal(getDisplayStatus('중하'), '중하');
    assert.equal(getDisplayStatus('중'), '중');
    assert.equal(getDisplayStatus('중상'), '중상');
    assert.equal(getDisplayStatus('상'), '상');
    assert.equal(getDisplayStatus('최상'), '최상');
    // Unknown future status string preserved as is
    assert.equal(getDisplayStatus('보충 예정'), '보충 예정');
  });

  it('10. Status badge classes assign distinct readable colors without altering status text', () => {
    assert.ok(getStatusBadgeClass('최상').includes('emerald'));
    assert.ok(getStatusBadgeClass('상').includes('teal'));
    assert.ok(getStatusBadgeClass('중상').includes('sky'));
    assert.ok(getStatusBadgeClass('중').includes('yellow'));
    assert.ok(getStatusBadgeClass('중하').includes('amber'));
    assert.ok(getStatusBadgeClass('하').includes('rose-50'));
    assert.ok(getStatusBadgeClass('최하').includes('rose-100'));
    assert.ok(getStatusBadgeClass('미제출').includes('rose'));
    assert.ok(getStatusBadgeClass('없는 날').includes('slate'));
    assert.ok(getStatusBadgeClass('미확인').includes('slate'));

    assert.ok(getAttendanceBadgeClass('출석').includes('emerald'));
    assert.ok(getAttendanceBadgeClass('없는 날').includes('slate'));
    assert.ok(getAttendanceBadgeClass('미확인').includes('slate'));
  });

  it('11. ParentReportView source code inspection: verify no session advice texts and exact required UI labels', () => {
    const content = fs.readFileSync('src/components/parent/ParentReportView.tsx', 'utf8');

    // Labels check
    assert.ok(content.includes('수업 날짜'));
    assert.ok(content.includes('배정 시간'));
    assert.ok(content.includes('수업 시간'));
    assert.ok(!content.includes('실제 수업 시간'), '"실제 수업 시간" label must NOT appear');
    assert.ok(content.includes('수업 내용 및 피드백'));
    assert.ok(content.includes('자습 시간'));
    assert.ok(content.includes('열람 권한 인증 완료'));

    // Check complete removal of session advice texts
    assert.ok(!content.includes('이 기기에서 인증 유지 중'), 'Must not contain session advice');
    assert.ok(!content.includes('안심 세션이 유지되는 동안'), 'Must not contain session advice');
    assert.ok(!content.includes('인증 상태가 유지되고 있습니다'), 'Must not contain session advice');
    assert.ok(!content.includes('이 브라우저에서 계속 열람할 수 있습니다'), 'Must not contain session advice');

    // Check no fallback to "출석", "완료", "확인"
    assert.ok(!content.includes("rep.attendance || '출석'"));
    assert.ok(!content.includes("selectedReport.attendance || '출석'"));
    assert.ok(!content.includes("selectedReport.homework || '완료'"));
    assert.ok(!content.includes("selectedReport.attitude || '확인'"));

    // Check test field is rendered in the evaluation section
    assert.ok(content.includes('selectedReport.test'));
    assert.ok(content.includes('getStatusBadgeClass('));

    // Check accessibility & overflow
    assert.ok(content.includes('break-words'));
    assert.ok(content.includes('min-h-[44px]'));

    // Mobile two-step list-detail state and back button
    assert.ok(content.includes('mobileView'));
    assert.ok(content.includes('수업 회차 목록'));
    assert.ok(content.includes('이전 수업'));
  });

  it('12. sortReportsByDate correctly sorts reports descending by lessonDateStart with exact time resolution', () => {
    const sampleList = [
      { id: '1', lessonDateStart: '2026-09-15T18:00:00+09:00' },
      { id: '2', lessonDateStart: '2026-09-29T18:00:00+09:00' },
      { id: '3', lessonDateStart: '2026-09-29T20:00:00+09:00' }, // same date, later time
      { id: '4', lessonDateStart: '2026-08-20T14:00:00+09:00' },
    ];

    const sorted = sortReportsByDate(sampleList);

    // Latest must be at index 0 (2026-09-29 20:00)
    assert.equal(sorted[0].id, '3');
    assert.equal(sorted[1].id, '2');
    assert.equal(sorted[2].id, '1');
    assert.equal(sorted[3].id, '4');

    // Original array must not be mutated
    assert.equal(sampleList[0].id, '1');
  });

  it('13. groupReportsByMonth groups items by Asia/Seoul year-month cleanly', () => {
    const sampleList = [
      { id: '1', lessonDateStart: '2026-09-29T18:00:00+09:00' },
      { id: '2', lessonDateStart: '2026-09-15T18:00:00+09:00' },
      { id: '3', lessonDateStart: '2026-08-20T14:00:00+09:00' },
    ];

    const groups = groupReportsByMonth(sampleList);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].groupLabel, '2026년 9월');
    assert.equal(groups[0].reports.length, 2);
    assert.equal(groups[1].groupLabel, '2026년 8월');
    assert.equal(groups[1].reports.length, 1);
  });
});
