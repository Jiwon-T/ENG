import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../_lib/http.ts';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.ts';
import type { StudentLessonReportDTO, StoredLessonReport } from '../_lib/reportSchemas.ts';
import crypto from 'crypto';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  try {
    const { auth, db } = getFirebaseAdmin();
    const decoded = await auth.verifyIdToken(token);
    const studentUid = decoded.uid;

    const reportsSnap = await db.collection('lessonReports')
      .where('studentId', '==', studentUid)
      .get();

    const storedReports: StoredLessonReport[] = [];
    reportsSnap.forEach(d => storedReports.push(d.data() as StoredLessonReport));
    storedReports.sort((a, b) => new Date(b.lessonDateStart).getTime() - new Date(a.lessonDateStart).getTime());

    // 학생용 제한 DTO: 피드백, 출결, 태도, 숙제, 자습시간 등 일체 미포함
    const studentDTOs: StudentLessonReportDTO[] = storedReports.map(r => ({
      reportId: crypto.createHash('sha256').update(r.notionPageId).digest('hex').slice(0, 16),
      lessonDate: r.lessonDateStart,
      category: r.category,
      vocabularyScore: r.vocabularyScore,
      schoolExamScore: r.schoolExamScore,
    }));

    return sendJson(res, 200, {
      ok: true,
      reports: studentDTOs,
    });
  } catch (err: any) {
    return sendJson(res, 401, { ok: false, error: 'INVALID_TOKEN' });
  }
}
