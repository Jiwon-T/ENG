import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../_lib/http.ts';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.ts';
import type { StudentLessonReportDTO, StoredLessonReport, StoredNotionStudentMapping } from '../_lib/reportSchemas.ts';
import { hashStudentKey } from '../_lib/security.ts';
import crypto from 'crypto';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    }

    const token = authHeader.split('Bearer ')[1].trim();

    let decoded;
    try {
      const { auth } = getFirebaseAdmin();
      decoded = await auth.verifyIdToken(token);
    } catch (authErr: any) {
      if (authErr.message?.startsWith('CONFIG_ERROR')) {
        return sendJson(res, 500, { ok: false, error: 'SERVER_CONFIG_ERROR' });
      }
      return sendJson(res, 401, { ok: false, error: 'INVALID_TOKEN' });
    }

    const studentUid = decoded.uid;
    const { db } = getFirebaseAdmin();

    // 1) 학생 Firebase 계정의 notionStudentKey 조회
    const userDoc = await db.collection('users').doc(studentUid).get();
    if (!userDoc.exists) {
      return sendJson(res, 404, { ok: false, error: 'USER_PROFILE_NOT_FOUND' });
    }

    const userData = userDoc.data();
    const notionStudentKey = userData?.notionStudentKey;

    if (!notionStudentKey) {
      return sendJson(res, 403, {
        ok: false,
        error: 'STUDENT_REPORT_NOT_LINKED',
        message: '아직 수업 리포트가 계정과 연결되지 않았습니다. 선생님께 문의해 주세요.',
        reports: [],
      });
    }

    // 2) notionStudentMappings에서 서버가 관리하는 학생 매핑 문서 확인
    const studentKeyHash = hashStudentKey(notionStudentKey);
    const mappingDoc = await db.collection('notionStudentMappings').doc(studentKeyHash).get();

    if (!mappingDoc.exists) {
      return sendJson(res, 403, {
        ok: false,
        error: 'STUDENT_REPORT_NOT_LINKED',
        message: '아직 수업 리포트가 계정과 연결되지 않았습니다. 선생님께 문의해 주세요.',
        reports: [],
      });
    }

    const mappingData = mappingDoc.data() as StoredNotionStudentMapping;

    // 3) 엄격한 보안 검증: 매핑 문서의 firebaseUid가 현재 로그인한 studentUid와 정확히 일치해야 함
    // null이거나, 다른 UID이거나, 사용자가 본인 문서에 임의로 적은 경우 절대 반환하지 않음
    // 학생 API에서 firebaseUid를 자동 업데이트하거나 소유권을 주장하는 코드는 완전히 제거됨
    if (!mappingData.firebaseUid || mappingData.firebaseUid !== studentUid) {
      return sendJson(res, 403, {
        ok: false,
        error: 'STUDENT_REPORT_NOT_LINKED',
        message: '아직 수업 리포트가 계정과 연결되지 않았습니다. 선생님께 문의해 주세요.',
        reports: [],
      });
    }

    const internalStudentId = mappingData.internalStudentId;
    if (!internalStudentId) {
      return sendJson(res, 403, {
        ok: false,
        error: 'STUDENT_REPORT_NOT_LINKED',
        message: '아직 수업 리포트가 계정과 연결되지 않았습니다. 선생님께 문의해 주세요.',
        reports: [],
      });
    }

    // 4) 검증 완료된 internalStudentId의 수업 일지 조회
    let reportsSnap;
    try {
      reportsSnap = await db.collection('lessonReports')
        .where('internalStudentId', '==', internalStudentId)
        .get();
    } catch (dbErr) {
      return sendJson(res, 503, { ok: false, error: 'DATASTORE_UNAVAILABLE' });
    }

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
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
