import test from 'node:test';
import assert from 'node:assert/strict';
import { startLessonMigration, lessonMigrationStatus, acknowledgeLessonMigrationHoldGroup, lessonMigrationCutoff, LESSON_MIGRATION_SINCE } from '../api/_lib/lessonMigration.js';
import { DB, id, admin, page, fixture, drain } from './helpers/lessonMigrationFixture.js';

function withCutoff(fn: () => Promise<void>) {
    return async () => { const before = lessonMigrationCutoff.since; lessonMigrationCutoff.since = LESSON_MIGRATION_SINCE; try { await fn(); } finally { lessonMigrationCutoff.since = before; } };
}
const oldLesson = (n: number, o: any = {}) => page(n, { date: '2026-09-19T14:00:00+09:00', ...o });
const newLesson = (n: number, o: any = {}) => page(n, { date: '2026-09-20T14:00:00+09:00', ...o });

test('the cutoff is 2026-09-20 and old lessons are excluded without reading their student relations', withCutoff(async () => {
    assert.equal(LESSON_MIGRATION_SINCE, '2026-09-20');
    const f = fixture([oldLesson(1), oldLesson(2, { students: [] }), newLesson(3, { sent: false })]);
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' });
    const job = await drain(f);
    assert.equal(job.status, 'completed');
    assert.ok(f.rows.has('lessonSourceRecords/' + id(3)), 'the lesson on the cutoff day is migrated');
    assert.ok(!f.rows.has('lessonSourceRecords/' + id(1)) && !f.rows.has('lessonSourceRecords/' + id(2)), 'older lessons stay in Notion only');
    assert.equal((await lessonMigrationStatus(f.db, admin)).openHolds, 0, 'an old lesson without a student is not a hold');
    assert.ok(!f.calls.some(c => c.includes(id(1)) && c.includes('/properties/')), 'no relation paging for old rows');
}));

test('when the database has date properties, Notion is asked only for lessons on or after the cutoff', withCutoff(async () => {
    const f = fixture([oldLesson(1), newLesson(2)]); const bodies: any[] = [];
    const notion = async (path: string, method = 'GET', body?: any) => {
        if (path === `databases/${DB}`) return { properties: { '타임 슬롯': { type: 'date' }, '수업 날짜': { type: 'rich_text' } } };
        if (path === `databases/${DB}/query`) bodies.push(body);
        return f.notion(path, method, body);
    };
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' });
    await drain({ ...f, notion });
    assert.deepEqual(bodies[0].filter, { property: '타임 슬롯', date: { on_or_after: '2026-09-20' } });
}));

test('"keep in Notion only" settles at once with no Notion read and stays settled on the next scan', withCutoff(async () => {
    const f = fixture([newLesson(1, { students: [] }), newLesson(2, { students: [] })]);
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' });
    await drain(f);
    assert.equal((await lessonMigrationStatus(f.db, admin)).openHolds, 2);
    const calls = f.calls.length;
    const r = await acknowledgeLessonMigrationHoldGroup(f.db, admin, { code: 'STUDENT_LINK_MISSING', confirmed: true });
    assert.equal(r.acknowledged, 2); assert.equal(f.calls.length, calls, 'no Notion call');
    assert.equal((await lessonMigrationStatus(f.db, admin)).openHolds, 0, 'visible immediately');
    // A later scan of the unchanged rows keeps them settled.
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); await drain(f);
    assert.equal((await lessonMigrationStatus(f.db, admin)).openHolds, 0);
}));
