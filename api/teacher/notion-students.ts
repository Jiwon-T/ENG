import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'node:crypto';
import { sendJson } from '../_lib/http.js';
import { verifyAdminAuth } from '../_lib/auth.js';
import { listNotionStudents } from '../_lib/notion.js';
import { readDirectoryStudentMapping } from '../_lib/studentIdentity.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  let failureStage = 'initialization';
  const diagnosticId = randomUUID();
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
      await verifyAdminAuth(req);
    } catch (err: any) {
      return sendJson(res, err.message === 'FORBIDDEN' ? 403 : 401, {
        ok: false,
        error: err.message === 'FORBIDDEN' ? 'FORBIDDEN_ADMIN_ONLY' : 'UNAUTHORIZED',
      });
    }

    failureStage = 'notion_query';
    const notionStudents = await listNotionStudents();
    failureStage = 'student_mapping';
    const { db } = getFirebaseAdmin();
    const students = [];
    // Bound read concurrency; GET must never migrate or update links.
    for (let offset = 0; offset < notionStudents.length; offset += 4) {
      const batch = await Promise.all(notionStudents.slice(offset, offset + 4).map(async student => {
        const mapping = await readDirectoryStudentMapping(db, student.studentKey);
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
      students.push(...batch);
    }

    return sendJson(res, 200, { ok: true, students });
  } catch (err: any) {
    console.error('STUDENT_DIRECTORY_FAILED', {
      diagnosticId, stage: failureStage, code: 'SERVER_ERROR', sdkCode: err?.code,
      upstreamStatus: /NOTION_.*FAILED: (\d+)/.exec(String(err?.message || ''))?.[1],
    });
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR', diagnosticId, failureStage });
  }
}
