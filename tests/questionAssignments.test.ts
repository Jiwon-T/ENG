import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { hashStudentKey } from '../api/_lib/security.ts';
import { passageActor, resetWordIndex } from '../api/_lib/passage.ts';
import { makeQuestionSet } from '../api/_lib/questionSets.ts';
import { assignQuestionSet, cancelQuestionAssignment, myQuestionAssignments, questionTargets } from '../api/_lib/questionAssignments.ts';
import { QUESTION_REWARD, myAssignedSets, openAttempt, questionReward, saveAttempt, submitAttempt } from '../api/_lib/questionAttempts.ts';
import { PET_DAILY_STUDY_POINTS } from '../src/lib/petCatalog.ts';
import { loadStudentQuestionAttempts } from '../api/_lib/teacherQuestionAttempts.ts';
import { initialPetState } from '../api/_lib/pet.ts';

const NOW = Date.parse('2026-10-18T10:00:00Z');
const TEXT = 'Many people believe that talent is something we are born with. However, research shows that practice matters more than we think. For example, musicians who practiced for ten thousand hours performed best. This suggests that effort can shape ability. Of course, natural gifts still play a role. But without steady work, those gifts rarely grow. Therefore, we should value the process of learning. In the end, persistence is what turns potential into skill.';
const seeded = (seed = 3) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const K1 = '11111111-1111-4111-8111-111111111111', K2 = '22222222-2222-4222-8222-222222222222', K3 = '33333333-3333-4333-8333-333333333333', KX = '44444444-4444-4444-8444-444444444444';
const CLASS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function setup() {
  const f = registrationFirestore();
  f.rows.set('users/teacher', { name: '이지원', role: 'teacher' }); f.rows.set('teacherWorkspaceAccess/teacher', { academyId: 'main' });
  const student = (key: string, uid: string | null, name: string) => {
    f.rows.set(`notionStudentMappings/${hashStudentKey(key)}`, { studentKey: key, notionStudentPageId: key, internalStudentId: `int-${name}`, studentDisplayName: name, sourceMode: 'firestore', firebaseUid: uid });
    if (uid) f.rows.set(`users/${uid}`, { name, role: 'student', notionStudentKey: key });
  };
  student(K1, 'kid1', '김하늘'); student(K2, 'kid2', '박서준'); student(K3, null, '최연결안됨'); student(KX, 'kidx', '다른반');
  f.rows.set(`teacherClasses/${CLASS}`, { name: '비전고2반', subject: '영어', students: [K2, K3], ownerUid: 'teacher', academyId: 'main' });
  const actor = { uid: 'teacher', admin: false, principal: false, academyId: 'main', scopes: [K1, K2, K3].map(studentKey => ({ studentKey, subject: '영어' })) };
  resetWordIndex();
  const teacherPassage = await passageActor(f.db, 'teacher');
  const made: any = await makeQuestionSet(f.db, teacherPassage, { text: TEXT, types: ['order', 'insert', 'choice'] }, NOW, seeded());
  return { f, actor, set: made.set };
}
const right = (questions: any[]) => Object.fromEntries(questions.map((q: any, i: number) => [String(i), q.answer]));

