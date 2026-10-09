import { withNotionUsageRoute, recordMakeWebhook } from './_lib/notionUsage.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { apiEndpoint } from './_lib/apiEndpoint.js';
import { sendJson } from './_lib/http.js';
import h0 from './_lib/parent/verify-pin.js';
import h1 from './_lib/parent/lesson-reports.js';
import h2 from './_lib/parent/report-status.js';
import h3 from './_lib/parent/schedules.js';
import h4 from './_lib/parent/academic.js';
const handlers = {
  'verify-pin': h0,
  'lesson-reports': h1,
  'report-status': h2,
  'schedules': h3,
  'academic': h4
};
export default function handler(req: IncomingMessage, res: ServerResponse) { return withNotionUsageRoute('parent', () => routeHandler(req, res)); }
async function routeHandler(req: IncomingMessage, res: ServerResponse) {
  const endpoint = apiEndpoint(req.url, 'parent');
  if (!Object.hasOwn(handlers, endpoint)) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
  return handlers[endpoint as keyof typeof handlers](req, res);
}
