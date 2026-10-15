import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { maskName, isMaskedName } from '../src/lib/maskName.ts';
import { planLeaderboardMasking } from '../scripts/mask-leaderboard-names.ts';

const rules = fs.readFileSync('firestore.rules', 'utf8').replace(/\r\n/g, '\n');
const block = (name: string) => { const at = rules.indexOf(`match /${name}/`); assert.ok(at >= 0, name); return rules.slice(at, rules.indexOf('\n    }', at)); };

test('server-only collections are closed to every client, teachers included', () => {
  for (const name of ['students', 'consultations', 'petSystems', 'lessonReports', 'studentSchedules', 'reportSlugs', 'studentReportMappings', 'reportAliases'])
    assert.doesNotMatch(block(name), /allow (read|write|read, write): if (?!false)/, name);
});
test('students only touch their own records', () => {
  assert.match(block('wordProgress'), /progressId\.matches\('\^' \+ request\.auth\.uid \+ '_\.\+'\)/);
  assert.match(block('wordProgress'), /allow delete: if isAdmin\(\);/);
  assert.match(block('assignments'), /affectedKeys\(\)\.hasOnly\(\['isNew', 'isDone'\]\)/);
  assert.match(block('evaluations'), /allow read: if isOwner\(uid\) \|\| isAdmin\(\);\n\s+allow write: if false;/);
  assert.match(block('matchLeaderboard'), /keys\(\)\.hasOnly\(\['wordbookId', 'uid', 'name', 'time', 'createdAt'\]\)/);
});
test('leaderboard names are masked', () => {
  assert.equal(maskName('김지원'), '김*원');
  assert.equal(maskName('이현'), '이*');
  assert.equal(maskName('남궁민수'), '남**수');
  assert.equal(maskName('Christopher'), 'C***r');
  assert.equal(maskName(''), '익명');
  assert.equal(maskName(undefined), '익명');
  assert.equal(maskName('김'), '*');
  for (const n of ['김지원', '이현', '남궁민수', 'Christopher', '', '김']) assert.ok(isMaskedName(maskName(n)), 'what the app stores passes the rule');
  for (const n of ['김지원', 'Kim', '김**원**', '***'.repeat(2)]) assert.equal(isMaskedName(n), false, n);
  assert.match(block('matchLeaderboard'), /name == '익명' \|\| request\.resource\.data\.name\.matches\('\^\[\^\*\]\?\[\*\]\{1,3\}\[\^\*\]\?\$'\)/);
});
test('old leaderboard names: only unmasked ones change, to the masked form', () => {
  const plan = planLeaderboardMasking([{id: 'a', name: '김지원'}, {id: 'b', name: '김*원'}, {id: 'c', name: '익명'}, {id: 'd', name: undefined}]);
  assert.deepEqual({total: plan.total, alreadyMasked: plan.alreadyMasked}, {total: 4, alreadyMasked: 2});
  assert.deepEqual(plan.changes, [{id: 'a', name: '김*원'}, {id: 'd', name: '익명'}]);
});
test('study records: the student and the admin read them; principals and teachers go through the server (own academy only)', () => {
  for (const name of ['wordProgress', 'studySessions', 'attendance', 'assignments']) assert.doesNotMatch(block(name), /isTeacher\(\)/, name);
  assert.doesNotMatch(block('users'), /isPrincipalUser\(\)/);
  assert.match(block('attendance'), /attendanceId\.matches\("\^" \+ request\.auth\.uid \+ "_\.\*"\)/);
  assert.match(block('assignments'), /allow create: if isAdmin\(\);/);
});
