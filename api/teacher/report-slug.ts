import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../_lib/http.ts';
import { verifyAdminAuth } from '../_lib/auth.ts';
import { CreateReportSlugSchema, type StoredReportSlug } from '../_lib/reportSchemas.ts';
import { lookupStudentAndGuardianContact } from '../_lib/notion.ts';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // 1. 관리자 권한 검증 (Bearer Token & ADMIN_UID)
  let adminUser;
  try {
    adminUser = await verifyAdminAuth(req);
  } catch (authErr: any) {
    if (authErr.message === 'UNAUTHORIZED') {
      return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    }
    if (authErr.message === 'FORBIDDEN') {
      return sendJson(res, 403, { ok: false, error: 'FORBIDDEN_ADMIN_ONLY' });
    }
    return sendJson(res, 500, { ok: false, error: authErr.message });
  }

  const { db } = getFirebaseAdmin();

  // ----------------------------------------------------
  // GET: 특정 학생의 활성 reportSlug 조회
  // ----------------------------------------------------
  if (req.method === 'GET') {
    const url = new URL(req.url || '', 'http://localhost');
    const studentKey = url.searchParams.get('studentKey');
    if (!studentKey) {
      return sendJson(res, 400, { ok: false, error: 'STUDENT_KEY_REQUIRED' });
    }

    try {
      const snap = await db.collection('reportSlugs').where('studentKey', '==', studentKey).get();
      if (snap.empty) {
        return sendJson(res, 200, { ok: true, reportSlug: null });
      }

      // 가장 최신 생성된 슬러그 반환
      const docs = snap.docs.map(d => d.data() as StoredReportSlug);
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const current = docs[0];

      return sendJson(res, 200, {
        ok: true,
        reportSlug: current.reportSlug,
        active: current.active,
        reportUrl: `/report/${current.reportSlug}`,
        shortUrl: `/${current.reportSlug}`,
      });
    } catch (e: any) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // ----------------------------------------------------
  // POST: 신규 고정 주소 생성 및 Notion 보호자 번호 HMAC 저장
  // ----------------------------------------------------
  if (req.method === 'POST') {
    try {
      const rawBody = await parseJsonBody(req);
      const parsed = CreateReportSlugSchema.safeParse(rawBody);
      if (!parsed.success) {
        return sendJson(res, 400, {
          ok: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.issues.map(i => i.message),
        });
      }

      const { reportSlug, studentKey } = parsed.data;

      // 1) reportSlug 중복 검사
      const existingSlugDoc = await db.collection('reportSlugs').doc(reportSlug).get();
      if (existingSlugDoc.exists) {
        const existingData = existingSlugDoc.data() as StoredReportSlug;
        if (existingData.studentKey !== studentKey) {
          return sendJson(res, 409, {
            ok: false,
            error: 'SLUG_ALREADY_IN_USE',
            message: '이미 다른 학생에게 사용 중인 주소입니다. 다른 주소를 지정해 주세요.',
          });
        }
      }

      // 2) Notion DB_학생 관리에서 학생 조회 및 보호자 연락처 뒤 4자리 HMAC 생성
      let notionLookup;
      try {
        notionLookup = await lookupStudentAndGuardianContact(studentKey);
      } catch (notionErr: any) {
        if (notionErr.message === 'STUDENT_NOT_FOUND') {
          return sendJson(res, 404, {
            ok: false,
            error: 'STUDENT_NOT_FOUND_IN_NOTION',
            guardianContactStatus: 'not_found',
            message: 'Notion [DB_학생 관리]에서 학생을 찾을 수 없습니다.',
          });
        }
        if (notionErr.message === 'MULTIPLE_STUDENTS_MATCHED') {
          return sendJson(res, 409, {
            ok: false,
            error: 'MULTIPLE_STUDENTS_MATCHED',
            guardianContactStatus: 'duplicate_match',
            message: 'Notion에서 동명의 학생이 2명 이상 검색되었습니다. 구분을 확인해 주세요.',
          });
        }
        if (notionErr.message === 'GUARDIAN_CONTACT_MISSING_OR_INVALID') {
          return sendJson(res, 422, {
            ok: false,
            error: 'GUARDIAN_CONTACT_MISSING',
            guardianContactStatus: 'contact_missing',
            message: 'Notion [DB_학생 관리]에 유효한 보호자연락처가 등록되어 있지 않습니다.',
          });
        }
        throw notionErr;
      }

      // 3) 내부 학생 ID 결정
      let studentId: string;
      if (studentKey === '테스트 (복제고1)') {
        studentId = 'test-student-bokje-uid';
      } else {
        const userSnap = await db.collection('users').where('notionStudentKey', '==', studentKey).limit(1).get();
        studentId = !userSnap.empty ? userSnap.docs[0].id : `notion_${studentKey}`;
      }

      // 4) Firestore에 영속화 (전화번호 원문이나 4자리는 절대 저장하지 않음)
      const now = new Date().toISOString();
      const slugRecord: StoredReportSlug = {
        reportSlug,
        studentKey,
        studentId,
        parentPhonePinHash: notionLookup.parentPhonePinHash,
        active: true,
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: existingSlugDoc.exists ? (existingSlugDoc.data() as StoredReportSlug).createdAt : now,
        updatedAt: now,
        createdByUid: adminUser.uid,
      };

      await db.collection('reportSlugs').doc(reportSlug).set(slugRecord);

      return sendJson(res, 200, {
        ok: true,
        reportSlug,
        reportUrl: `/report/${reportSlug}`,
        shortUrl: `/${reportSlug}`,
        guardianContactStatus: 'verified',
      });
    } catch (e: any) {
      return sendJson(res, 500, {
        ok: false,
        error: 'SERVER_ERROR',
        message: e.message?.startsWith('CONFIG_ERROR') ? e.message : 'Internal Server Error',
      });
    }
  }

  // ----------------------------------------------------
  // PATCH: 기존 reportSlug 활성/비활성 또는 슬러그명 변경
  // ----------------------------------------------------
  if (req.method === 'PATCH') {
    try {
      const rawBody = await parseJsonBody(req);
      const { reportSlug, active } = rawBody;
      if (!reportSlug || typeof active !== 'boolean') {
        return sendJson(res, 400, { ok: false, error: 'SLUG_AND_ACTIVE_REQUIRED' });
      }

      const docRef = db.collection('reportSlugs').doc(reportSlug);
      const snap = await docRef.get();
      if (!snap.exists) {
        return sendJson(res, 404, { ok: false, error: 'SLUG_NOT_FOUND' });
      }

      await docRef.update({
        active,
        updatedAt: new Date().toISOString(),
      });

      return sendJson(res, 200, { ok: true, reportSlug, active });
    } catch (e: any) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
}
