import test from 'node:test';
import assert from 'node:assert/strict';
import { startLessonMigration, runLessonMigration, pauseLessonMigration, lessonMigrationStatus, decideLessonMigrationHold, runLessonMigrationCron, transientMigrationError, migrationBackoff } from '../api/_lib/lessonMigration.js';
import { handleLessonMigrationCron } from '../api/teacher/workspace.js';
import { nextDriverAction } from '../src/lib/lessonMigrationDriver.js';

import { DB, STUDENT, TEACHER_PAGE, id, admin, page, fixture, drain, snapshot, report } from './helpers/lessonMigrationFixture.js';

test('full run stages verified rows, keeps two same-day lessons separate, holds unsafe rows, and never touches app or public data', async () => {
    const pages = [page(1), page(2, { time: '17:00 ~ 18:20', date: '2026-09-01T17:00:00+09:00' }), page(3, { students: [] }), page(4, { authors: ['99999999-9999-4999-8999-999999999999'] }), page(5), page(6)];
    const f = fixture(pages), draftId = id(500);
    f.rows.set('lessonReports/' + id(1), report(1));
    f.rows.set('lessonReports/' + id(2).replace(/-/g, ''), report(2, { lessonDateStart: '2026-09-01T17:00:00+09:00' }));
    f.rows.set('teacherLessonDrafts/' + draftId, { ownerUid: 'teacher', academyId: 'main', notionPageId: id(5), revision: 2, stage: 'published', lastSubmittedRevision: 2, data: { studentKey: STUDENT, subject: '영어', content: '수업 내용 5', assignment: '복습', note: '' } });
    f.rows.set('lessonReports/' + id(5), report(5, { teacherDraftId: draftId }));
    const app = snapshot(f, 'teacherLessonDrafts/'), pub = snapshot(f, 'lessonReports/');
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' });
    const job = await drain(f);
    assert.equal(job.status, 'completed');
    assert.equal(snapshot(f, 'teacherLessonDrafts/'), app); assert.equal(snapshot(f, 'lessonReports/'), pub);
    const staged = (n: number) => f.rows.get('lessonSourceRecords/' + id(n));
    assert.equal(staged(1).ownerUid, 'teacher'); assert.equal(staged(1).publicReportId, id(1)); assert.equal(staged(1).internalStudentId, 'internal');
    assert.equal(staged(2).publicReportId, id(2).replace(/-/g, '')); assert.equal(staged(2).data.start, '17:00');
    assert.equal(staged(1).data.date, staged(2).data.date); assert.notEqual(staged(1).sourceId, staged(2).sourceId);
    assert.equal(staged(5).linkedDraftId, draftId);
    assert.equal(staged(3), undefined); assert.equal(staged(4), undefined); assert.equal(staged(6), undefined);
    const holds = [...f.rows.values()].filter((v: any) => v.code && v.status === 'open').map((v: any) => v.code).sort();
    assert.deepEqual(holds, ['AUTHOR_UNKNOWN', 'PUBLIC_REPORT_MISSING', 'STUDENT_LINK_MISSING']);
    assert.equal(job.result.ready, false); assert.equal(job.result.openHolds, 3);
    assert.ok([...f.rows.keys()].some(k => k.startsWith('lessonImportVersions/' + id(1))));
});

test('a second full run rewrites nothing for unchanged rows; dry-run never stages', async () => {
    const f = fixture([page(1)]); f.rows.set('lessonReports/' + id(1), report(1));
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); await drain(f);
    const staged = snapshot(f, 'lessonSourceRecords/'), versions = snapshot(f, 'lessonImportVersions/');
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); const job = await drain(f);
    assert.equal(snapshot(f, 'lessonSourceRecords/'), staged); assert.equal(snapshot(f, 'lessonImportVersions/'), versions);
    assert.equal(job.counts.unchanged, 1); assert.equal(job.result.ready, true); assert.match(job.result.evidence, /^[a-f0-9]{64}$/);
    const dry = fixture([page(1)]); dry.rows.set('lessonReports/' + id(1), report(1));
    await startLessonMigration(dry.db, admin, { confirmed: true, mode: 'dry-run' }); const d = await drain(dry);
    assert.equal(snapshot(dry, 'lessonSourceRecords/'), '[]'); assert.equal(d.counts.wouldStage, 1); assert.equal(d.result.ready, false);
});

