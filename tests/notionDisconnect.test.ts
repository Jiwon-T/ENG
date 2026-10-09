import test from 'node:test';
import assert from 'node:assert/strict';
import { templateFirestore } from './helpers/templateFirestore.js';
import { notionArea, withNotionUsageRoute, setNotionUsageRoute, recordNotionCall, recordMakeWebhook, captureNotionUsage, kstDay } from '../api/_lib/notionUsage.js';
import { notionDisconnectStatus } from '../api/_lib/notionDisconnect.js';
import { gradeNotion } from '../api/_lib/teacherAcademicNotion.js';
import { routeHandler as scheduleWebhook } from '../api/webhooks/notion-schedule.js';

const admin = { uid: 'admin', admin: true, academyId: 'main' };

test('Notion paths map to areas without storing any page ID', () => {
    assert.equal(notionArea('databases/ab289f5b-1cf5-4160-809e-10d268c9c385/query'), 'lesson');
    assert.equal(notionArea('databases/ab289f5b1cf54160809e10d268c9c385'), 'lesson');
    assert.equal(notionArea('databases/fa6ce5a8-9572-4f4d-80d9-4d1485d44e6f/query'), 'grade');
    assert.equal(notionArea('pages/11111111-1111-4111-8111-111111111111'), 'page');
    assert.equal(notionArea('users/me'), 'other');
    const old = process.env.NOTION_STUDENT_DATABASE_ID; process.env.NOTION_STUDENT_DATABASE_ID = '99999999-9999-4999-8999-999999999999';
    try { assert.equal(notionArea('databases/99999999999949998999999999999999/query'), 'directory'); } finally { if (old === undefined) delete process.env.NOTION_STUDENT_DATABASE_ID; else process.env.NOTION_STUDENT_DATABASE_ID = old; }
});

test('every Notion call is labeled with the request route; real clients report through the counter', async () => {
    const seen: any[] = []; captureNotionUsage(e => seen.push(e));
    const original = globalThis.fetch, token = process.env.NOTION_INTEGRATION_TOKEN;
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ results: [] }), headers: { get: () => null } })) as any;
    process.env.NOTION_INTEGRATION_TOKEN = 'test-token';
    try {
        recordNotionCall('databases/ab289f5b1cf54160809e10d268c9c385/query');
        await withNotionUsageRoute('workspace:post', async () => { setNotionUsageRoute('workspace:previous-lesson'); await gradeNotion('databases/ab289f5b-1cf5-4160-809e-10d268c9c385/query', 'POST', {}); });
        recordMakeWebhook('lesson', 'APP_AUTHORITY');
    } finally { globalThis.fetch = original; captureNotionUsage(null); if (token === undefined) delete process.env.NOTION_INTEGRATION_TOKEN; else process.env.NOTION_INTEGRATION_TOKEN = token; }
    assert.deepEqual(seen, [{ notion: { unlabeled: { lesson: 1 } } }, { notion: { 'workspace:previous-lesson': { lesson: 1 } } }, { webhook: { lesson: { APP_AUTHORITY: 1 } } }]);
});

