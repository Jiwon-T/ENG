import { withNotionUsageRoute, recordMakeWebhook } from '../_lib/notionUsage.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../_lib/http.js';
import { verifyAdminAuth } from '../_lib/auth.js';
import { listNotionStudents } from '../_lib/notion.js';
import { readStudentDirectoryMappings } from '../_lib/studentDirectoryMappings.js';
import { randomUUID } from 'node:crypto';
import { studentDirectoryError } from '../_lib/studentDirectoryError.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import { coreActive } from '../_lib/academyCore.js';
import { readDirectoryStudents } from '../_lib/academyDirectorySource.js';

export default function handler(req: IncomingMessage, res: ServerResponse) { return withNotionUsageRoute('notion-students', () => routeHandler(req, res)); }
async function routeHandler(req: IncomingMessage, res: ServerResponse) {
  return handleStudentDirectory(req, res);
}
/** After the student/teacher cutover the roster (including app-registered students) comes from the app directory. */
export async function handleStudentDirectory(req: IncomingMessage, res: ServerResponse, deps = { verifyAdminAuth, getFirebaseAdmin, listNotionStudents }) {
  const diagnosticId = randomUUID();
  let stage = 'authentication';
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
      await deps.verifyAdminAuth(req);
    } catch (err: any) {
      if (!['FORBIDDEN', 'UNAUTHORIZED', 'INVALID_TOKEN'].includes(err.message)) throw err;
      return sendJson(res, err.message === 'FORBIDDEN' ? 403 : 401, {
        ok: false,
        error: err.message === 'FORBIDDEN' ? 'FORBIDDEN_ADMIN_ONLY' : 'UNAUTHORIZED',
      });
    }

    stage = 'firebase_initialization';
    const { db } = deps.getFirebaseAdmin();
    const core = await coreActive(db, { academyId: 'main' });
    stage = core ? 'directory_query' : 'notion_query';
    const notionStudents = core ? await readDirectoryStudents(db, { uid: 'admin', academyId: 'main', admin: true, coreMode: true }) : await deps.listNotionStudents();
    stage = 'student_mapping';
    const mappings = await readStudentDirectoryMappings(db);
    const students = await Promise.all(notionStudents.map(async student => {
      const mapping = mappings.get(student.studentKey);
      let reportSlug: string | null = null;
      if (mapping?.internalStudentId) {
        const reportMapping = await db.collection('studentReportMappings').doc(mapping.internalStudentId).get();
        reportSlug = reportMapping.exists ? reportMapping.data()?.activeReportSlug || null : null;
      }
      return {
        studentKey: student.studentKey,
        studentDisplayName: student.studentDisplayName,
        hasGuardianContact: student.hasGuardianContact,
        enrollmentStatus: student.enrollmentStatus,
        linkedFirebaseUid: mapping?.firebaseUid || null,
        reportSlug,
      };
    }));

    return sendJson(res, 200, { ok: true, students });
  } catch (error) {
    const failure = studentDirectoryError(error);
    // Only allowlisted diagnostics: never log tokens, contacts, IDs or raw SDK messages.
    console.error('STUDENT_DIRECTORY_FAILED', { diagnosticId, stage, code: failure.error, sdkCode: typeof (error as any)?.code === 'number' ? (error as any).code : undefined, upstreamStatus: 'upstreamStatus' in failure ? failure.upstreamStatus : undefined });
    return sendJson(res, 500, { ok: false, ...failure, diagnosticId, failureStage: stage });
  }
}
