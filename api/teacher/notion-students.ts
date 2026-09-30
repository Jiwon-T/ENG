import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../_lib/http.js';
import { verifyAdminAuth } from '../_lib/auth.js';
import { listNotionStudents } from '../_lib/notion.js';
import { hashStudentKey } from '../_lib/security.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import type { StoredNotionStudentMapping } from '../_lib/reportSchemas.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
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

    const { db } = getFirebaseAdmin();
    const notionStudents = await listNotionStudents();
    const students = await Promise.all(notionStudents.map(async student => {
      const mappingSnap = await db.collection('notionStudentMappings').doc(hashStudentKey(student.studentKey)).get();
      const mapping = mappingSnap.exists ? mappingSnap.data() as StoredNotionStudentMapping : null;
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
  } catch {
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