test('acknowledged author gap stages without assigning anyone; non-acknowledgeable codes are refused', async () => {
    const f = fixture([page(4, { authors: ['99999999-9999-4999-8999-999999999999'] }), page(7, { students: ['33333333-3333-4333-8333-333333333333'] })]);
    f.rows.set('lessonReports/' + id(4), report(4));
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); await drain(f);
    const status = await lessonMigrationStatus(f.db, admin);
    const author = status.holds.find((h: any) => h.code === 'AUTHOR_UNKNOWN'), mapping = status.holds.find((h: any) => h.code === 'STUDENT_MAPPING');
    assert.ok(author.acknowledgeable); assert.equal(mapping.acknowledgeable, false);
    await assert.rejects(decideLessonMigrationHold(f.db, admin, { sourceKey: mapping.sourceKey, decision: 'acknowledge', confirmed: true }), /FORBIDDEN/);
    await assert.rejects(decideLessonMigrationHold(f.db, admin, { sourceKey: author.sourceKey, decision: 'acknowledge' }), /INVALID_INPUT/);
    await decideLessonMigrationHold(f.db, admin, { sourceKey: author.sourceKey, decision: 'acknowledge', confirmed: true });
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'recheck' }); await drain(f);
    assert.equal(f.rows.get('lessonSourceRecords/' + id(4)).ownerUid, '__unlinked_author__');
    assert.equal(f.rows.get('lessonMigrationHolds/' + author.sourceKey).status, 'acknowledged');
    assert.equal(f.rows.get('lessonMigrationHolds/' + mapping.sourceKey).status, 'open');
});

test('transient failures back off and resume from the saved cursor; permanent failures stop', async () => {
    const pages = Array.from({ length: 25 }, (_, i) => page(i + 1, { edited: `2026-09-01T00:${String(i).padStart(2, '0')}:00.000Z` }));
    const f = fixture(pages); for (let i = 1; i <= 25; i++) f.rows.set('lessonReports/' + id(i), report(i));
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' });
    f.fail('NOTION_503');
    let job = await runLessonMigration(f.db, admin, { notion: f.notion, budgetMs: 60000 });
    assert.equal(job.status, 'waiting'); assert.equal(job.attempts, 1); assert.ok(job.nextRunAt > Date.now()); assert.equal(job.lastError, 'NOTION_503');
    const calls = f.calls.length; job = await runLessonMigration(f.db, admin, { notion: f.notion }); assert.equal(job.idle, true); assert.equal(f.calls.length, calls);
    f.rows.get('lessonMigrationJobs/main').nextRunAt = 0;
    job = await runLessonMigration(f.db, admin, { notion: f.notion, budgetMs: 0 });
    assert.equal(f.rows.get('lessonMigrationJobs/main').cursor, '20'); assert.equal(Object.keys([...f.rows.keys()].filter(k => k.startsWith('lessonSourceRecords/'))).length, 20);
    job = await drain(f); assert.equal(job.status, 'completed'); assert.equal(job.counts.staged, 25);
    assert.equal(migrationBackoff(1), 30000); assert.equal(migrationBackoff(20), 1800000);
    assert.equal(transientMigrationError(Error('NOTION_429')), true); assert.equal(transientMigrationError(Error('NOTION_401')), false);
    const g = fixture([page(1)]); await startLessonMigration(g.db, admin, { confirmed: true, mode: 'full' }); g.fail('NOTION_401');
    job = await runLessonMigration(g.db, admin, { notion: g.notion, budgetMs: 60000 }); assert.equal(job.status, 'blocked');
    job = await runLessonMigration(g.db, admin, { notion: g.notion }); assert.equal(job.idle, true);
    await startLessonMigration(g.db, admin, { confirmed: true, mode: 'full' }); assert.equal((await drain(g)).status, 'completed');
});

