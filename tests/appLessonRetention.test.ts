import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWorkspace } from '../api/teacher/workspace.js';
import { teacherReadCache } from '../api/_lib/teacherReadCache.js';
import { purgeExpiredLessonTrash } from '../api/_lib/appLessonRestore.js';
import { STUDENT, id, admin, sourceRecord, fixture, report } from './helpers/lessonAppFixture.js';

/*
 * Migrated lessons after the switch: a deletion is final once the trash is emptied (the migrated copy never
 * comes back), and an app edit that was published wins over the migrated copy in lists and '직전 수업'.
 */
const scope = [{ studentKey: STUDENT, subject: '영어' }];
const day = 86400000;
function appMode() {
    // Two lessons for the same student on the same day: identity, not student+date, decides what is deleted.
    const f = fixture([sourceRecord(1, { round: 1, date: '2026-09-21T14:00:00+09:00' }), sourceRecord(2, { round: 2, date: '2026-09-21T14:00:00+09:00', time: '17:00 ~ 18:20' })]);
    f.rows.set('lessonReports/' + id(1), report(1, { lessonDateStart: '2026-09-21T14:00:00+09:00' }));
    f.rows.set('lessonReports/' + id(2), report(2, { lessonDateStart: '2026-09-21T17:00:00+09:00' }));
    f.rows.get('teacherWorkspaceAccess/teacher').scopes = scope;
    teacherReadCache.clear();
    const teacher = { uid: 'teacher', academyId: 'main', admin: false, principal: false, scopes: scope, teachingScopes: scope };
    const boss = { ...admin, teachingScopes: [] };
    const call = async (actor: any, method: string, input: any) => {
        let body: any; const res: any = { statusCode: 200, setHeader: () => {}, end: (v: string) => body = JSON.parse(v) };
        await handleWorkspace((method === 'GET' ? { method, url: '/api/teacher/workspace?' + new URLSearchParams(input), headers: {} } : { method, body: input, headers: {} }) as any, res, async () => ({ ...actor, db: f.db }));
        return { status: res.statusCode, ...body };
    };
    const listed = async (actor: any = teacher) => (await call(actor, 'GET', { action: 'academy-lessons', force: '1' })).records.map((r: any) => r.id).sort();
    return { ...f, teacher, boss, call, listed };
}

test('a deleted migrated lesson stays deleted after the trash is emptied; restore within 7 days brings it back', async () => {
    const f = appMode();
    await f.call(f.teacher, 'POST', { action: 'import-source-record', id: id(1), kind: 'lesson' });
    const archived = await f.call(f.teacher, 'POST', { action: 'archive-lesson', id: id(1), revision: 1 });
    assert.equal(archived.archived, true);
    assert.equal(f.rows.get('lessonSourceRecords/' + id(1)).appDeleted.draftId, id(1), 'the migrated copy is marked in the same transaction');
    assert.equal(f.rows.get('lessonSourceRecords/' + id(2)).appDeleted, undefined, 'the other lesson that day is untouched');
    assert.deepEqual(await f.listed(), [id(2)]);

    // Restore inside the trash period clears the mark.
    const rev = f.rows.get('teacherLessonDrafts/' + id(1)).revision;
    const restored = await f.call(f.teacher, 'POST', { action: 'restore-lesson', id: id(1), revision: rev, confirmed: true });
    assert.equal(restored.restored, true); assert.equal(f.rows.get('lessonSourceRecords/' + id(1)).appDeleted, null);
    assert.deepEqual(await f.listed(), [id(1), id(2)]);

    // Delete again and empty the trash 8 days later.
    await f.call(f.teacher, 'POST', { action: 'archive-lesson', id: id(1), revision: f.rows.get('teacherLessonDrafts/' + id(1)).revision });
    const purged = await purgeExpiredLessonTrash(f.db, Date.now() + 8 * day);
    assert.equal(purged.purged, 1); assert.equal(f.rows.has('teacherLessonDrafts/' + id(1)), false);
    assert.ok(f.rows.has('lessonSourceRecords/' + id(1)), 'the migrated copy is kept as history');
    assert.ok(f.rows.get('lessonSourceRecords/' + id(1)).appDeleted, 'and stays marked');

    assert.deepEqual(await f.listed(), [id(2)], 'not listed again');
    assert.deepEqual(await f.listed(f.boss), [id(2)], 'not listed for the admin either');
    assert.equal((await f.call(f.teacher, 'POST', { action: 'import-source-record', id: id(1), kind: 'lesson' })).status, 403, 'cannot be re-imported as a draft');
    assert.equal(f.rows.has('teacherLessonDrafts/' + id(1)), false);
    const previous = await f.call(f.teacher, 'POST', { action: 'previous-lesson', studentKey: STUDENT, subject: '영어', date: '2026-09-30' });
    assert.deepEqual(previous.data.sessionRecords.map((r: any) => r.id), [id(2)], 'and does not count in 직전 수업/회차');
});

