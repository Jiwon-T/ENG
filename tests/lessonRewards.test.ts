import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPetState, lessonRewardParts, pendingStudyRewards, settleLessonReward, settleLessons } from '../api/_lib/pet.ts';
import { readLessonReward, writeLessonReward } from '../api/_lib/lessonRewardOnPublish.ts';

const at = (iso: string) => Date.parse(iso);
const NOW = at('2026-10-22T03:00:00Z'); // 10/22 12:00 in Seoul
const lesson = {attendance: '출석', homework: '상', test: '', testPaper: true, attitude: '최상'};
const fresh = (points = 0) => { const s = initialPetState(NOW); s.points = points; return s; };

test('수업 보상 parts: 출석/지각, 숙제·시험·태도 by grade; below 중 nothing', () => {
  assert.deepEqual(lessonRewardParts(lesson).map(p => [p.label, p.points]), [['출석', 30], ['숙제 상', 30], ['태도 최상', 20]]);
  assert.deepEqual(lessonRewardParts({attendance: '보강 지각', homework: '중하', test: '중상', testPaper: false, attitude: '중'}).map(p => [p.label, p.points]), [['지각', 15], ['시험(앱) 중상', 10], ['태도 중', 5]]);
  assert.deepEqual(lessonRewardParts({attendance: '결석', homework: '미제출', test: '', testPaper: true, attitude: '하'}), []);
});

test('반영 again and again: the last one counts — paid up, taken back, paid up again; XP never twice', () => {
  const s = fresh(100), id = 'r1', day = '2026-10-21T14:00:00+09:00';
  assert.equal(settleLessonReward(s, id, day, lesson, NOW), 80);
  assert.equal(s.points, 180); const xp1 = s.pets[0].xp + s.pets[0].level * 1000;
  assert.deepEqual(s.ledger?.at(-1), {day: '2026-10-21', kind: 'class', label: '출석·숙제 상·태도 최상', points: 80});
  assert.equal(settleLessonReward(s, id, day, lesson, NOW), 0, 'the same 일지 again: nothing');
  assert.equal(settleLessonReward(s, id, day, {...lesson, attitude: '중'}, NOW), -15, '태도 최상 → 중');
  assert.equal(s.points, 165);
  assert.deepEqual(s.ledger?.at(-1), {day: '2026-10-21', kind: 'class', label: '평가 수정', points: -15});
  assert.equal(s.pets[0].xp + s.pets[0].level * 1000, xp1, 'XP is not taken back');
  assert.equal(settleLessonReward(s, id, day, lesson, NOW), 15, 'back to 최상');
  assert.equal(s.points, 180);
  assert.equal(s.pets[0].xp + s.pets[0].level * 1000, xp1, 'and not given twice');
  assert.equal(s.ledger?.find(x => x.label === '평가 수정')?.points, 0, 'the 수정 lines of one day net out');
  assert.deepEqual(s.lessonPaid?.[id], {p: 80, x: 125, d: '2026-10-21'});
});

test('taking back never goes below 0; a deleted 일지 takes its points back', () => {
  const s = fresh(0), day = '2026-10-21T14:00:00+09:00';
  settleLessonReward(s, 'r1', day, lesson, NOW);
  s.points = 10; // spent in the shop
  assert.equal(settleLessonReward(s, 'r1', day, {...lesson, homework: '', attitude: ''}, NOW), -10, 'only what is there');
  assert.equal(s.points, 0);
  assert.equal(s.lessonPaid?.r1.p, 30, 'the lesson now counts as worth 30 (no debt kept)');
  const t = fresh(500);
  settleLessonReward(t, 'r2', day, lesson, NOW);
  assert.equal(settleLessons(t, [], NOW), -80, 'gone from the reports: deleted');
  assert.deepEqual(t.ledger?.at(-1), {day: '2026-10-21', kind: 'class', label: '일지 삭제', points: -80});
});

test('7 days after the lesson it stays; before the switch day the old way; a student linked later still gets it', () => {
  const s = fresh(0), day = '2026-10-21T14:00:00+09:00';
  settleLessonReward(s, 'r1', day, lesson, NOW);
  assert.equal(settleLessonReward(s, 'r1', day, {...lesson, attitude: ''}, at('2026-10-28T03:00:00Z')), 0 - 20, 'day 7: still open');
  assert.equal(settleLessonReward(s, 'r1', day, lesson, at('2026-10-29T03:00:00Z')), null, 'day 8: locked');
  assert.equal(settleLessonReward(s, 'old', '2026-10-20T14:00:00+09:00', lesson, NOW), null, 'before 10/21: not here');
  const later = fresh(0);
  assert.equal(settleLessonReward(later, 'r1', day, lesson, at('2026-11-05T03:00:00Z')), 80, 'never paid: paid within the reward window');
  assert.equal(settleLessonReward(later, 'r9', '2026-10-30T14:00:00+09:00', lesson, NOW), null, 'a lesson in the future: nothing');
  // the old 받기 leaves the new lessons alone
  const pending = pendingStudyRewards(fresh(0), [{id: 'a', date: '2026-10-20T14:00:00+09:00', attendance: '출석', attitude: '최상'}, {id: 'b', date: '2026-10-21T14:00:00+09:00', attendance: '출석', attitude: '최상'}], NOW);
  assert.deepEqual(pending.map(p => p.id), ['a', 'a']);
});

