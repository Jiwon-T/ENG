import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import type { StudentLessonReportDTO, StoredLessonReport } from '../_lib/reportSchemas.js';
import { readStudentMapping } from '../_lib/studentIdentity.js';
import crypto from 'crypto';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'PATCH') {
      res.setHeader('Allow', 'PATCH');
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
    const mappingData = await readStudentMapping(db, notionStudentKey);

    if (!mappingData) {
      return sendJson(res, 403, {
        ok: false,
        error: 'STUDENT_REPORT_NOT_LINKED',
        message: '아직 수업 리포트가 계정과 연결되지 않았습니다. 선생님께 문의해 주세요.',
        reports: [],
      });
    }


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

    // 학생별 자기 확인 완료 상태: 교사 평가나 원본 일지는 수정하지 않습니다.
    const completionCollection = db.collection('users').doc(studentUid).collection('assignmentCompletions');
    const reportIdFor = (report: StoredLessonReport) => crypto.createHash('sha256').update(report.notionPageId).digest('hex').slice(0, 16);
    const assignmentHashFor = (report: StoredLessonReport) => crypto.createHash('sha256').update(report.derivedAssignment || '').digest('hex');
    if (req.method === 'PATCH') {
      const body = await parseJsonBody(req);
      if (typeof body?.reportId !== 'string' || !/^[a-f0-9]{16}$/.test(body.reportId)) {
        return sendJson(res, 400, { ok: false, error: 'INVALID_REPORT_ID' });
      }
      const target = storedReports.find(report => reportIdFor(report) === body.reportId);
      if (!target || !target.derivedAssignment?.trim()) {
        return sendJson(res, 404, { ok: false, error: 'ASSIGNMENT_NOT_FOUND' });
      }
      if (body.assignmentContent !== target.derivedAssignment) {
        return sendJson(res, 409, { ok: false, error: 'ASSIGNMENT_CHANGED', message: '과제 내용이 변경되었습니다. 새로고침 후 다시 확인해 주세요.' });
      }
      await completionCollection.doc(body.reportId).set({
        contentHash: assignmentHashFor(target),
        completedAt: new Date().toISOString(),
      });
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch {
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