test('readiness reflects each switch and the last 7 days of usage; Notion token stays waiting while app routes still call Notion', async () => {
    const f = templateFirestore(), today = kstDay();
    f.rows.set('notionUsage/' + today, { day: today, notion: { 'workspace:previous-lesson': { lesson: 4 }, 'workspace:integrity-audit': { lesson: 2 } }, webhook: { lesson: { APP_AUTHORITY: 3 }, academic: { applied: 2 } } });
    f.rows.set('notionUsage/2020-01-01', { notion: { 'workspace:bootstrap': { directory: 999 } } });
    await assert.rejects(notionDisconnectStatus(f.db, { ...admin, admin: false }), /FORBIDDEN/);
    let s = await notionDisconnectStatus(f.db, admin);
    assert.equal(s.areas.find((a: any) => a.key === 'lesson').appOnly, false);
    assert.equal(s.areas.find((a: any) => a.key === 'grade').notionEditsApplied, 2);
    assert.equal(s.usage.days[0].notion, 6); assert.equal(s.usage.days.reduce((n: number, d: any) => n + d.notion, 0), 6, 'older than 7 days is ignored');
    const step = (k: string) => s.steps.find((x: any) => x.key === k);
    assert.equal(step('make-lesson').ready, false); assert.equal(step('make-lesson').blockedAfterSwitch, 3);
    assert.equal(step('notion-token').ready, false);
    assert.deepEqual(step('notion-token').remainingRoutes.map((r: any) => r.route), ['workspace:previous-lesson'], 'admin diagnostics are allowed to remain');
    // Switch everything on (with their real verification records) and remove the remaining app route.
    f.rows.set('academyCoreAuthority/main', { active: true }); f.rows.set('academyClassAuthority/main', { active: true });
    f.rows.set('appScheduleAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 's', verificationHash: 'h' }); f.rows.set('scheduleVerificationRuns/s', { verified: true, academyId: 'main', hash: 'h' });
    f.rows.set('lessonAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'l', verificationHash: 'h' }); f.rows.set('lessonVerificationRuns/l', { verified: true, academyId: 'main', hash: 'h' });
    f.rows.set('messageTemplateAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 't', verificationHash: 'h' }); f.rows.set('messageTemplateVerificationRuns/t', { verified: true, hash: 'h' });
    f.rows.set('academicAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'g', verificationHash: 'h' }); f.rows.set('academicVerificationRuns/g', { verified: true, hash: 'h' });
    f.rows.get('notionUsage/' + today).notion = { 'workspace:integrity-audit': { lesson: 2 } };
    s = await notionDisconnectStatus(f.db, admin);
    assert.ok(s.areas.every((a: any) => a.appOnly)); assert.ok(s.steps.every((x: any) => x.ready));
    assert.equal(f.metrics.writes, 0, 'status only reads');
});

test('after the schedule switch, Make schedule deliveries are refused before touching any schedule', async () => {
    const f = templateFirestore(), old = process.env.MAKE_NOTION_WEBHOOK_SECRET, secret = 's'.repeat(40);
    process.env.MAKE_NOTION_WEBHOOK_SECRET = secret;
    f.rows.set('appScheduleAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 's', verificationHash: 'h' }); f.rows.set('scheduleVerificationRuns/s', { verified: true, academyId: 'main', hash: 'h' });
    const seen: any[] = []; captureNotionUsage(e => seen.push(e));
    try {
        let body: any; const res: any = { statusCode: 0, setHeader() {}, end(v: string) { body = JSON.parse(v); } };
        const payload = { notionScheduleId: '22222222-2222-4222-8222-222222222222', notionStudentPageIds: ['11111111-1111-4111-8111-111111111111'], title: '보강', startAt: '2026-10-08T14:50:00+09:00', endAt: '2026-10-08T16:10:00+09:00', subject: '영어', scheduleType: '기타', status: '예정', notice: '', sourceUpdatedAt: '2026-10-08T00:00:00.000Z' };
        await scheduleWebhook({ method: 'POST', headers: { 'x-webhook-secret': secret }, body: payload } as any, res, { getFirebaseAdmin: () => ({ db: f.db }) } as any);
        assert.equal(res.statusCode, 200); assert.equal(body.reason, 'APP_AUTHORITY');
        assert.equal([...f.rows.keys()].filter(k => !/Authority|VerificationRuns/.test(k)).length, 0, 'nothing written');
        assert.deepEqual(seen, [{ webhook: { schedule: { APP_AUTHORITY: 1 } } }]);
    } finally { captureNotionUsage(null); if (old === undefined) delete process.env.MAKE_NOTION_WEBHOOK_SECRET; else process.env.MAKE_NOTION_WEBHOOK_SECRET = old; }
});