test('변형 문제 내주기: targets are my classes and my students; classes expanded now; unlinked students reported; only my own set', async () => {
  const { f, actor, set } = await setup();
  const targets = await questionTargets(f.db, actor);
  assert.deepEqual(targets.classes.map(c => [c.name, c.count]), [['비전고2반', 2]]);
  assert.deepEqual(targets.students.map((s: any) => [s.name, s.linked]), [['김하늘', true], ['박서준', true], ['최연결안됨', false]]);
  await assert.rejects(assignQuestionSet(f.db, actor, { setId: set.id, studentKeys: [KX] }, NOW), /FORBIDDEN/, 'not my student');
  await assert.rejects(assignQuestionSet(f.db, actor, { setId: set.id }, NOW), /ASSIGN_NO_TARGET/);
  const out: any = await assignQuestionSet(f.db, actor, { setId: set.id, classIds: [CLASS], studentKeys: [K1], dueAt: NOW + 86_400_000 }, NOW);
  assert.deepEqual([out.assignment.count, out.skipped], [2, ['최연결안됨']]);
  const doc = f.rows.get(`questionAssignments/${out.assignment.id}`);
  assert.deepEqual([doc.uids.sort(), doc.questions.length, doc.setVersion], [['kid1', 'kid2'], 3, set.createdAt], 'students and questions fixed now');
  // a class changed later does not change who may solve it
  f.rows.set(`teacherClasses/${CLASS}`, { ...f.rows.get(`teacherClasses/${CLASS}`), students: [K3] });
  assert.deepEqual(f.rows.get(`questionAssignments/${out.assignment.id}`).uids.sort(), ['kid1', 'kid2']);
  const other = { ...actor, uid: 'teacher2' };
  await assert.rejects(assignQuestionSet(f.db, other, { setId: set.id, studentKeys: [K1] }, NOW), /FORBIDDEN/, 'someone else’s set');
  assert.equal((await myQuestionAssignments(f.db, actor)).assignments.length, 1);
});

test('변형 문제 내주기: students see what was given; others can’t open it; points when graded (5/2, 90% after the deadline, inside the day cap); once', async () => {
  const { f, actor, set } = await setup();
  const { assignment }: any = await assignQuestionSet(f.db, actor, { setId: set.id, studentKeys: [K1, K2], dueAt: NOW + 3_600_000 }, NOW);
  f.rows.set('petStates/kid1', initialPetState(NOW)); f.rows.set('petStates/kid2', initialPetState(NOW));
  const kid1 = await passageActor(f.db, 'kid1'), kid2 = await passageActor(f.db, 'kid2'), kidx = await passageActor(f.db, 'kidx');
  assert.deepEqual((await myAssignedSets(f.db, kid1)).assigned.map((x: any) => [x.title, x.total, x.status]), [[set.title, 3, 'new']]);
  await assert.rejects(openAttempt(f.db, kidx, { assignmentId: assignment.id }, NOW), /FORBIDDEN/);
  const opened: any = (await openAttempt(f.db, kid1, { assignmentId: assignment.id }, NOW)).attempt;
  assert.ok(!/"answer"|"explanation"/.test(JSON.stringify(opened.questions)));
  await saveAttempt(f.db, kid1, { assignmentId: assignment.id, answers: { 0: 1 } }, NOW + 1000);
  assert.equal((await myAssignedSets(f.db, kid1)).assigned[0].status, 'draft');
  // on time, all right: 3 × 5P
  const doc = f.rows.get(`questionAssignments/${assignment.id}`);
  const r1: any = (await submitAttempt(f.db, kid1, { assignmentId: assignment.id, answers: right(doc.questions) }, NOW + 2000)).attempt;
  assert.deepEqual([r1.score.correct, r1.reward.points, r1.reward.late], [3, 15, false]);
  assert.equal(f.rows.get('petStates/kid1').points - initialPetState(NOW).points, 15);
  const again: any = (await submitAttempt(f.db, kid1, { assignmentId: assignment.id, answers: right(doc.questions) }, NOW + 3000)).attempt;
  assert.equal(f.rows.get('petStates/kid1').points - initialPetState(NOW).points, 15, 'resent: no second payment');
  assert.equal(again.reward.points, 15);
  // late, one wrong: (2×5 + 2) × 0.9 = 10.8 → 11
  await openAttempt(f.db, kid2, { assignmentId: assignment.id }, NOW);
  const wrong = right(doc.questions); wrong['0'] = (doc.questions[0].answer % 5) + 1;
  const r2: any = (await submitAttempt(f.db, kid2, { assignmentId: assignment.id, answers: wrong }, NOW + 7_200_000)).attempt;
  assert.deepEqual([r2.score.correct, r2.reward.points, r2.reward.late], [2, 11, true]);
  assert.deepEqual(questionReward(2, 3, true), { points: 11, xp: Math.round((2 * QUESTION_REWARD.right.xp + QUESTION_REWARD.wrong.xp) * 0.9) });
});

