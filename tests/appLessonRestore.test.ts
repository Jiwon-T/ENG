import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { handleWorkspace } from '../api/teacher/workspace.js';
import { startLessonMigration } from '../api/_lib/lessonMigration.js';
import { activateLessonApp, deactivateLessonApp } from '../api/_lib/lessonAuthority.js';
import { teacherReadCache } from '../api/_lib/teacherReadCache.js';
import { studentLessonDTO } from '../api/_lib/reportAudienceDTO.js';
import { STUDENT, id, admin, page, fixture, drain, report } from './helpers/lessonMigrationFixture.js';

const scope = [{ studentKey: STUDENT, subject: '영어' }];
const lesson = { studentKey: STUDENT, subject: '영어', date: '2026-10-09', start: '14:00', end: '15:20', classSession: '있음', round: 7, selfStudy: '없음', attendance: '출석', attitude: '상', homework: '상', test: '상', content: '앱 수업', assignment: '복습', note: '', nextPlan: '', correct: 9, total: 10 };
async function appMode() {
    const f = fixture([page(1, { date: '2026-09-01T14:00:00+09:00' })]);
    f.rows.set('lessonReports/' + id(1), report(1));
    f.rows.set('academyCoreAuthority/main', { active: true });
    f.rows.get('teacherWorkspaceAccess/teacher').scopes = scope;
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); await drain(f); await activateLessonApp(f.db, admin, { confirmed: true });
    teacherReadCache.clear();
    const teacher = { uid: 'teacher', academyId: 'main', admin: false, principal: false, scopes: scope, teachingScopes: scope };
    const principal = { uid: 'boss', academyId: 'main', admin: false, principal: true, scopes: [], teachingScopes: [] };
    const call = async (actor: any, method: string, input: any) => {
        let body: any; const res: any = { statusCode: 200, setHeader: () => {}, end: (v: string) => body = JSON.parse(v) };
        await handleWorkspace((method === 'GET' ? { method, url: '/api/teacher/workspace?' + new URLSearchParams(input), headers: {} } : { method, body: input, headers: {} }) as any, res, async () => ({ ...actor, db: f.db }));
        return { status: res.statusCode, ...body };
    };
    return { ...f, teacher, principal, call };
}
const snap = (f: any, prefix: string) => JSON.stringify([...f.rows].filter(([k]) => k.startsWith(prefix)).sort());

test('a deleted app lesson comes back with the same public report ID, reportIdentity and student-facing report number', async () => {
    const f = await appMode();
    const saved = await f.call(f.teacher, 'POST', { action: 'save-draft', data: lesson });
    await f.call(f.teacher, 'POST', { action: 'publish', id: saved.id });
    const before = structuredClone(f.rows.get('lessonReports/app-' + saved.id)), reportId = studentLessonDTO(before).reportId;
    const rev = f.rows.get('teacherLessonDrafts/' + saved.id).revision;
    await f.call(f.teacher, 'POST', { action: 'archive-lesson', id: saved.id, revision: rev });
    assert.equal(f.rows.has('lessonReports/app-' + saved.id), false);
    const list = await f.call(f.principal, 'GET', { action: 'archived-lessons' });
    assert.equal(list.appMode, true); assert.equal(list.records[0].id, saved.id); assert.equal(list.records[0].publicRestore, true);
    const archivedRev = f.rows.get('teacherLessonDrafts/' + saved.id).revision;
    assert.equal((await f.call(f.teacher, 'POST', { action: 'restore-lesson', id: saved.id, revision: archivedRev })).error, 'INVALID_INPUT');
    assert.equal((await f.call(f.teacher, 'POST', { action: 'restore-lesson', id: saved.id, revision: archivedRev + 5, confirmed: true })).error, 'DRAFT_CONFLICT');
    const restored = await f.call(f.principal, 'POST', { action: 'restore-lesson', id: saved.id, revision: archivedRev, confirmed: true });
    assert.equal(restored.publicRestored, true);
    const pub = f.rows.get('lessonReports/app-' + saved.id), draft = f.rows.get('teacherLessonDrafts/' + saved.id);
    assert.equal(pub.reportIdentity, before.reportIdentity); assert.equal(studentLessonDTO(pub).reportId, reportId); assert.equal(pub.feedback, before.feedback);
    assert.equal(draft.archived, false); assert.equal(draft.stage, 'published'); assert.equal(draft.revision, archivedRev + 1); assert.equal(pub.teacherAppRevision, draft.revision);
    assert.ok(f.rows.has(`lessonAppHistory/${saved.id}:${draft.revision}:restore`));
    const writes = f.metrics.writes;
    assert.equal((await f.call(f.principal, 'POST', { action: 'restore-lesson', id: saved.id, revision: draft.revision, confirmed: true })).alreadyRestored, true); assert.equal(f.metrics.writes, writes);
    // The restored lesson keeps working normally: edit and publish again in place.
    await f.call(f.teacher, 'POST', { action: 'save-draft', id: saved.id, revision: draft.revision, data: { ...lesson, content: '복원 후 수정' } });
    assert.equal((await f.call(f.teacher, 'POST', { action: 'publish', id: saved.id })).stage, 'published');
    assert.match(f.rows.get('lessonReports/app-' + saved.id).feedback, /복원 후 수정/);
    assert.equal(f.rows.get('lessonReports/app-' + saved.id).reportIdentity, before.reportIdentity);
});

