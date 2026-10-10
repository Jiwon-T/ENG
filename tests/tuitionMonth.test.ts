import test from 'node:test';
import assert from 'node:assert/strict';
import { templateFirestore } from './helpers/templateFirestore.js';
import { DIRECTORY_ROWS, directorySourceKey, directoryRowKey } from '../api/_lib/academyDirectorySource.js';
import { readTuitionMonth, saveTuitionMonth, tuitionCharge } from '../api/_lib/tuitionMonth.js';

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333';
const admin = { uid: 'admin', admin: true, principal: false, academyId: 'main', scopes: [] };
const NOW = Date.parse('2026-10-20T12:00:00+09:00');
const title = (t: string) => ({ title: [{ plain_text: t }] });
function seed() {
    const f = templateFirestore(), put = (p: string, v: any) => f.rows.set(p, v);
    const student = (key: string, name: string, tuition: number | null) => put(`${DIRECTORY_ROWS}/${directoryRowKey('students', key)}`, { academyId: 'main', kind: 'students', sourceKey: directorySourceKey('students'), entityId: key, fields: { archived: false, properties: { '학생': title(name), '수강료': { number: tuition } } } });
    const enrol = (key: string, subjects: string[]) => put(`${DIRECTORY_ROWS}/${directoryRowKey('enrollments', key.replace(/^./, 'e'))}`, { academyId: 'main', kind: 'enrollments', sourceKey: directorySourceKey('enrollments'), studentKey: key, fields: { archived: false, properties: Object.fromEntries(subjects.map(s => [s, { select: { name: '등록' } }])) } });
    student(A, '가민수 (세교중2)', 640000); student(B, '나지우 (한광고1)', 240000); student(C, '다은 (세교중3)', 500000);
    enrol(A, ['영어']); enrol(B, ['영어']); enrol(C, ['영어', '수학']);
    put(`studentTuition/${A}`, { academyId: 'main', studentKey: A, subjects: { '영어': 320000 } });
    put('teacherClasses/k1', { academyId: 'main', name: '중2 월목', subject: '영어', status: '진행 중', students: [A], slots: [{ weekday: 1, start: '18:00', end: '19:20' }, { weekday: 4, start: '18:00', end: '19:20' }] });
    let n = 0; const lesson = (key: string, date: string, extra: any = {}) => put(`teacherLessonDrafts/l${n++}`, { academyId: 'main', stage: 'published', archived: false, ...extra.top, data: { studentKey: key, subject: '영어', date, classSession: '있음', round: n, ...extra.data } });
    for (const d of ['01', '05', '08', '12', '15', '19']) lesson(A, `2026-10-${d}`);
    lesson(A, '2026-10-16', { data: { classSession: '없음' } }); lesson(A, '2026-10-17', { top: { archived: true } }); lesson(A, '2026-09-30');
    lesson(B, '2026-10-03'); lesson(B, '2026-10-10');
    const ev = (id: string, date: string, kind: string) => put(`teacherSchedules/${id}`, { academyId: 'main', archived: false, data: { date, kind, status: '예정', subject: '영어', students: [A] } });
    ev('s1', '2026-10-26', '휴강'); ev('s2', '2026-10-24', '보강'); ev('s3', '2026-10-15', '보강');
    return f;
}

test('tuition charge: 8-session price, at most 8 charged, free makeups never charged', () => {
    assert.deepEqual(tuitionCharge(320000, 9), { charged: 8, amount: 320000 });
    assert.deepEqual(tuitionCharge(320000, 6), { charged: 6, amount: 240000 });
    assert.deepEqual(tuitionCharge(320000, 9, 2), { charged: 7, amount: 280000 });
    assert.deepEqual(tuitionCharge(null, 5), { charged: 5, amount: null });
});