test('변형 문제 내주기: the day cap holds (the rest is not paid nor carried); no pet = nothing paid but graded; cancel hides unsubmitted ones only', async () => {
  const { f, actor, set } = await setup();
  const { assignment }: any = await assignQuestionSet(f.db, actor, { setId: set.id, studentKeys: [K1, K2] }, NOW);
  const pet = initialPetState(NOW); pet.today.studyPoints = PET_DAILY_STUDY_POINTS - 4; f.rows.set('petStates/kid1', pet);
  const kid1 = await passageActor(f.db, 'kid1'), kid2 = await passageActor(f.db, 'kid2'), doc = f.rows.get(`questionAssignments/${assignment.id}`);
  await openAttempt(f.db, kid1, { assignmentId: assignment.id }, NOW);
  const r1: any = (await submitAttempt(f.db, kid1, { assignmentId: assignment.id, answers: right(doc.questions) }, NOW + 1000)).attempt;
  assert.deepEqual([r1.reward.points, r1.reward.wanted, r1.reward.capped], [4, 15, true]);
  await openAttempt(f.db, kid2, { assignmentId: assignment.id }, NOW);
  const r2: any = (await submitAttempt(f.db, kid2, { assignmentId: assignment.id, answers: right(doc.questions) }, NOW + 1000)).attempt;
  assert.deepEqual([r2.score.correct, r2.reward.points, r2.reward.noPet], [3, 0, true]);
  // cancel: a student who submitted still sees it; a new one would not
  const second: any = await assignQuestionSet(f.db, actor, { setId: set.id, studentKeys: [K1] }, NOW);
  await cancelQuestionAssignment(f.db, actor, assignment.id); await cancelQuestionAssignment(f.db, actor, second.assignment.id);
  assert.deepEqual((await myAssignedSets(f.db, kid1)).assigned.map((x: any) => x.assignmentId), [assignment.id]);
  await assert.rejects(openAttempt(f.db, kid1, { assignmentId: second.assignment.id }, NOW), /ASSIGNMENT_CANCELLED/);
  assert.equal(((await openAttempt(f.db, kid1, { assignmentId: assignment.id }, NOW)) as any).attempt.status, 'submitted', 'a graded one still opens on its result');
});

test('변형 문제 내주기: a cancel that lands between reading the set and grading stops the grading and the points', async () => {
  const { f, actor, set } = await setup();
  const { assignment }: any = await assignQuestionSet(f.db, actor, { setId: set.id, studentKeys: [K1] }, NOW);
  f.rows.set('petStates/kid1', initialPetState(NOW));
  const kid1 = await passageActor(f.db, 'kid1'), doc = f.rows.get(`questionAssignments/${assignment.id}`);
  await openAttempt(f.db, kid1, { assignmentId: assignment.id }, NOW);
  // the teacher cancels right after the submission read the (not yet cancelled) set
  const racing: any = { ...f.db, runTransaction: (fn: any) => { f.rows.set(`questionAssignments/${assignment.id}`, { ...doc, cancelled: true }); return f.db.runTransaction(fn); } };
  await assert.rejects(submitAttempt(racing, kid1, { assignmentId: assignment.id, answers: right(doc.questions) }, NOW + 1000), /ASSIGNMENT_CANCELLED/);
  assert.equal(f.rows.get('petStates/kid1').points, initialPetState(NOW).points, 'no points');
  assert.equal(f.rows.get(`questionAttempts/${Object.keys(Object.fromEntries(f.rows)).find(k => k.startsWith('questionAttempts/'))!.slice(17)}`).status, 'draft');
});