test('the lease admits one runner; pause stops after the current batch; a different mode cannot replace a live run', async () => {
    const f = fixture([page(1)]); f.rows.set('lessonReports/' + id(1), report(1));
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' });
    const [a, b] = await Promise.all([runLessonMigration(f.db, admin, { notion: f.notion, budgetMs: 60000 }), runLessonMigration(f.db, admin, { notion: f.notion, budgetMs: 60000 })]);
    assert.equal([a, b].filter((j: any) => j.idle).length, 1);
    assert.equal(f.calls.filter(c => c.endsWith('/query')).length, 2);
    const g = fixture([page(1)]); await startLessonMigration(g.db, admin, { confirmed: true, mode: 'full' });
    await assert.rejects(startLessonMigration(g.db, admin, { confirmed: true, mode: 'dry-run' }), /LESSON_MIGRATION_RUNNING/);
    await pauseLessonMigration(g.db, admin); const job = await runLessonMigration(g.db, admin, { notion: g.notion }); assert.equal(job.idle, true); assert.equal(g.calls.length, 0);
    assert.equal((await startLessonMigration(g.db, admin, { confirmed: true, mode: 'full' })).status, 'running');
    await assert.rejects(startLessonMigration(g.db, { ...admin, admin: false }, { confirmed: true, mode: 'full' }), /FORBIDDEN/);
    await assert.rejects(runLessonMigration(g.db, { ...admin, academyId: 'other' }), /FORBIDDEN/);
});

test('newer source wins over an older staged copy and an edit during the scan is caught up', async () => {
    const pages = [page(1, { edited: '2026-09-01T00:00:00.000Z' })];
    const f = fixture(pages); f.rows.set('lessonReports/' + id(1), report(1, { feedback: '수업 내용 고침\n\n과제: 복습' }));
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' });
    await runLessonMigration(f.db, admin, { notion: f.notion, budgetMs: 0 });
    assert.equal(f.rows.get('lessonMigrationJobs/main').phase, 'scan');
    pages[0] = page(1, { edited: new Date(Date.now() + 1000).toISOString(), content: '수업 내용 고침\n\n과제: 복습' });
    const job = await drain(f);
    assert.equal(f.rows.get('lessonSourceRecords/' + id(1)).data.content, '수업 내용 고침');
    assert.ok(job.counts.seen >= 2);
    const stale = page(1, { edited: '2026-08-01T00:00:00.000Z', content: '옛 내용' });
    pages[0] = stale;
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); await drain(f);
    assert.equal(f.rows.get('lessonSourceRecords/' + id(1)).data.content, '수업 내용 고침');
});

test('a staged row whose source disappears is held, then hidden (not deleted) only after acknowledgement', async () => {
    const pages = [page(1)]; const f = fixture(pages); f.rows.set('lessonReports/' + id(1), report(1));
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); await drain(f);
    pages[0] = { ...pages[0], archived: true };
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); let job = await drain(f);
    const hold = (await lessonMigrationStatus(f.db, admin)).holds.find((h: any) => h.code === 'SOURCE_REMOVED');
    assert.ok(hold); assert.equal(job.result.ready, false); assert.equal(f.rows.get('lessonSourceRecords/' + id(1)).removed, false);
    await decideLessonMigrationHold(f.db, admin, { sourceKey: hold.sourceKey, decision: 'acknowledge', confirmed: true });
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); job = await drain(f);
    assert.equal(f.rows.get('lessonSourceRecords/' + id(1)).removed, true); assert.ok(f.rows.has('lessonSourceRecords/' + id(1)));
    assert.equal(job.result.ready, true);
});