test('a deleted migrated lesson returns to its original Notion public ID; an occupied ID is never overwritten', async () => {
    const f = await appMode();
    await f.call(f.teacher, 'POST', { action: 'import-source-record', id: id(1), kind: 'lesson' });
    await f.call(f.teacher, 'POST', { action: 'archive-lesson', id: id(1), revision: 1 });
    const rev = f.rows.get('teacherLessonDrafts/' + id(1)).revision;
    f.rows.set('lessonReports/' + id(1), { internalStudentId: 'other', note: 'appeared later' });
    const before = snap(f, 'lessonReports/') + snap(f, 'teacherLessonDrafts/');
    assert.equal((await f.call(f.teacher, 'POST', { action: 'restore-lesson', id: id(1), revision: rev, confirmed: true })).error, 'SOURCE_IDENTITY_LOCKED');
    assert.equal(snap(f, 'lessonReports/') + snap(f, 'teacherLessonDrafts/'), before);
    f.rows.delete('lessonReports/' + id(1));
    const ok = await f.call(f.teacher, 'POST', { action: 'restore-lesson', id: id(1), revision: rev, confirmed: true });
    assert.equal(ok.publicRestored, true); assert.equal(f.rows.get('lessonReports/' + id(1)).reportIdentity, 'public-1');
});

test('a lesson deleted before the switch comes back as a private draft; permissions and mode are enforced', async () => {
    const f = await appMode(), legacy = randomUUID();
    f.rows.set('teacherLessonDrafts/' + legacy, { ownerUid: 'teacher', academyId: 'main', revision: 4, stage: 'archived', archived: true, deleteRequested: true, notionPageId: randomUUID(), data: lesson, updatedAt: 1 });
    const reports = snap(f, 'lessonReports/');
    const other = { ...f.teacher, uid: 'other' };
    assert.equal((await f.call(other, 'POST', { action: 'restore-lesson', id: legacy, revision: 4, confirmed: true })).status, 403);
    assert.equal((await f.call(other, 'GET', { action: 'archived-lessons' })).records.length, 0);
    const r = await f.call(f.teacher, 'POST', { action: 'restore-lesson', id: legacy, revision: 4, confirmed: true });
    assert.equal(r.publicRestored, false); assert.equal(snap(f, 'lessonReports/'), reports, 'no public report appears by itself');
    const d = f.rows.get('teacherLessonDrafts/' + legacy);
    assert.equal(d.stage, 'draft'); assert.equal(d.archived, false); assert.equal(d.deleteRequested, false); assert.equal(d.revision, 5);
    await deactivateLessonApp(f.db, admin, { confirmed: true });
    assert.equal((await f.call(f.teacher, 'POST', { action: 'restore-lesson', id: legacy, revision: 5, confirmed: true })).error, 'LESSON_APP_REQUIRED');
    assert.equal((await f.call(f.teacher, 'GET', { action: 'archived-lessons' })).appMode, false);
});
