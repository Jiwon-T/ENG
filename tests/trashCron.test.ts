import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLessonMigrationCron } from '../api/teacher/workspace.ts';
import { templateFirestore } from './helpers/templateFirestore.js';
const run = async (db: any, auth = 'Bearer ' + 'x'.repeat(20)) => { let body: any; const res: any = { setHeader() {}, end: (s: string) => { body = JSON.parse(s); } }; await handleLessonMigrationCron({ headers: { authorization: auth } } as any, res, () => ({ db }) as any); return { status: res.statusCode, body }; };
test('daily trash job: reports success, and a failed purge as an error the scheduler can see', async () => {
    const saved = process.env.CRON_SECRET; process.env.CRON_SECRET = 'x'.repeat(20);
    try {
        const ok = await run(templateFirestore().db);
        assert.deepEqual([ok.status, ok.body.ok, ok.body.trashPurged], [200, true, 0]);
        const broken = await run({ collection: () => { throw Error('FIRESTORE_UNAVAILABLE'); } });
        assert.deepEqual([broken.status, broken.body.ok, broken.body.error], [500, false, 'LESSON_TRASH_PURGE_FAILED']);
        assert.equal((await run(templateFirestore().db, 'Bearer wrong')).status, 401);
    } finally { if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved; }
});
