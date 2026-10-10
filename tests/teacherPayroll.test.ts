import test from 'node:test';
import assert from 'node:assert/strict';
import { templateFirestore } from './helpers/templateFirestore.js';
import { DIRECTORY_ROWS, directorySourceKey, directoryRowKey } from '../api/_lib/academyDirectorySource.js';
import { readTeacherPayroll, saveTeacherShares, savePayrollAdjust, splitRow } from '../api/_lib/teacherPayroll.js';
import { readStudentTuition, saveStudentTuition } from '../api/_lib/studentTuition.js';

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333';
const admin = { uid: 'admin', admin: true, principal: false, academyId: 'main', scopes: [] };
const NOW = Date.parse('2026-10-31T12:00:00+09:00');
function seed() {
    const f = templateFirestore(), put = (p: string, v: any) => f.rows.set(p, v);
    const student = (key: string, name: string) => put(`${DIRECTORY_ROWS}/${directoryRowKey('students', key)}`, { academyId: 'main', kind: 'students', sourceKey: directorySourceKey('students'), entityId: key, fields: { archived: false, properties: { '학생': { title: [{ plain_text: name }] }, '수강료': { number: null } } } });
    const enrol = (key: string, subjects: string[]) => put(`${DIRECTORY_ROWS}/${directoryRowKey('enrollments', key.replace(/^./, 'e'))}`, { academyId: 'main', kind: 'enrollments', sourceKey: directorySourceKey('enrollments'), studentKey: key, fields: { archived: false, properties: Object.fromEntries(subjects.map(s => [s, { select: { name: '등록' } }])) } });
    student(A, '가'); student(B, '나'); student(C, '다'); enrol(A, ['영어']); enrol(B, ['영어']); enrol(C, ['영어', '수학']);
    put(`studentTuition/${A}`, { academyId: 'main', subjects: { '영어': 400000 } });
    put(`studentTuition/${B}`, { academyId: 'main', subjects: { '영어': 320000 } });
    put(`studentTuition/${C}`, { academyId: 'main', subjects: { '영어': 300000 } });
    put('users/t1', { role: 'teacher', name: '김선생' }); put('users/t2', { role: 'teacher', name: '이선생' });
    put('teacherWorkspaceAccess/t1', { academyId: 'main', scopes: [{ studentKey: A, subject: '영어' }, { studentKey: B, subject: '영어' }] });
    put('teacherWorkspaceAccess/t2', { academyId: 'main', scopes: [{ studentKey: B, subject: '영어' }] });
    let n = 0; const lesson = (key: string, owner: string, count: number) => { for (let i = 0; i < count; i++) put(`teacherLessonDrafts/l${n++}`, { academyId: 'main', ownerUid: owner, archived: false, data: { studentKey: key, subject: '영어', date: `2026-10-${String(i + 1).padStart(2, '0')}`, classSession: '있음' } }); };
    lesson(A, 't1', 8); lesson(B, 't1', 6); lesson(B, 't2', 2); lesson(C, 't1', 4);
    return f;
}

test('split: by lessons each teacher wrote, else evenly, never losing a won', () => {
    assert.deepEqual(splitRow(320000, ['t1', 't2'], { t1: 6, t2: 2 }).map(p => p.amount), [240000, 80000]);
    assert.deepEqual(splitRow(100001, ['t1', 't2']).map(p => p.amount), [50001, 50000]);
    assert.deepEqual(splitRow(5000, []), []);
});

test('payroll: default 60%, private per-teacher share, shared students split by lessons', async () => {
    const f = seed();
    let r = await readTeacherPayroll(f.db, admin, '2026-10', NOW);
    const t1 = r.teachers.find((t: any) => t.uid === 't1'), t2 = r.teachers.find((t: any) => t.uid === 't2');
    // t1: A 400,000 + B 240,000 (6 of 8 lessons) + C 150,000 (unassigned, but t1 wrote its 4 lessons) = 790,000 × 60%; t2: B 80,000 × 60%.
    assert.deepEqual([t1.revenue, t1.share, t1.pay, t2.revenue, t2.pay], [790000, 60, 474000, 80000, 48000]);
    // C 수학 has no price, so it stays with the academy.
    assert.deepEqual(r.unassigned.map((u: any) => [u.subject, u.reason]), [['수학', 'no-price']]);
    assert.equal(r.revenue, 400000 + 320000 + 150000);
    assert.equal(r.academy, r.revenue - 474000 - 48000);
    await saveTeacherShares(f.db, admin, { defaultShare: 60, shares: { t2: 50 } }, NOW);
    await savePayrollAdjust(f.db, admin, { month: '2026-10', revision: 0, adjust: { t1: { amount: -20000, note: '교재비' } } }, NOW);
    r = await readTeacherPayroll(f.db, admin, '2026-10', NOW);
    const u1 = r.teachers.find((t: any) => t.uid === 't1'), u2 = r.teachers.find((t: any) => t.uid === 't2');
    assert.deepEqual([u2.share, u2.customShare, u2.pay], [50, true, 40000]);
    assert.deepEqual([u1.adjust, u1.adjustNote, u1.total], [-20000, '교재비', 454000]);
    await assert.rejects(savePayrollAdjust(f.db, admin, { month: '2026-10', revision: 0, adjust: {} }, NOW), /PAYROLL_CONFLICT/);
    await saveTeacherShares(f.db, admin, { shares: { t2: null } }, NOW + 1);
    assert.equal((await readTeacherPayroll(f.db, admin, '2026-10', NOW)).teachers.find((t: any) => t.uid === 't2').share, 60);
});