test('학습 리포트 › 변형 문제 (선생님): the student’s attempts with visits and answers; only my students; counts of submissions on my list', async () => {
  const { f, actor, set } = await setup();
  const { assignment }: any = await assignQuestionSet(f.db, actor, { setId: set.id, studentKeys: [K1, K2], dueAt: NOW + 3_600_000 }, NOW);
  const kid1 = await passageActor(f.db, 'kid1'), doc = f.rows.get(`questionAssignments/${assignment.id}`);
  await openAttempt(f.db, kid1, { assignmentId: assignment.id }, NOW);
  await openAttempt(f.db, kid1, { assignmentId: assignment.id }, NOW + 40 * 60_000); // a second visit
  const answers = right(doc.questions); answers['0'] = (doc.questions[0].answer % 5) + 1;
  await submitAttempt(f.db, kid1, { assignmentId: assignment.id, answers }, NOW + 45 * 60_000);
  const view: any = await loadStudentQuestionAttempts(f.db, actor, K1);
  assert.equal(view.attempts.length, 1);
  const row = view.attempts[0];
  assert.deepEqual([row.title, row.kind, row.status, row.score, row.visits.sessions.length, row.visits.minutes], [set.title, 'assigned', 'submitted', { correct: 2, total: 3 }, 2, 5]);
  assert.deepEqual(row.results.map((r: any) => r.ok), [false, true, true]);
  assert.ok(row.results[0].given && row.results[0].right, 'the wrong answer and the right one');
  assert.deepEqual((await loadStudentQuestionAttempts(f.db, actor, K3) as any).reason, 'account-not-linked');
  await assert.rejects(loadStudentQuestionAttempts(f.db, { ...actor, scopes: [] }, K1), /FORBIDDEN/, 'not my student');
  const mine = (await myQuestionAssignments(f.db, actor)).assignments[0];
  assert.deepEqual([mine.count, mine.submitted, mine.names.sort()], [2, 1, ['김하늘', '박서준']]);
});

test('숙제 list: the newest given sets come first from the query; without the index yet, all are read and sorted', async () => {
  const { f, actor, set } = await setup();
  for (let i = 0; i < 3; i++) await assignQuestionSet(f.db, actor, { setId: set.id, studentKeys: [K1] }, NOW + i * 1000);
  const kid1 = await passageActor(f.db, 'kid1');
  const order = (await myAssignedSets(f.db, kid1)).assigned.map((x: any) => x.createdAt);
  assert.deepEqual(order, [NOW + 2000, NOW + 1000, NOW]);
  const real = f.db.collection('questionAssignments');
  const noIndex: any = { ...f.db, collection: (name: string) => name !== 'questionAssignments' ? f.db.collection(name) : { where: (...w: any[]) => { const q = real.where(...w); return { orderBy: () => ({ limit: () => ({ get: () => Promise.reject(Object.assign(Error('9 FAILED_PRECONDITION: The query requires an index'), { code: 9 })) }) }), get: () => q.get(), limit: () => ({ get: () => q.get() }) }; } } };
  assert.deepEqual((await myAssignedSets(noIndex, kid1)).assigned.map((x: any) => x.createdAt), [NOW + 2000, NOW + 1000, NOW]);
});

test('학습 리포트 › 변형 문제: the newest 20 from the query; without the index yet, all are read and sorted', async () => {
  const { f, actor } = await setup();
  for (let i = 0; i < 25; i++) f.rows.set(`questionAttempts/a${i}`, { id: `a${i}`, uid: 'kid1', kind: 'self', title: `세트 ${i}`, status: 'draft', answers: {}, sessions: [], updatedAt: NOW + i });
  const titles = (r: any) => r.attempts.map((x: any) => x.title);
  const view: any = await loadStudentQuestionAttempts(f.db, actor, K1);
  assert.deepEqual([view.attempts.length, titles(view)[0], titles(view)[19]], [20, '세트 24', '세트 5']);
  const real = f.db.collection('questionAttempts');
  const noIndex: any = { ...f.db, collection: (name: string) => name !== 'questionAttempts' ? f.db.collection(name) : { where: (...w: any[]) => { const q = real.where(...w); return { orderBy: () => ({ limit: () => ({ get: () => Promise.reject(Object.assign(Error('9 FAILED_PRECONDITION: The query requires an index'), { code: 9 })) }) }), get: () => q.get(), limit: () => ({ get: () => q.get() }) }; } } };
  const fallback: any = await loadStudentQuestionAttempts(noIndex, actor, K1);
  assert.deepEqual([fallback.attempts.length, titles(fallback)[0]], [20, '세트 24']);
});
