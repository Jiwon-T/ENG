import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../_lib/http.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import { academicStudentId } from '../_lib/academicAuth.js';
import { loadAcademicData } from '../_lib/academic.js';
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  try {
    const student = await academicStudentId(req, 'student');
    return sendJson(res, 200, { ok: true, ...await loadAcademicData(getFirebaseAdmin().db, student) });
  } catch (error: any) {
    const status = error.message === 'UNAUTHORIZED' ? 401 : error.message === 'FORBIDDEN' ? 403 : 500;
    return sendJson(res, status, { ok: false, error: status === 500 ? 'ACADEMIC_QUERY_FAILED' : error.message });
  }
}
