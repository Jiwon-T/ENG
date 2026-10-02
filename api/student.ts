import type { IncomingMessage, ServerResponse } from 'http';
import { apiEndpoint } from './_lib/apiEndpoint.js';
import { sendJson } from './_lib/http.js';
import h0 from './_lib/student/lesson-reports.js';
import h1 from './_lib/student/schedules.js';
import h2 from './_lib/student/academic.js';
import h3 from './_lib/student/assignment-completion.js';
const handlers = {
  'lesson-reports': h0,
  'schedules': h1,
  'academic': h2,
  'assignment-completion': h3
};
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const endpoint = apiEndpoint(req.url, 'student');
  if (!Object.hasOwn(handlers, endpoint)) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
  return handlers[endpoint as keyof typeof handlers](req, res);
}
