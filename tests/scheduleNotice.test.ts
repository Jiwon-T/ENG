import test from 'node:test';
import assert from 'node:assert/strict';
import {publishLabel, publishedNotice, savedNotice, scheduleAudience} from '../src/lib/scheduleNotice.ts';

test('일정 반영 알림: with students it goes to their 학생·학부모 일정 (반영, how many); without, 확정 and nothing goes out', () => {
  assert.deepEqual([scheduleAudience(['a', 'b', 'a']), scheduleAudience([]), scheduleAudience(undefined)], [2, 0, 0]);
  assert.deepEqual([publishLabel(2), publishLabel(0)], ['반영', '확정']);
  assert.equal(publishedNotice(2), '학생 2명의 학생·학부모 일정에 반영했어요');
  assert.match(publishedNotice(0), /확정했어요 · 대상 학생이 없어 학생·학부모 화면에는 보이지 않아요/);
  assert.match(savedNotice(1), /반영하면 학생·학부모 리포트에 표시/);
  assert.match(savedNotice(0), /확정해도 학생·학부모 화면에는 보이지 않아요/);
});
