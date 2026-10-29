import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {reportCategory} from '../src/lib/lessonReportText.ts';

test('리포트 수업/테스트: only 자습 time (no 수업 time) is a 테스트, also for reports published as 수업 before', () => {
  assert.equal(reportCategory({category: '수업', lessonTime: '18:50 ~ 20:10', selfStudyTime: ''}), '수업');
  assert.equal(reportCategory({category: '수업', lessonTime: '', selfStudyTime: '15:40 ~ 16:40'}), '테스트');
  assert.equal(reportCategory({category: '테스트'}), '테스트');
  assert.equal(reportCategory({category: '수업', lessonTime: '', selfStudyTime: ''}), '수업', 'no time at all (결석 등): as it was');
});

test('a lesson published with no 수업 (자습만) is saved as 테스트', async () => {
  const src = await fs.readFile('api/_lib/teacherDirectReport.ts', 'utf8');
  assert.match(src, /category:d\.classSession==='있음'\?'수업':'테스트'/);
});
