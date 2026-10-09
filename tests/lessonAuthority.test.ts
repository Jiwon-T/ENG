import test from 'node:test';
import assert from 'node:assert/strict';
import { startLessonMigration, runLessonMigration, lessonMigrationStatus, acknowledgeLessonMigrationHoldGroup } from '../api/_lib/lessonMigration.js';
import { lessonAppActive, lessonCutoverStatus, activateLessonApp, deactivateLessonApp, requestLessonCutover, LESSON_APP_PATHS_READY } from '../api/_lib/lessonAuthority.js';
import { storeWebhookLessonReport } from '../api/_lib/lessonWebhookProjection.js';
import { lessonCutoverStep } from '../src/lib/lessonMigrationDriver.js';
import { STUDENT, id, admin, page, fixture, drain, snapshot, report } from './helpers/lessonMigrationFixture.js';

const READY = true;
async function migrated(pages = [page(1)], core = true) {
    const f = fixture(pages); for (const p of pages) f.rows.set('lessonReports/' + p.id, report(Number(p.id.slice(-12))));
    if (core) f.rows.set('academyCoreAuthority/main', { active: true });
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); await drain(f);
    return f;
}

test('a locked switch refuses activation; status reads only Firestore', async () => {
    assert.equal(LESSON_APP_PATHS_READY, true);
    const f = await migrated(); f.calls.length = 0;
    const status = await lessonCutoverStatus(f.db, admin, false);
    assert.equal(f.calls.length, 0); assert.equal(status.active, false); assert.equal(status.canActivate, false);
    assert.deepEqual(status.items.map((i: any) => [i.key, i.ok]), [['core', true], ['migration', true], ['holds', true], ['inFlight', true], ['paths', false]]);
    await assert.rejects(activateLessonApp(f.db, admin, { confirmed: true }, false), /LESSON_APP_PATHS_NOT_READY/);
    await assert.rejects(requestLessonCutover(f.db, admin, { confirmed: true }, false), /LESSON_APP_PATHS_NOT_READY/);
    assert.equal((await lessonCutoverStatus(f.db, admin)).canActivate, true);
    assert.equal(await lessonAppActive(f.db, admin), false);
    await assert.rejects(lessonCutoverStatus(f.db, { ...admin, admin: false }), /FORBIDDEN/);
});

test('activation re-verifies freshness, core, holds and in-flight writes in one transaction', async () => {
    const f = await migrated();
    await assert.rejects(activateLessonApp(f.db, admin, {}, READY), /INVALID_INPUT/);
    f.rows.get('academyCoreAuthority/main').active = false;
    await assert.rejects(activateLessonApp(f.db, admin, { confirmed: true }, READY), /CORE_NOT_READY/);
    f.rows.get('academyCoreAuthority/main').active = true;
    f.rows.set('teacherLessonDrafts/' + id(800), { ownerUid: 'teacher', academyId: 'main', stage: 'publishing', publishStartedAt: Date.now(), revision: 1, data: {} });
    await assert.rejects(activateLessonApp(f.db, admin, { confirmed: true }, READY), /PUBLISH_IN_PROGRESS/);
    f.rows.get('teacherLessonDrafts/' + id(800)).publishStartedAt = Date.now() - 600000;
    f.rows.set('lessonMigrationHolds/x', { status: 'open', code: 'STUDENT_MAPPING' });
    await assert.rejects(activateLessonApp(f.db, admin, { confirmed: true }, READY), /LESSON_MIGRATION_NOT_READY/);
    f.rows.delete('lessonMigrationHolds/x');
    f.rows.get('lessonMigrationJobs/main').completedAt = Date.now() - 16 * 60000;
    await assert.rejects(activateLessonApp(f.db, admin, { confirmed: true }, READY), /LESSON_FINAL_CHECK_REQUIRED/);
    f.rows.get('lessonMigrationJobs/main').completedAt = Date.now();
    const result = await activateLessonApp(f.db, admin, { confirmed: true }, READY);
    assert.equal(result.active, true); assert.equal(await lessonAppActive(f.db, admin), true);
    const auth = f.rows.get('lessonAppAuthority/main'), run = f.rows.get('lessonVerificationRuns/' + auth.verifiedRunId);
    assert.equal(run.hash, auth.verificationHash); assert.equal(run.verified, true); assert.equal(auth.activatedBy, 'admin');
    assert.equal([...f.rows.keys()].filter(k => k.startsWith('lessonAuthorityHistory/')).length, 1);
    const writes = f.metrics.writes; assert.equal((await activateLessonApp(f.db, admin, { confirmed: true }, READY)).alreadyActive, true); assert.equal(f.metrics.writes, writes);
});

