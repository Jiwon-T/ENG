import {verifyFirebaseSession} from '../firebaseSession.js';
import { reportScheduleDTO } from '../reportAudienceDTO.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../http.js';
import { getFirebaseAdmin } from '../firebaseAdmin.js';
import type { StudentScheduleDTO, StoredStudentSchedule } from '../reportSchemas.js';
import { readStudentMapping } from '../studentIdentity.js';

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
      decoded = await verifyFirebaseSession(auth,token);
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
        schedules: [],
        message: '연결된 학생 일정이 없습니다.',
      });
    }

    // 2) notionStudentMappings에서 관리자 승인 매핑 검증
    const mappingData = await readStudentMapping(db, notionStudentKey);

    if (!mappingData) {
      return sendJson(res, 403, {
        ok: false,
        error: 'STUDENT_REPORT_NOT_LINKED',
        schedules: [],
      });
    }


    // 3) 엄격한 보안 검증: mappingData.firebaseUid === studentUid
    if (!mappingData.firebaseUid || mappingData.firebaseUid !== studentUid) {
      return sendJson(res, 403, {
        ok: false,
        error: 'STUDENT_REPORT_NOT_LINKED',
        schedules: [],
      });
    }

    const internalStudentId = mappingData.internalStudentId;
    if (!internalStudentId) {
      return sendJson(res, 403, {
        ok: false,
        error: 'STUDENT_REPORT_NOT_LINKED',
        schedules: [],
      });
    }

    // 4) 해당 학생의 studentSchedules 컬렉션 문서 조회
    const schedulesSnap = await db.collection('studentSchedules')
      .where('internalStudentId', '==', internalStudentId)
      .get();

    const storedSchedules: StoredStudentSchedule[] = [];
    schedulesSnap.forEach(d => storedSchedules.push(d.data() as StoredStudentSchedule));

    storedSchedules.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    // 5) 학생용 안전한 DTO 변환 (내부 notionScheduleId, internalStudentId, studentKey 원천 배제)
    const studentDTOs: StudentScheduleDTO[] = storedSchedules.map(reportScheduleDTO);

    return sendJson(res, 200, {
      ok: true,
      schedules: studentDTOs,
    });
  } catch (err: any) {
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}