test('unconfirmed Notion creations are settled by scan evidence; only in-flight writes and duplicate public identities hold', async () => {
    // id(901) has its Notion page (marker) in the source; id(902) has none; id(903) is publishing right now.
    const f = fixture([page(1), page(7, { marker: id(901) })]);
    f.rows.set('lessonReports/' + id(1), report(1)); f.rows.set('lessonReports/' + id(1).replace(/-/g, ''), report(1));
    f.rows.set('lessonReports/' + id(7), report(7, { teacherDraftId: id(901) }));
    const draft = (n: number, o: any = {}) => f.rows.set('teacherLessonDrafts/' + id(n), { ownerUid: 'teacher', academyId: 'main', stage: 'publishing', revision: 1, publishStartedAt: Date.now() - 600000, notionWrite: { attempted: true, done: false }, data: { studentKey: STUDENT, subject: '영어', date: '2026-09-02' }, ...o });
    draft(901); draft(902); draft(903, { publishStartedAt: Date.now() });
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); const job = await drain(f);
    const codes = [...f.rows.values()].filter((v: any) => v.status === 'open' && v.code).map((v: any) => v.code).sort();
    assert.deepEqual(codes, ['APP_WRITE_PENDING', 'DUPLICATE_PUBLIC']); assert.equal(job.result.ready, false);
    assert.equal(f.rows.get('lessonWriteEvidence/' + id(901)).result, 'source-page-found');
    assert.equal(f.rows.get('lessonWriteEvidence/' + id(902)).result, 'no-source-page');
    assert.equal(f.rows.has('lessonWriteEvidence/' + id(903)), false);
    for (const n of [901, 902, 903]) assert.equal(f.rows.get('teacherLessonDrafts/' + id(n)).stage, 'publishing');
});

test('cron entry refuses missing secret, stays idle at one read, and drives a started job', async () => {
    const f = fixture([page(1)]); f.rows.set('lessonReports/' + id(1), report(1));
    const send = () => { const out: any = { status: 0, body: null }; return { out, res: { statusCode: 0, setHeader() {}, end(v: string) { out.body = JSON.parse(v); }, writeHead(s: number) { out.status = s; } } as any }; };
    const old = process.env.CRON_SECRET; process.env.CRON_SECRET = 'x'.repeat(32);
    try {
        const a = send(); await handleLessonMigrationCron({ headers: {}, url: '/api/teacher/workspace?__cron=lesson-migration' } as any, a.res, () => ({ db: f.db }) as any);
        assert.equal(a.res.statusCode || a.out.status, 401);
        f.resetMetrics(); const idle = await runLessonMigrationCron(f.db, { notion: f.notion }); assert.equal(idle.idle, true); assert.equal(f.metrics.readDocuments, 1); assert.equal(f.metrics.queries, 0); assert.equal(f.metrics.writes, 0);
        await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' });
        for (let i = 0; i < 20 && f.rows.get('lessonMigrationJobs/main').status !== 'completed'; i++) await runLessonMigrationCron(f.db, { notion: f.notion, budgetMs: 60000 });
        assert.equal(f.rows.get('lessonMigrationJobs/main').status, 'completed'); assert.ok(f.rows.has('lessonSourceRecords/' + id(1)));
    } finally { if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old; }
});

test('browser driver only steps runnable jobs and waits for backoff or another runner', () => {
    assert.deepEqual(nextDriverAction(null), { kind: 'stop' });
    assert.deepEqual(nextDriverAction({ status: 'completed' }), { kind: 'stop' });
    assert.deepEqual(nextDriverAction({ status: 'paused' }), { kind: 'stop' });
    assert.deepEqual(nextDriverAction({ status: 'running' }), { kind: 'step' });
    assert.deepEqual(nextDriverAction({ status: 'running', busy: true }), { kind: 'wait', ms: 10000 });
    assert.deepEqual(nextDriverAction({ status: 'waiting', nextRunAt: 1000 + 5000 }, 1000), { kind: 'wait', ms: 5000 });
    assert.deepEqual(nextDriverAction({ status: 'waiting', nextRunAt: 500 }, 1000), { kind: 'step' });
});