test('a hand-made switch without its verification record is ignored', async () => {
    const f = fixture([]);
    f.rows.set('lessonAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'forged', verificationHash: 'x' });
    assert.equal(await lessonAppActive(f.db, admin), false);
    f.rows.set('lessonVerificationRuns/forged', { verified: true, academyId: 'main', hash: 'other' });
    assert.equal(await lessonAppActive(f.db, admin), false);
    assert.equal(await lessonAppActive(f.db, { ...admin, academyId: 'other' }), false);
});

test('one button: a stale result starts the final run, which switches on by itself only when it ends ready', async () => {
    const f = await migrated();
    f.rows.get('lessonMigrationJobs/main').completedAt = Date.now() - 60 * 60000;
    const first = await requestLessonCutover(f.db, admin, { confirmed: true }, READY);
    assert.equal(first.started, true); assert.equal(first.job.final, true); assert.equal(first.job.activateOnReady, true);
    assert.equal(await lessonAppActive(f.db, admin), false);
    const job = await drain(f, admin, { pathsReady: READY });
    assert.equal(job.result.activation.active, true); assert.equal(job.activateOnReady, false);
    assert.equal(await lessonAppActive(f.db, admin), true);
    assert.equal(f.rows.get('lessonAppAuthority/main').activatedBy, 'admin');
    // A fresh ready result switches on immediately without another run.
    const g = await migrated(); const direct = await requestLessonCutover(g.db, admin, { confirmed: true }, READY);
    assert.equal(direct.active, true); assert.equal(direct.started, false);
});

test('a final run that finds a problem does not switch on and leaves Notion in charge', async () => {
    const pages = [page(1)]; const f = await migrated(pages);
    f.rows.get('lessonMigrationJobs/main').completedAt = 0;
    pages.push(page(3, { students: [] }));
    await requestLessonCutover(f.db, admin, { confirmed: true }, READY);
    const job = await drain(f, admin, { pathsReady: READY });
    assert.equal(job.result.ready, false); assert.equal(job.result.activation, undefined);
    assert.equal(await lessonAppActive(f.db, admin), false);
    assert.equal((await lessonMigrationStatus(f.db, admin)).holdGroups.STUDENT_LINK_MISSING.count, 1);
});

test('after the switch, Notion imports and Make projections cannot overwrite app data; deactivation keeps everything', async () => {
    const f = await migrated(); await activateLessonApp(f.db, admin, { confirmed: true }, READY);
    await assert.rejects(startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }), /LESSON_APP_ACTIVE/);
    const before = snapshot(f, 'lessonReports/');
    const mapping = { studentKey: STUDENT, internalStudentId: 'internal' };
    const result = await storeWebhookLessonReport(f.db, { notionPageId: id(1), lessonDateStart: '2026-09-01T14:00:00+09:00', category: '수업', feedback: '옛 Notion 내용', sourceUpdatedAt: new Date().toISOString() } as any, mapping);
    assert.equal(result.reason, 'APP_AUTHORITY'); assert.equal(snapshot(f, 'lessonReports/'), before);
    const staged = snapshot(f, 'lessonSourceRecords/'), drafts = snapshot(f, 'teacherLessonDrafts/');
    await assert.rejects(deactivateLessonApp(f.db, admin, {}), /INVALID_INPUT/);
    assert.equal((await deactivateLessonApp(f.db, admin, { confirmed: true })).active, false);
    assert.equal(await lessonAppActive(f.db, admin), false);
    assert.equal(snapshot(f, 'lessonSourceRecords/'), staged); assert.equal(snapshot(f, 'teacherLessonDrafts/'), drafts); assert.equal(snapshot(f, 'lessonReports/'), before);
    assert.equal([...f.rows.keys()].filter(k => k.startsWith('lessonAuthorityHistory/')).length, 2);
    assert.equal((await storeWebhookLessonReport(f.db, { notionPageId: id(1), lessonDateStart: '2026-09-01T14:00:00+09:00', category: '수업', feedback: '새 Notion 내용', sourceUpdatedAt: new Date(Date.now() + 60000).toISOString() } as any, mapping)).applied, true);
});

