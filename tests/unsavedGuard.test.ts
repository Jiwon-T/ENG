import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnsavedGuard } from '../src/lib/unsavedGuard.js';
import { createStudentDialogNavigation } from '../src/lib/studentDialogNavigation.js';

test('unsaved evaluation: cancel keeps the input and the place; confirm moves; only the input clears its state', () => {
 const asked: string[] = [], changes: boolean[] = []; let answer = false, moved = 0;
 const guard = createUnsavedGuard(m => { asked.push(m); return answer; }, '저장하지 않은 평가', d => changes.push(d));
 assert.equal(guard.proceed(() => moved++), true, 'nothing unsaved: moves without asking'); assert.deepEqual([moved, asked.length], [1, 0]);
 guard.mark(true);
 assert.equal(guard.proceed(() => moved++), false); assert.deepEqual([moved, asked.length, guard.dirty], [1, 1, true], 'cancel: no move, still unsaved');
 answer = true;
 // A confirmed move that changes nothing (the box stays on screen) keeps the protection.
 assert.equal(guard.proceed(() => {}), true); assert.equal(guard.dirty, true);
 answer = false;
 assert.equal(guard.proceed(() => moved++), false, 'the next real move still asks'); assert.equal(moved, 1);
 // The box going away (or being saved) is what clears it.
 answer = true; assert.equal(guard.proceed(() => { moved++; guard.mark(false); }), true); assert.deepEqual([moved, guard.dirty], [2, false]);
 assert.deepEqual(changes, [true, false], 'the screen is told when the state changes');
});

test('the student dialog guard (tabs, student switch, close) goes through the same question', () => {
 let answer = false, closed = 0, moved = '';
 const guard = createUnsavedGuard(() => answer, '저장하지 않은 평가');
 const navigation = createStudentDialogNavigation(() => closed++);
 // The report tab registers its close check like TeacherWorkspace does: ask, then leave(); leaving unmounts the box.
 navigation.registerClose(() => { guard.proceed(() => { navigation.leave(); guard.mark(false); }); });
 guard.mark(true);
 navigation.attempt(() => { moved = 'lesson-tab'; });
 assert.equal(moved, '', 'cancel keeps the report tab and the input');
 navigation.attempt(() => { moved = 'other-student'; });
 assert.equal(moved, '');
 answer = true;
 navigation.attempt(() => { moved = 'other-student'; });
 assert.equal(moved, 'other-student'); assert.equal(guard.dirty, false);
 answer = false;
 navigation.attempt(() => { moved = 'lesson-tab'; });
 assert.equal(moved, 'lesson-tab', 'nothing unsaved any more: moves right away'); assert.equal(closed, 0);
});
