import test from 'node:test';
import assert from 'node:assert/strict';
import { timetableSlotSchema, normalizeSlotTargets, teacherScheduleSchema } from '../api/_lib/teacherWorkspacePolicy.ts';
import { todayLessons, sessionSeed, slotStudy } from '../src/lib/teacherTodayLessons.ts';
import { todayLessonState } from '../src/lib/todayLessonProgress.ts';
import { matchingSavedLesson } from '../src/lib/teacherLessonGrid.ts';

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333', X = '99999999-9999-4999-8999-999999999999';

test('timetable lines keep kind, students and self-study blocks; targets are trimmed to the class', () => {
    const parsed = timetableSlotSchema.parse({ weekday: 1, start: '18:50', end: '20:10', kind: 'lesson', study: [{ start: '20:10', end: '21:10', students: [A, X] }], extra: 'dropped' });
    assert.deepEqual(Object.keys(parsed).sort(), ['end', 'kind', 'start', 'study', 'weekday']);
    assert.throws(() => timetableSlotSchema.parse({ weekday: 1, start: '18:00', end: '19:00', study: [{ start: '20:00', end: '19:00' }] }));
    const lesson = normalizeSlotTargets(parsed as any, [A, B]);
    assert.deepEqual((lesson as any).study, [{ start: '20:10', end: '21:10', students: [A] }]);
    const allStudy = normalizeSlotTargets({ kind: 'lesson', study: [{ start: '20:10', end: '21:10', students: [A, B] }] } as any, [A, B]);
    assert.equal((allStudy as any).study[0].students, undefined, 'everyone named = no list');
    const testLine = normalizeSlotTargets({ kind: 'test', students: [B, X], study: [{ start: '1', end: '2' }] } as any, [A, B]);
    assert.deepEqual([(testLine as any).students, (testLine as any).study], [[B], undefined]);
    assert.equal((normalizeSlotTargets({} as any, [A]) as any).kind, 'lesson');
});

test('schedule kinds: 자습 added, 시험 saved as 테스트', () => {
    const base = { title: '자습', subject: '영어', students: [A], date: '2026-10-12', start: '18:00', end: '19:00', status: '예정', place: '', note: '' };
    assert.equal(teacherScheduleSchema.parse({ ...base, kind: '자습' }).kind, '자습');
    assert.equal(teacherScheduleSchema.parse({ ...base, kind: '시험' }).kind, '테스트');
});

test('오늘 수업: 3차시 테스트 is labelled and opens as no class with self-study at the test time', () => {
    const data = { admin: true, uid: 'u', classes: [{ id: 'k', name: '고1', subject: '영어', status: '진행 중', students: [A, B, C], slots: [
        { id: 's1', weekday: 1, start: '18:50', end: '20:10', kind: 'lesson', study: [{ start: '20:10', end: '21:10', students: [A] }, { start: '17:50', end: '18:50' }] },
        { id: 's2', weekday: 1, start: '15:40', end: '16:40', kind: 'test', students: [B, C] }] }] };
    const events = todayLessons(data, '2026-10-12', [{ id: 'e', data: { date: '2026-10-12', status: '예정', kind: '자습', title: '자습', subject: '영어', students: [A], start: '13:00', end: '14:00' } }]);
    const test = events.find(e => e.session === 'test')!, lesson = events.find(e => e.kind === '정규')!, study = events.find(e => e.session === 'study')!;
    assert.deepEqual([test.kind, test.students], ['테스트', [B, C]]);
    assert.deepEqual(sessionSeed(test, B), { start: '', end: '', round: null, classSession: '없음', selfStudy: '있음', selfStudyStart: '15:40', selfStudyEnd: '16:40' });
    assert.deepEqual(sessionSeed(lesson, A), { classSession: '있음', selfStudy: '있음', selfStudyStart: '20:10', selfStudyEnd: '21:10' });
    assert.deepEqual(sessionSeed(lesson, B), { classSession: '있음', selfStudy: '있음', selfStudyStart: '17:50', selfStudyEnd: '18:50' });
    assert.equal(study.kind, '자습'); assert.equal(sessionSeed(study, A).classSession, '없음');
    assert.deepEqual(slotStudy(data.classes[0], data.classes[0].slots[1]), {}, 'tests have no study blocks');
    const saved = { id: 'r', ownerUid: 'u', stage: 'published', updatedAt: 1, data: { studentKey: B, subject: '영어', date: '2026-10-12', start: '', end: '', classSession: '없음', selfStudy: '있음', selfStudyStart: '15:40', selfStudyEnd: '16:40' } };
    assert.equal(todayLessonState(test, B, [saved]), '반영 완료', 'a no-class record matches the test by its self-study time');
    assert.equal(matchingSavedLesson([saved], { ...saved.data }, 'u', false)?.id, 'r');
    assert.equal(matchingSavedLesson([saved], { ...saved.data, selfStudyStart: '19:00' }, 'u', false), undefined);
});
