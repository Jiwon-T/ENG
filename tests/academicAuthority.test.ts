import test from 'node:test';
import assert from 'node:assert/strict';
import { templateFirestore } from './helpers/templateFirestore.js';
import { academicAppActive, academicCutoverStatus, activateAcademicApp, deactivateAcademicApp } from '../api/_lib/academicAuthority.js';
import { academicProgressRef, previewAcademicMigration, resetAcademicMigration } from '../api/_lib/academicMigration.js';
import { syncAcademicPage, GRADE_DATABASE, ENROLLMENT_DATABASE } from '../api/_lib/academic.js';
import { notionDisconnectStatus } from '../api/_lib/notionDisconnect.js';

const admin = { uid: 'admin', admin: true, academyId: 'main' };
const studentId = '11111111-1111-4111-8111-111111111111', pageId = '22222222-2222-4222-8222-222222222222';
const gradePage = () => ({ id: pageId, parent: { database_id: GRADE_DATABASE }, last_edited_time: '2026-10-02T00:00:00Z', properties: {
    학생: { relation: [{ id: studentId }] }, 과목: { select: { name: '영어' } }, '시험 종류': { select: { name: '학교 내신' } },
    시험명: { title: [{ plain_text: '중간' }] }, 원점수: { number: 80 }, 만점: { number: 100 }, 시험일: { date: { start: '2026-04-23' } }, '제출 상태': { select: { name: '제출 완료' } } } });
const enrollmentPage = () => ({ id: pageId, parent: { database_id: ENROLLMENT_DATABASE }, last_edited_time: '2026-10-02T00:00:00Z', properties: { 학생: { relation: [{ id: studentId }] }, 영어: { status: { name: '중단' } } } });
function ready() {
    const f = templateFirestore();
    f.rows.set('academyCoreAuthority/main', { active: true });
    f.rows.set(academicProgressRef(f.db).path, { done: true, error: null, total: 120, startedAt: Date.now() - 600000, lastSuccessAt: Date.now() - 60000, leaseUntil: 0 });
    return f;
}

test('the grade switch needs the core switch, a fresh completed pass and no in-flight grade write', async () => {
    const f = ready();
    await assert.rejects(activateAcademicApp(f.db, { ...admin, admin: false }, { confirmed: true }), /FORBIDDEN/);
    await assert.rejects(activateAcademicApp(f.db, admin, {}), /INVALID_INPUT/);
    f.rows.get('academyCoreAuthority/main').active = false;
    await assert.rejects(activateAcademicApp(f.db, admin, { confirmed: true }), /CORE_NOT_READY/);
    f.rows.get('academyCoreAuthority/main').active = true;
    const progress = f.rows.get(academicProgressRef(f.db).path);
    progress.lastSuccessAt = Date.now() - 16 * 60000;
    await assert.rejects(activateAcademicApp(f.db, admin, { confirmed: true }), /ACADEMIC_FINAL_CHECK_REQUIRED/);
    progress.lastSuccessAt = Date.now(); progress.done = false;
    await assert.rejects(activateAcademicApp(f.db, admin, { confirmed: true }), /ACADEMIC_FINAL_CHECK_REQUIRED/);
    progress.done = true;
    f.rows.set('teacherAcademicDrafts/x', { stage: 'failed', notionWrite: { attempted: true, done: false }, data: {} });
    await assert.rejects(activateAcademicApp(f.db, admin, { confirmed: true }), /PUBLISH_IN_PROGRESS/);
    assert.equal((await academicCutoverStatus(f.db, admin)).items.find((i: any) => i.key === 'inFlight').count, 1);
    f.rows.delete('teacherAcademicDrafts/x');
    assert.equal((await academicCutoverStatus(f.db, admin)).ready, true);
    assert.equal((await activateAcademicApp(f.db, admin, { confirmed: true })).active, true);
    assert.equal(await academicAppActive(f.db), true);
    const writes = f.metrics.writes; assert.equal((await activateAcademicApp(f.db, admin, { confirmed: true })).alreadyActive, true); assert.equal(f.metrics.writes, writes);
});

test('a hand-made grade switch is ignored', async () => {
    const f = templateFirestore();
    f.rows.set('academicAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'forged', verificationHash: 'x' });
    assert.equal(await academicAppActive(f.db), false);
});

test('after the switches, Make grade and enrollment deliveries never overwrite app data; migration tools are closed', async () => {
    const f = ready(); await activateAcademicApp(f.db, admin, { confirmed: true });
    const lookup: any = async () => { throw Error('must not look up'); }, map: any = async () => { throw Error('must not map'); };
    const before = JSON.stringify([...f.rows]);
    assert.deepEqual(await syncAcademicPage(f.db as any, gradePage(), lookup, map), { applied: false, reason: 'APP_AUTHORITY', kind: 'academicRecords' });
    assert.deepEqual(await syncAcademicPage(f.db as any, enrollmentPage(), lookup, map), { applied: false, reason: 'APP_AUTHORITY', kind: 'studentEnrollments' });
    assert.equal(JSON.stringify([...f.rows]), before, 'nothing written');
    await assert.rejects(previewAcademicMigration(f.db, admin, async () => ({})), /ACADEMIC_APP_ACTIVE/);
    await assert.rejects(resetAcademicMigration(f.db, admin, true), /ACADEMIC_APP_ACTIVE/);
    const status = await notionDisconnectStatus(f.db, admin);
    assert.equal(status.areas.find((a: any) => a.key === 'grade').appOnly, true);
    assert.equal(status.steps.find((s: any) => s.key === 'make-academic').ready, true);
    await deactivateAcademicApp(f.db, admin, { confirmed: true });
    assert.equal(await academicAppActive(f.db), false);
    assert.equal((await notionDisconnectStatus(f.db, admin)).steps.find((s: any) => s.key === 'make-academic').ready, false);
});

test('enrollment deliveries are refused once students/teachers are app-only, even before the grade switch', async () => {
    const f = templateFirestore(); f.rows.set('academyCoreAuthority/main', { active: true });
    const r = await syncAcademicPage(f.db as any, enrollmentPage(), (async () => { throw Error('no'); }) as any, (async () => { throw Error('no'); }) as any);
    assert.equal(r.reason, 'APP_AUTHORITY');
});