test('unchanged rows skip classification on later runs; a whole hold type can be confirmed at once', async () => {
    const f = await migrated([page(1), page(2)]);
    f.resetMetrics(); await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); const again = await drain(f);
    assert.equal(again.counts.unchanged, 2); assert.equal(again.result.ready, true);
    assert.equal(f.metrics.queries <= 8, true, 'no per-row app/public lookups for unchanged rows: ' + f.metrics.queries);
    const g = fixture([page(4, { authors: ['99999999-9999-4999-8999-999999999999'] }), page(5, { authors: [] , round: 5 }), page(6, { students: [] })]);
    for (const n of [4, 5]) g.rows.set('lessonReports/' + id(n), report(n));
    g.rows.get('teacherWorkspaceAccess/teacher').notionTeacherPageId = '44444444-4444-4444-8444-444444444444';
    await startLessonMigration(g.db, admin, { confirmed: true, mode: 'full' }); await drain(g);
    assert.equal((await lessonMigrationStatus(g.db, admin)).holdGroups.AUTHOR_UNKNOWN.count, 2);
    await assert.rejects(acknowledgeLessonMigrationHoldGroup(g.db, admin, { code: 'STUDENT_MAPPING', confirmed: true }), /INVALID_INPUT/);
    const done = await acknowledgeLessonMigrationHoldGroup(g.db, admin, { code: 'AUTHOR_UNKNOWN', confirmed: true });
    assert.equal(done.acknowledged, 2);
    await startLessonMigration(g.db, admin, { confirmed: true, mode: 'recheck' }); await drain(g);
    const status = await lessonMigrationStatus(g.db, admin);
    assert.equal(status.holdGroups.AUTHOR_UNKNOWN, undefined); assert.equal(status.holdGroups.STUDENT_LINK_MISSING.count, 1);
    for (const n of [4, 5]) assert.equal(g.rows.get('lessonSourceRecords/' + id(n)).ownerUid, '__unlinked_author__');
});

test('the card shows the right step', () => {
    assert.equal(lessonCutoverStep(null), 1);
    assert.equal(lessonCutoverStep({ job: { mode: 'dry-run', status: 'completed', result: {} } }), 1);
    assert.equal(lessonCutoverStep({ job: { mode: 'full', status: 'running', phase: 'scan' } }), 1);
    assert.equal(lessonCutoverStep({ job: { mode: 'full', status: 'completed', scanCompleted: true, result: { ready: false } }, openHolds: 3 }), 2);
    assert.equal(lessonCutoverStep({ job: { mode: 'full', status: 'running', phase: 'recheck', scanCompleted: true } , openHolds: 3 }), 2);
    assert.equal(lessonCutoverStep({ job: { mode: 'full', status: 'completed', scanCompleted: true, result: { ready: true } }, openHolds: 0 }), 3);
    assert.equal(lessonCutoverStep({ job: { mode: 'full', final: true, status: 'running', phase: 'scan', scanCompleted: false } , openHolds: 0 }), 3);
    assert.equal(lessonCutoverStep({ job: { mode: 'full', final: true, status: 'completed', scanCompleted: true, result: { ready: false } } , openHolds: 2 }), 2);
    assert.equal(lessonCutoverStep({ cutover: { active: true } }), 3);
});
