import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScheduleDocId, scheduleSourceKey } from '../api/_lib/scheduleProjection.js';

// App schedules keep publishing under the IDs the old projection created, so existing student report links stay valid.
test('schedule report IDs are deterministic per source and student and ignore ID spelling', () => {
    const source = '11111111-1111-4111-8111-111111111111', compact = source.replace(/-/g, '');
    assert.equal(generateScheduleDocId(source, 'student-a'), generateScheduleDocId(compact, 'student-a'));
    assert.notEqual(generateScheduleDocId(source, 'student-a'), generateScheduleDocId(source, 'student-b'));
    assert.equal(generateScheduleDocId(source, 'student-a').length, 32);
    assert.equal(scheduleSourceKey(source), scheduleSourceKey(compact));
    assert.match(scheduleSourceKey(source), /^[a-f0-9]{64}$/);
});
