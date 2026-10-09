import { withNotionUsageRoute, recordMakeWebhook } from '../_lib/notionUsage.js';
import { appSchedulesActive } from '../_lib/appSchedule.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import { NotionScheduleWebhookSchema, } from '../_lib/reportSchemas.js';
import { getSecretOrThrow } from '../_lib/security.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import { projectSchedule } from '../_lib/scheduleProjection.js';
export { generateScheduleDocId } from '../_lib/scheduleProjection.js';
export default function handler(req: IncomingMessage, res: ServerResponse) { return withNotionUsageRoute('webhook:schedule', () => routeHandler(req, res)); }
export async function routeHandler(req: IncomingMessage, res: ServerResponse, deps = { getFirebaseAdmin }) {
    try {
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST');
            return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
        }
        // 1) 웹훅 시크릿 인증: MAKE_NOTION_WEBHOOK_SECRET 재사용
        let expectedSecret: string;
        try {
            expectedSecret = getSecretOrThrow('MAKE_NOTION_WEBHOOK_SECRET', 32);
        }
        catch {
            return sendJson(res, 500, { ok: false, error: 'SERVER_CONFIG_ERROR' });
        }
        const providedSecret = req.headers['x-webhook-secret'];
        if (!providedSecret || providedSecret !== expectedSecret) {
            return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED_WEBHOOK' });
        }
        // 2) 바디 파싱 및 Zod 검증
        const rawBody = await parseJsonBody(req);
        const parsed = NotionScheduleWebhookSchema.safeParse(rawBody);
        if (!parsed.success) {
            return sendJson(res, 400, {
                ok: false,
                error: 'INVALID_PAYLOAD',
                details: parsed.error.issues.map(i => i.message),
            });
        }
        const data = parsed.data;
        const { db } = deps.getFirebaseAdmin();
        // After the verified schedule switch the app is authoritative; Notion copies never overwrite it.
        if (await appSchedulesActive(db, { academyId: 'main' })) { recordMakeWebhook('schedule', 'APP_AUTHORITY'); return sendJson(res, 200, { ok: true, applied: false, reason: 'APP_AUTHORITY' }); }
        const result = await projectSchedule(db, data);
        recordMakeWebhook('schedule', (result as any)?.applied === false ? ((result as any).reason || 'skipped') : 'applied');
        return sendJson(res, 200, { ok: true, notionScheduleId: data.notionScheduleId, ...result });
    }
    catch (err: any) {
        recordMakeWebhook('schedule', 'error');
        return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
    }
}