test('a lesson deleted before the mark existed is marked when the trash is emptied', async () => {
    const f = appMode(), old = Date.now() - 9 * day;
    f.rows.set('teacherLessonDrafts/' + id(1), { ownerUid: 'teacher', academyId: 'main', revision: 2, stage: 'archived', archived: true, notionPageId: id(1), data: { studentKey: STUDENT, subject: '영어', date: '2026-09-21' }, updatedAt: old });
    assert.equal((await purgeExpiredLessonTrash(f.db)).purged, 1);
    assert.deepEqual(f.rows.get('lessonSourceRecords/' + id(1)).appDeleted, { draftId: id(1), at: old });
    assert.equal(f.rows.get('lessonSourceRecords/' + id(2)).appDeleted, undefined);
    assert.deepEqual(await f.listed(), [id(2)]);
});

test('a published app edit wins over the migrated copy in the list and in 직전 수업, for the author and the admin', async () => {
    const f = appMode();
    const imported = await f.call(f.teacher, 'POST', { action: 'import-source-record', id: id(1), kind: 'lesson' });
    const data = { ...imported.record.data, content: '앱 수정', end: '16:00', round: 1.5, attitude: '상', homework: '상', test: '상' };
    const saved = await f.call(f.teacher, 'POST', { action: 'save-draft', id: id(1), revision: 1, data });
    assert.equal(saved.ok, true);
    assert.equal((await f.call(f.teacher, 'POST', { action: 'publish', id: id(1) })).stage, 'published');

    for (const actor of [f.teacher, f.boss]) {
        const row = (await f.call(actor, 'GET', { action: 'academy-lessons', force: '1' })).records.find((r: any) => r.id === id(1));
        assert.equal(row.data.content, '앱 수정'); assert.equal(row.data.end, '16:00'); assert.equal(row.data.round, 1.5);
        assert.equal(row.ownerUid, 'teacher', 'the author is kept');
    }
    const previous = await f.call(f.boss, 'POST', { action: 'previous-lesson', studentKey: STUDENT, subject: '영어', date: '2026-09-21' });
    assert.equal(previous.ok, true);
    const session = previous.data.sessionRecords.find((r: any) => r.id === id(1));
    assert.equal(session.data.end, '16:00'); assert.equal(session.data.round, 1.5);

    // A later unpublished edit is the author's private draft: the admin keeps seeing the published values.
    const rev = f.rows.get('teacherLessonDrafts/' + id(1)).revision;
    assert.equal((await f.call(f.teacher, 'POST', { action: 'save-draft', id: id(1), revision: rev, data: { ...data, content: '비공개 메모', end: '16:30' } })).ok, true);
    const after = await f.call(f.boss, 'POST', { action: 'previous-lesson', studentKey: STUDENT, subject: '영어', date: '2026-09-21' });
    const kept = after.data.sessionRecords.find((r: any) => r.id === id(1));
    assert.equal(kept.data.end, '16:00', 'the last published values stay; the unpublished edit is not shown'); assert.equal(kept.data.round, 1.5);
});