test('payroll and shares: admin and principal only; teachers are refused', async () => {
    const f = seed();
    const principal = { ...admin, uid: 'p1', admin: false, principal: true };
    assert.equal((await readTeacherPayroll(f.db, principal, '2026-10', NOW)).teachers.length, 2);
    await saveTeacherShares(f.db, principal, { shares: { t1: 55 } }, NOW);
    for (const actor of [{ ...admin, uid: 't1', admin: false }, { ...admin, academyId: 'other' }]) {
        await assert.rejects(readTeacherPayroll(f.db, actor, '2026-10', NOW), /FORBIDDEN/);
        await assert.rejects(saveTeacherShares(f.db, actor, { defaultShare: 70 }, NOW), /FORBIDDEN/);
    }
});

test('student tuition: per-subject prices from the profile editor, null removes', async () => {
    const f = seed();
    assert.deepEqual(await readStudentTuition(f.db, admin, C), { studentKey: C, subjects: ['영어', '수학'], prices: { '영어': 300000 } });
    await saveStudentTuition(f.db, admin, { studentKey: C, prices: { '수학': 280000, '영어': null } }, NOW);
    assert.deepEqual(f.rows.get(`studentTuition/${C}`).subjects, { '수학': 280000 });
    await assert.rejects(saveStudentTuition(f.db, { ...admin, admin: false }, { studentKey: C, prices: {} }, NOW), /FORBIDDEN/);
});

test('payroll: when the teacher changes mid-month, each is paid for the lessons they wrote', async () => {
    const f = seed();
    // A was taught by t2 for 3 lessons, then moved to t1 (5 lessons). t2 is not assigned to A any more.
    for (const [path, row] of [...f.rows]) if (path.startsWith('teacherLessonDrafts/') && row.data.studentKey === A && Number(row.data.date.slice(-2)) <= 3) f.rows.set(path, { ...row, ownerUid: 't2' });
    f.rows.set('teacherWorkspaceAccess/t2', { academyId: 'main', disabled: true, scopes: [] });
    const r = await readTeacherPayroll(f.db, admin, '2026-10', NOW);
    const t1 = r.teachers.find((t: any) => t.uid === 't1'), t2 = r.teachers.find((t: any) => t.uid === 't2');
    const a1 = t1.rows.find((x: any) => x.key === `${A}|영어`), a2 = t2.rows.find((x: any) => x.key === `${A}|영어`);
    assert.deepEqual([a1.written, a1.revenue, a2.written, a2.revenue, a2.assigned], [5, 250000, 3, 150000, false]);
    assert.equal(t2.disconnected, true);
    // B: t2 (disconnected, not assigned) still gets the 2 lessons they wrote; t1 the 6.
    assert.deepEqual([t1.rows.find((x: any) => x.key === `${B}|영어`).revenue, t2.rows.find((x: any) => x.key === `${B}|영어`).revenue], [240000, 80000]);
});

test('payroll: sessions still ahead go to the teacher assigned now', async () => {
    const f = seed();
    f.rows.set('teacherClasses/k1', { academyId: 'main', name: '중2', subject: '영어', status: '진행 중', students: [C], slots: [{ weekday: 4, start: '18:00', end: '19:00' }] });
    f.rows.set('teacherWorkspaceAccess/t2', { academyId: 'main', scopes: [{ studentKey: B, subject: '영어' }, { studentKey: C, subject: '영어' }] });
    // On Oct 20, C has 4 lessons written by t1 and Thursdays 22 and 29 ahead with t2, now assigned.
    const r = await readTeacherPayroll(f.db, admin, '2026-10', Date.parse('2026-10-20T12:00:00+09:00'));
    const c1 = r.teachers.find((t: any) => t.uid === 't1').rows.find((x: any) => x.key === `${C}|영어`), c2 = r.teachers.find((t: any) => t.uid === 't2').rows.find((x: any) => x.key === `${C}|영어`);
    assert.deepEqual([c1.written, c1.planned, c1.revenue, c2.written, c2.planned, c2.revenue], [4, 0, 150000, 0, 2, 75000]);
});
