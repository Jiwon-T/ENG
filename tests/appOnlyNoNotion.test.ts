import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWorkspace } from '../api/teacher/workspace.js';
import { teacherReadCache } from '../api/_lib/teacherReadCache.js';
import { templateFirestore } from './helpers/templateFirestore.js';

const S = '11111111-1111-4111-8111-111111111111', NOTION_SCHEDULE = '22222222-2222-4222-8222-222222222222';
function appOnly() {
    const f = templateFirestore();
    f.rows.set('academyCoreAuthority/main', { active: true });
    f.rows.set('academyClassAuthority/main', { active: true });
    f.rows.set('appScheduleAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 's', verificationHash: 'h' }); f.rows.set('scheduleVerificationRuns/s', { verified: true, academyId: 'main', hash: 'h' });
    f.rows.set('lessonAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'l', verificationHash: 'h' }); f.rows.set('lessonVerificationRuns/l', { verified: true, academyId: 'main', hash: 'h' });
    f.rows.set('teacherWorkspaceAccess/teacher', { academyId: 'main', scopes: [{ studentKey: S, subject: '영어' }], notionAssignmentStage: 'failed', notionAssignmentError: 'NOTION_502' });
    // A schedule imported from Notion at the switch (doc ID differs from its Notion page ID).
    f.rows.set('teacherSchedules/33333333-3333-4333-8333-333333333333', { ownerUid: 'teacher', academyId: 'main', notionPageId: NOTION_SCHEDULE, revision: 1, stage: 'published', sourceOrigin: 'notion-import', data: { title: '보강', subject: '영어', students: [S], date: '2026-10-09', start: '14:00', end: '15:00', kind: '보강', status: '예정', place: '', note: '' } });
    teacherReadCache.clear();
    return f;
}
const teacher = { uid: 'teacher', academyId: 'main', admin: false, principal: false, coreMode: true, scopes: [{ studentKey: S, subject: '영어' }], teachingScopes: [{ studentKey: S, subject: '영어' }] };
const admin = { uid: 'admin', academyId: 'main', admin: true, principal: false, coreMode: true, scopes: [], teachingScopes: [] };
async function call(db: any, actor: any, method: string, input: any) {
    let body: any; const res: any = { statusCode: 200, setHeader() {}, end(v: string) { body = JSON.parse(v); } };
    await handleWorkspace((method === 'GET' ? { method, url: '/api/teacher/workspace?' + new URLSearchParams(input), headers: {} } : { method, body: input, headers: {} }) as any, res, async () => ({ ...actor, db }));
    return { status: res.statusCode, ...body };
}
async function noNotion(fn: () => Promise<void>) {
    const original = globalThis.fetch; let calls = 0;
    globalThis.fetch = (async (url: any) => { if (String(url).includes('api.notion.com')) calls++; throw Error('NETWORK_BLOCKED'); }) as any;
    try { await fn(); } finally { globalThis.fetch = original; }
    assert.equal(calls, 0, 'Notion was called in app-only mode');
}

test('editing a Notion-born schedule after the switch opens the app record without Notion', async () => {
    const f = appOnly();
    await noNotion(async () => {
        const r = await call(f.db, teacher, 'POST', { action: 'import-source-record', id: NOTION_SCHEDULE, kind: 'schedule' });
        assert.equal(r.status, 200); assert.equal(r.record.id, '33333333-3333-4333-8333-333333333333'); assert.equal(r.record.data.title, '보강');
        assert.equal((await call(f.db, { ...teacher, uid: 'other' }, 'POST', { action: 'import-source-record', id: NOTION_SCHEDULE, kind: 'schedule' })).status, 403);
    });
});

test('Notion-only conflict tools are closed after the schedule switch', async () => {
    const f = appOnly();
    await noNotion(async () => {
        assert.equal((await call(f.db, teacher, 'GET', { action: 'schedule-conflict', id: NOTION_SCHEDULE })).error, 'SCHEDULE_APP_ACTIVE');
        assert.equal((await call(f.db, teacher, 'POST', { action: 'resolve-schedule-conflict', id: NOTION_SCHEDULE })).error, 'SCHEDULE_APP_ACTIVE');
    });
});

test('after the core cutover, retrying a stale Notion assignment failure clears it without writing Notion', async () => {
    const f = appOnly();
    await noNotion(async () => {
        assert.equal((await call(f.db, teacher, 'POST', { action: 'retry-teacher-assignment', uid: 'teacher' })).status, 403);
        const r = await call(f.db, admin, 'POST', { action: 'retry-teacher-assignment', uid: 'teacher' });
        assert.equal(r.status, 200); assert.equal(r.appOnly, true);
    });
    const p = f.rows.get('teacherWorkspaceAccess/teacher');
    assert.equal(p.notionAssignmentStage, 'not-needed'); assert.equal(p.notionAssignmentError, null);
    assert.deepEqual(p.scopes, [{ studentKey: S, subject: '영어' }], 'assignments themselves are untouched');
});

test('everyday lesson and schedule reads stay off Notion when every switch is on', async () => {
    const f = appOnly();
    await noNotion(async () => {
        for (const [method, input] of [
            ['GET', { action: 'academy-lessons', page: '1' }], ['GET', { action: 'academy-lessons', page: '1', period: 'all' }],
            ['GET', { action: 'schedule-records', day: '2026-10-09' }], ['GET', { action: 'schedule-options' }],
            ['POST', { action: 'previous-lesson', studentKey: S, subject: '영어', date: '2026-10-09' }],
        ] as const) {
            const r = await call(f.db, teacher, method, input);
            assert.equal(r.status, 200, `${method} ${input.action}: ${r.error || ''}`);
        }
    });
});

import { directorySourceKey, directoryRowKey, DIRECTORY_STATE } from '../api/_lib/academyDirectorySource.js';
test('first screen load stays off Notion in every section when every switch is on', async () => {
    const f = appOnly();
    f.rows.set('messageTemplateAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 't', verificationHash: 'h' }); f.rows.set('messageTemplateVerificationRuns/t', { verified: true, hash: 'h' });
    f.rows.set('academicAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'g', verificationHash: 'h' }); f.rows.set('academicVerificationRuns/g', { verified: true, hash: 'h' });
    // App student directory (after the core cutover) with one student.
    f.rows.set(DIRECTORY_STATE + '/' + directorySourceKey('students'), { ready: true, approved: true, runVersion: 1, leaseUntil: 0 });
    f.rows.set('academyDirectorySources/' + directoryRowKey('students', S), { sourceKey: directorySourceKey('students'), academyId: 'main', kind: 'students', entityId: S, notionPageId: S, fields: { properties: { 학생: { title: [{ plain_text: '학생' }] }, 보호자연락처: { phone_number: '01012345678' } } } });
    f.rows.set('academyStudentMemberships/' + S, { academyId: 'main' });
    await noNotion(async () => {
        const principal = { uid: 'boss', academyId: 'main', admin: false, principal: true, coreMode: true, scopes: [], teachingScopes: [] };
        f.rows.set('teacherWorkspaceAccess/boss', { academyId: 'main', workspaceRole: 'principal', scopes: [] });
        for (const actor of [teacher, admin, principal]) for (const section of ['all', 'lesson', 'students', 'schedule', 'curriculum', 'settings']) for (const action of ['bootstrap', 'bootstrap-fast']) {
            teacherReadCache.clear();
            const r = await call(f.db, actor, 'GET', { action, section, force: '1' });
            assert.equal(r.status, 200, `${actor.uid} ${action} ${section}: ${r.error || ''} ${r.failureStage || ''}`);
        }
    });
});