test('tuition month: written lessons + remaining timetable (휴강 out, 보강 in), capped at 8', async () => {
    const r = await readTuitionMonth(seed().db, admin, '2026-10', NOW);
    const a = r.rows.find((x: any) => x.studentKey === A);
    // 6 written (수업 없음, trash and other months excluded); ahead: Thu 22, Mon 26 (휴강), Thu 29, + 보강 24 → 3.
    assert.deepEqual([a.written, a.planned, a.expected, a.charged, a.tuition, a.tuitionSource, a.amount], [6, 3, 9, 8, 320000, 'subject', 320000]);
    const b = r.rows.find((x: any) => x.studentKey === B);
    assert.deepEqual([b.written, b.planned, b.charged, b.tuition, b.tuitionSource, b.amount], [2, 0, 2, 240000, 'student', 60000]);
    const c = r.rows.filter((x: any) => x.studentKey === C);
    assert.deepEqual(c.map((x: any) => [x.subject, x.tuition, x.tuitionSource]), [['수학', null, 'missing'], ['영어', null, 'missing']]);
    assert.equal(r.total, 380000);
    await assert.rejects(readTuitionMonth(seed().db, { ...admin, admin: false }, '2026-10', NOW), /FORBIDDEN/);
});

test('tuition month: admin corrections are saved separately, conflict-checked, and clearable', async () => {
    const f = seed();
    const first = await saveTuitionMonth(f.db, admin, { month: '2026-10', revision: 0, rows: { [`${B}|영어`]: { sessions: 4 }, [`${C}|영어`]: { tuition: 300000, free: 0 } } }, NOW);
    let r = await readTuitionMonth(f.db, admin, '2026-10', NOW);
    const b = r.rows.find((x: any) => x.studentKey === B), c = r.rows.find((x: any) => x.key === `${C}|영어`);
    assert.deepEqual([b.sessions, b.expected, b.amount, b.edited], [4, 2, 120000, true]);
    // A price typed on the sheet becomes the student's price for that subject from now on.
    assert.deepEqual([c.tuition, c.tuitionSource, c.amount], [300000, 'subject', 0]);
    assert.deepEqual(f.rows.get(`studentTuition/${C}`).subjects, { '영어': 300000 });
    const nextMonth = await readTuitionMonth(f.db, admin, '2026-11', NOW);
    assert.equal(nextMonth.rows.find((x: any) => x.key === `${C}|영어`).tuition, 300000);
    assert.deepEqual(f.rows.get('tuitionMonths/main:2026-10').rows[`${C}|영어`], { free: 0 });
    await assert.rejects(saveTuitionMonth(f.db, admin, { month: '2026-10', revision: 0, rows: {} }, NOW), /TUITION_CONFLICT/);
    await saveTuitionMonth(f.db, admin, { month: '2026-10', revision: first.revision, rows: { [`${B}|영어`]: { free: 1 } } }, NOW);
    assert.deepEqual(f.rows.get('tuitionMonths/main:2026-10').rows[`${B}|영어`], { sessions: 4, free: 1 });
    await saveTuitionMonth(f.db, admin, { month: '2026-10', revision: first.revision + 1, rows: { [`${B}|영어`]: { sessions: null, free: null } }, confirm: true }, NOW);
    r = await readTuitionMonth(f.db, admin, '2026-10', NOW);
    assert.equal(r.rows.find((x: any) => x.studentKey === B).sessions, 2);
    assert.ok(r.confirmedAt);
    assert.equal([...f.rows.keys()].filter(k => k.startsWith('tuitionMonthHistory/')).length, 3);
    await assert.rejects(saveTuitionMonth(f.db, admin, { month: '2026-10', revision: 3, rows: { 'x|영어': { tuition: 1 } } }, NOW), /TUITION_ROW_INVALID/);
});

