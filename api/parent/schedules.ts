import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../_lib/http.js';
import { getVerifiedParentSession } from '../_lib/session.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import type { StudentScheduleDTO, StoredStudentSchedule } from '../_lib/reportSchemas.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    // 기존 쿠키 대신 현재 페이지의 PIN 인증 토큰만 허용합니다.
    const header = req.headers['x-parent-session'];
    const sessionToken = typeof header === 'string' ? header : '';

    if (!sessionToken) {
      return sendJson(res, 401, { ok: false, error: 'AUTH_REQUIRED', message: '보호자 인증이 필요합니다.' });
    }

    const session = await getVerifiedParentSession(sessionToken);
    if (!session) {
      return sendJson(res, 401, {
        ok: false,
        error: 'SESSION_EXPIRED',
        message: '세션이 만료되었거나 비활성화되었습니다. 다시 인증해 주세요.',
      });
    }

    const url = new URL(req.url || '', 'http://localhost');
    const requestedSlug = url.searchParams.get('reportSlug');
    if (requestedSlug && session.reportSlug !== requestedSlug) {
      return sendJson(res, 403, { ok: false, error: 'SESSION_MISMATCH', message: '다른 학생의 주소에는 접근할 수 없습니다.' });
    }

    const { db } = getFirebaseAdmin();
    // internalStudentId 기준으로 학생의 일정 조회
    const schedulesSnap = await db.collection('studentSchedules')
      .where('internalStudentId', '==', session.internalStudentId)
      .get();

    const storedSchedules: StoredStudentSchedule[] = [];
    schedulesSnap.forEach(d => storedSchedules.push(d.data() as StoredStudentSchedule));

    // 최신/예정 순 정렬 (startAt 기준 오름차순 또는 내림차순 지원, 화면에서는 그룹별 재정렬 가능)
    storedSchedules.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    // 안전한 학부모용 일정 DTO (다른 학생 식별자, Notion 내부 ID 일체 제외)
    const scheduleDTOs: StudentScheduleDTO[] = storedSchedules.map(s => ({
      scheduleId: s.scheduleDocId,
      title: s.title,
      startAt: s.startAt,
      endAt: s.endAt,
      subject: s.subject || '영어',
      scheduleType: s.scheduleType,
      status: s.status,
      notice: s.notice,
    }));

    return sendJson(res, 200, {
      ok: true,
      schedules: scheduleDTOs,
    });
  } catch (err: any) {
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