test('반영 transaction: everything waiting for the linked student is settled, a pet account made when there is none; unlinked waits', async () => {
  const writes: [string, any][] = [];
  const db: any = {collection: (c: string) => ({doc: (id: string) => ({path: `${c}/${id}`})})};
  const tx: any = {get: async (ref: any) => ({exists: false, data: () => ref.path === 'users/kid' ? {role: 'student', notionStudentKey: 'k'} : undefined}), set: (ref: any, v: any) => writes.push([ref.path, v])};
  const rows = [
    {id: 'sep05', date: '2026-09-05T14:00:00+09:00', attendance: '출석', homework: '', test: '', testPaper: true, attitude: '상'}, // 놓친 수업 (old way, older than 30 days)
    {id: 'now', date: '2026-10-21T14:00:00+09:00', attendance: '출석', homework: '최상', test: '상', testPaper: true, attitude: '상'}, // the 일지 being published
  ];
  const read = {uid: 'kid', state: null, user: {role: 'student', notionStudentKey: 'k'}, rows} as any;
  assert.equal(writeLessonReward(tx, db, read, NOW), (30 + 15) + (30 + 40 + 30 + 15));
  const pet = writes.find(([p]) => p === 'petStates/kid')?.[1];
  assert.equal(pet.points, 160, 'no pet before: the account is made with the points in it');
  assert.equal(pet.pets[0].chosen, false, 'the first pet is still chosen in the app');
  assert.deepEqual(pet.ledger.map((x: any) => [x.day, x.label, x.points]), [['2026-10-21', '출석·숙제 최상·시험(종이) 상·태도 상', 115], ['2026-10-22', '지난 수업 보상', 45]]);
  writes.length = 0;
  assert.equal(writeLessonReward(tx, db, {...read, state: pet}, NOW), null, 'nothing new: nothing written');
  assert.equal(writes.length, 0);
  assert.equal(await readLessonReward(tx, db, {}, {reportIdentity: 'x'}), null, 'no linked account');
});

test('놓친 수업 보상: lessons from 9/1 never paid come all at once — older than 30 days as one line for this month\'s coupon', async () => {
  const {claimStudyRewards, earnedIn} = await import('../api/_lib/pet.ts');
  const s = fresh(0);
  s.rewarded = {sep10: ['attendance']}; // 출석 for 9/10 was taken before
  const reports = [
    {id: 'aug', date: '2026-08-25T14:00:00+09:00', attendance: '출석', attitude: '최상'},
    {id: 'sep05', date: '2026-09-05T14:00:00+09:00', attendance: '출석', attitude: '상'},
    {id: 'sep10', date: '2026-09-10T14:00:00+09:00', attendance: '출석', attitude: '최상'},
    {id: 'oct01', date: '2026-10-01T14:00:00+09:00', attendance: '지각'},
  ];
  const pending = pendingStudyRewards(s, reports, NOW);
  assert.deepEqual(pending.map(p => [p.id, p.kind, Boolean(p.late)]), [['sep05', 'attendance', true], ['sep05', 'attitude', true], ['sep10', 'attitude', true], ['oct01', 'attendance', false]],
    'not August; not what was taken; 10/1 is inside the 30 days');
  assert.equal(claimStudyRewards(s, pending).points, 30 + 15 + 20 + 15);
  assert.deepEqual(s.ledger?.map(x => [x.day, x.label, x.points]), [['2026-10-01', '지각', 15], ['2026-10-22', '지난 수업 보상', 65]]);
  assert.equal(earnedIn(s, '2026-10'), 80, 'September lessons count for October\'s coupon');
  assert.deepEqual(pendingStudyRewards(s, reports, NOW), [], 'once');
});

test('수업 보상 (from 10/21) never paid — no pet for a long time — is still paid when it can be', () => {
  const s = fresh(0);
  assert.equal(settleLessonReward(s, 'r1', '2026-10-21T14:00:00+09:00', lesson, at('2027-01-10T03:00:00Z')), 80);
});

test('쌓인 포인트 알림: what 반영 paid goes to the inbox, merged by line; a lowered 평가 shows as a minus', async () => {
  const {noteInbox} = await import('../api/_lib/pet.ts');
  const s = fresh(0), day = '2026-10-21T14:00:00+09:00';
  let before = structuredClone(s.ledger || []);
  settleLessonReward(s, 'r1', day, lesson, NOW); noteInbox(s, before);
  assert.deepEqual(s.inbox, [{day: '2026-10-21', label: '출석·숙제 상·태도 최상', points: 80}]);
  before = structuredClone(s.ledger || []);
  settleLessonReward(s, 'r1', day, {...lesson, attitude: '중'}, NOW); noteInbox(s, before);
  assert.deepEqual(s.inbox, [{day: '2026-10-21', label: '출석·숙제 상·태도 최상', points: 80}, {day: '2026-10-21', label: '평가 수정', points: -15}]);
  before = structuredClone(s.ledger || []);
  settleLessonReward(s, 'r1', day, lesson, NOW); noteInbox(s, before);
  assert.deepEqual(s.inbox, [{day: '2026-10-21', label: '출석·숙제 상·태도 최상', points: 80}], 'a 수정 that went back is gone');
});