test('tuition month: students who left are still billed for the lessons they had', async () => {
    const f = seed();
    const D = '44444444-4444-4444-8444-444444444444', E = '55555555-5555-4555-8555-555555555555', G = '66666666-6666-4666-8666-666666666666';
    const put = (p: string, v: any) => f.rows.set(p, v);
    const student = (key: string, name: string, extra: any = {}) => put(`${DIRECTORY_ROWS}/${directoryRowKey('students', key)}`, { academyId: 'main', kind: 'students', sourceKey: directorySourceKey('students'), entityId: key, fields: { archived: Boolean(extra.archived), properties: { '학생': title(name), '수강료': { number: 320000 }, '등록상태': { status: { name: extra.state || '재원' } } } } });
    const enrol = (key: string, subject: string, status: string, endDate?: string) => put(`${DIRECTORY_ROWS}/${directoryRowKey('enrollments', key.replace(/^./, 'e'))}`, { academyId: 'main', kind: 'enrollments', sourceKey: directorySourceKey('enrollments'), studentKey: key, fields: { archived: false, properties: { [subject]: { select: { name: status } }, ...(endDate ? { [subject + ' 중단일']: { date: { start: endDate } } } : {}) } } });
    // D: 중단 with no 중단일; E: 중단 dated last month but taught this month; G: archived (퇴원) with no enrollment row.
    student(D, '라희', { state: '퇴원' }); enrol(D, '영어', '중단');
    student(E, '마루'); enrol(E, '영어', '중단', '2026-09-28');
    student(G, '바다', { archived: true, state: '퇴원' });
    let n = 100; const lesson = (key: string, date: string) => put(`teacherLessonDrafts/x${n++}`, { academyId: 'main', ownerUid: 't1', archived: false, data: { studentKey: key, subject: '영어', date, classSession: '있음' } });
    for (const d of ['02', '06', '09']) lesson(D, `2026-10-${d}`);
    lesson(E, '2026-10-01');
    for (const d of ['03', '07']) lesson(G, `2026-10-${d}`);
    const r = await readTuitionMonth(f.db, admin, '2026-10', NOW);
    const row = (key: string) => r.rows.find((x: any) => x.studentKey === key);
    assert.deepEqual([row(D).written, row(D).planned, row(D).amount, row(D).left, row(D).enrollment], [3, 0, 120000, true, '퇴원']);
    assert.deepEqual([row(E).written, row(E).amount, row(E).left], [1, 40000, true]);
    assert.deepEqual([row(G).written, row(G).status, row(G).amount, row(G).left], [2, '기록만', 80000, true]);
    // A stopped student with no lessons this month is not listed.
    enrol(D, '영어', '중단', '2026-10-01');
    for (const [p, v] of [...f.rows]) if (p.startsWith('teacherLessonDrafts/x') && v.data.studentKey === D) f.rows.delete(p);
    assert.equal((await readTuitionMonth(f.db, admin, '2026-10', NOW)).rows.some((x: any) => x.studentKey === D), false);
});

test('tuition month: 3차시 test lines are not lessons, and a line for other students does not count', async () => {
    const f = seed();
    const k = f.rows.get('teacherClasses/k1');
    f.rows.set('teacherClasses/k1', { ...k, students: [A, B], slots: [...k.slots, { weekday: 3, start: '15:40', end: '16:40', kind: 'test' }, { weekday: 2, start: '18:00', end: '19:20', kind: 'lesson', students: [B] }] });
    const a = (await readTuitionMonth(f.db, admin, '2026-10', NOW)).rows.find((x: any) => x.studentKey === A);
    assert.equal(a.planned, 3, 'same as before: Thu 22, Thu 29, makeup 24');
});

test('tuition month: after confirming, a lesson edit that moves a bill is flagged until confirmed again', async () => {
    const f = seed();
    await saveTuitionMonth(f.db, admin, { month: '2026-10', revision: 0, rows: {}, confirm: true }, NOW);
    let r = await readTuitionMonth(f.db, admin, '2026-10', NOW);
    assert.equal(r.changedSinceConfirm, 0);
    // One of B's two lessons is deleted after confirmation.
    const [path, row] = [...f.rows].find(([p, v]) => p.startsWith('teacherLessonDrafts/') && v.data.studentKey === B)!;
    f.rows.set(path, { ...row, archived: true });
    r = await readTuitionMonth(f.db, admin, '2026-10', NOW);
    const b = r.rows.find((x: any) => x.studentKey === B);
    assert.equal(r.changedSinceConfirm, 1);
    assert.deepEqual([b.charged, b.changedSinceConfirm.charged, b.changedSinceConfirm.amount], [1, 2, 60000]);
    // Saving an unrelated edit keeps the flag; confirming again clears it.
    await saveTuitionMonth(f.db, admin, { month: '2026-10', revision: r.revision, rows: { [`${A}|영어`]: { free: 0 } } }, NOW);
    r = await readTuitionMonth(f.db, admin, '2026-10', NOW);
    assert.equal(r.changedSinceConfirm, 1);
    await saveTuitionMonth(f.db, admin, { month: '2026-10', revision: r.revision, rows: {}, confirm: true }, NOW);
    assert.equal((await readTuitionMonth(f.db, admin, '2026-10', NOW)).changedSinceConfirm, 0);
});
