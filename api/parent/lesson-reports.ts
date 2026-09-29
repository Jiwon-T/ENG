import type { IncomingMessage, ServerResponse } from 'http';
import { parseCookies, sendJson } from '../_lib/http.js';
import { getVerifiedParentSession } from '../_lib/session.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import type { ParentLessonReportDTO, StoredLessonReport } from '../_lib/reportSchemas.js';
import crypto from 'crypto';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const cookies = parseCookies(req);
    const sessionToken = cookies['parent_session'];

    if (!sessionToken) {
      return sendJson(res, 401, { ok: false, error: 'AUTH_REQUIRED', message: '보호자 인증이 필요합니다.' });
    }

    // getVerifiedParentSession에서 active==true 및 authVersion 일치까지 함께 검증
    const session = await getVerifiedParentSession(sessionToken);
    if (!session) {
      return sendJson(res, 401, {
        ok: false,
        error: 'SESSION_EXPIRED',
        message: '세션이 만료되었거나 비활성화되었습니다. 다시 인증해 주세요.',
      });
    }

    // 접속한 reportSlug와 세션이 결속되어 있는지 검증
    const url = new URL(req.url || '', 'http://localhost');
    const requestedSlug = url.searchParams.get('reportSlug');
    if (requestedSlug && session.reportSlug !== requestedSlug) {
      return sendJson(res, 403, { ok: false, error: 'SESSION_MISMATCH', message: '다른 학생의 주소에는 접근할 수 없습니다.' });
    }

    const { db } = getFirebaseAdmin();
    // internalStudentId 기준으로 수업 일지 조회
    const reportsSnap = await db.collection('lessonReports')
      .where('internalStudentId', '==', session.internalStudentId)
      .get();

    const storedReports: StoredLessonReport[] = [];
    reportsSnap.forEach(d => storedReports.push(d.data() as StoredLessonReport));

    // 최신 수업순 정렬
    storedReports.sort((a, b) => new Date(b.lessonDateStart).getTime() - new Date(a.lessonDateStart).getTime());

    // 학부모 전용 DTO 변환 (내부 notionPageId 원본 대신 안전한 해시 ID 전달)
    const parentDTOs: ParentLessonReportDTO[] = storedReports.map(r => ({
      reportId: crypto.createHash('sha256').update(r.notionPageId).digest('hex').slice(0, 16),
      lessonDateStart: r.lessonDateStart,
      lessonDateEnd: r.lessonDateEnd,
      lessonTime: r.lessonTime,
      selfStudyTime: r.selfStudyTime,
      category: r.category,
      attendance: r.attendance,
      attitude: r.attitude,
      homework: r.homework,
      test: r.test,
      vocabularyScore: r.vocabularyScore,
      schoolExamScore: r.schoolExamScore,
      feedback: r.feedback,
    }));

    return sendJson(res, 200, {
      ok: true,
      student: {
        // 내부 studentKey 및 Notion Page ID를 절대 노출하지 않고 학부모 표시명만 전달
        studentDisplayName: session.studentDisplayName,
      },
      reports: parentDTOs,
    });
  } catch (err: any) {
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
