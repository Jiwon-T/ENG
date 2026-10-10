import { withNotionUsageRoute, recordMakeWebhook } from '../_lib/notionUsage.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import { verifyAdminAuth } from '../_lib/auth.js';
import {
  LinkStudentAccountSchema,
  UnlinkStudentAccountSchema,
  type StoredNotionStudentMapping,
} from '../_lib/reportSchemas.js';
import { lookupStudentIdentity, migrateStudentMapping, readStudentMapping } from '../_lib/studentIdentity.js';
import { hashStudentKey } from '../_lib/security.js';
import { normalizeNotionPageId } from '../_lib/notionPageId.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import { linkStudentAccount } from '../_lib/studentAccountLink.js';

/**
 * 관리자 전용 학생 계정 연결/해제 API (지속적인 관리자 권한 확인)
 * GET    /api/teacher/student-link?firebaseUid=... (또는 ?studentKey=...)
 * POST   /api/teacher/student-link (신규 연결: users와 notionStudentMappings 동시 갱신)
 * DELETE /api/teacher/student-link (연결 해제)
 */
export default function handler(req: IncomingMessage, res: ServerResponse) { return withNotionUsageRoute('student-link', () => routeHandler(req, res)); }
async function routeHandler(req: IncomingMessage, res: ServerResponse) {
  try {
    // 1. 관리자 권한 검증 (Bearer Token & ADMIN_UID 일치 확인)
    let adminUser;
    try {
      adminUser = await verifyAdminAuth(req);
    } catch (authErr: any) {
      if (authErr.message === 'UNAUTHORIZED') {
        return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
      }
      if (authErr.message === 'FORBIDDEN') {
        return sendJson(res, 403, { ok: false, error: 'FORBIDDEN_ADMIN_ONLY', message: '관리자 지원T만 학생 계정을 연결할 수 있습니다.' });
      }
      return sendJson(res, 500, { ok: false, error: 'AUTH_INITIALIZATION_ERROR' });
    }

    const { db } = getFirebaseAdmin();

    // ----------------------------------------------------
    // GET: 특정 학생 계정(또는 노션 키)의 현재 연결 상태 조회
    // ----------------------------------------------------
    if (req.method === 'GET') {
      const url = new URL(req.url || '', 'http://localhost');
      const firebaseUid = url.searchParams.get('firebaseUid');
      const studentKey = url.searchParams.get('studentKey');

      if (!firebaseUid && !studentKey) {
        return sendJson(res, 400, { ok: false, error: 'UID_OR_KEY_REQUIRED' });
      }

      if (firebaseUid) {
        const userDoc = await db.collection('users').doc(firebaseUid).get();
        if (!userDoc.exists) {
          return sendJson(res, 404, { ok: false, error: 'USER_NOT_FOUND' });
        }
        const udata = userDoc.data();
        const currentKey = udata?.notionStudentKey || null;

        let mappingData: StoredNotionStudentMapping | null = null;
        if (currentKey) {
          mappingData = await readStudentMapping(db, currentKey);
        }

        return sendJson(res, 200, {
          ok: true,
          firebaseUid,
          role: udata?.role,
          name: udata?.name || null,
          notionStudentKey: currentKey,
          isLinked: !!(currentKey && mappingData?.firebaseUid === firebaseUid),
          linkedAt: mappingData?.linkedAt || null,
        });
      }

      if (studentKey) {
        const mappingData = await readStudentMapping(db, studentKey);
        if (!mappingData) {
          return sendJson(res, 200, { ok: true, studentKey, isLinked: false, firebaseUid: null });
        }
        return sendJson(res, 200, {
          ok: true,
          studentKey,
          isLinked: !!mappingData.firebaseUid,
          firebaseUid: mappingData.firebaseUid,
          linkedAt: mappingData.linkedAt || null,
        });
      }
    }

    // ----------------------------------------------------
    // POST: 관리자가 학생 Firebase UID와 Notion studentKey를 공식 연결
    // ----------------------------------------------------
    if (req.method === 'POST') {
      const rawBody = await parseJsonBody(req);
      const parsed = LinkStudentAccountSchema.safeParse(rawBody);
      if (!parsed.success) {
        return sendJson(res, 400, {
          ok: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.issues.map(i => i.message),
        });
      }

      const { firebaseUid } = parsed.data;
      // Same linking steps as before, now shared with student link codes (api/_lib/studentAccountLink.ts).
      let linked;
      try {
        linked = await linkStudentAccount(db, { firebaseUid, studentKey: parsed.data.studentKey, linkedByUid: adminUser.uid });
      } catch (linkErr: any) {
        if (linkErr.message === 'USER_NOT_FOUND') return sendJson(res, 404, { ok: false, error: 'USER_NOT_FOUND', message: '대상이 되는 Firebase 사용자 계정을 찾을 수 없습니다.' });
        if (linkErr.message === 'INVALID_ROLE') return sendJson(res, 400, { ok: false, error: 'INVALID_ROLE', message: '학생(student) 역할의 계정만 수업 리포트에 연결할 수 있습니다.' });
        if (linkErr.message === 'STUDENT_NOT_FOUND') return sendJson(res, 404, { ok: false, error: 'STUDENT_NOT_FOUND_IN_NOTION', message: 'Notion [DB_학생 관리]에서 학생을 찾을 수 없습니다.' });
        if (linkErr.message === 'MULTIPLE_STUDENTS_MATCHED') return sendJson(res, 409, { ok: false, error: 'MULTIPLE_STUDENTS_MATCHED', message: 'Notion에서 동명의 학생이 2명 이상 검색되었습니다.' });
        throw linkErr;
      }

      return sendJson(res, 200, {
        ok: true,
        ...linked,
        message: '학생 계정과 Notion 학생 리포트가 성공적으로 연결되었습니다.',
      });
    }

    // ----------------------------------------------------
    // DELETE: 관리자가 학생 계정 연결 해제
    // ----------------------------------------------------
    if (req.method === 'DELETE') {
      const rawBody = await parseJsonBody(req);
      const parsed = UnlinkStudentAccountSchema.safeParse(rawBody);
      if (!parsed.success) {
        return sendJson(res, 400, { ok: false, error: 'VALIDATION_ERROR' });
      }

      const { firebaseUid } = parsed.data;
      const userRef = db.collection('users').doc(firebaseUid);

      const now = new Date().toISOString();

      await db.runTransaction(async (t) => {
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) {
          throw new Error('USER_NOT_FOUND');
        }

        const currentData = userSnap.data();
        const currentKey = currentData?.notionStudentKey;

        if (currentKey) {
          let mappingRef = db.collection('notionStudentMappings').doc(hashStudentKey(currentKey));
          let mappingSnap = await t.get(mappingRef);
          if (mappingSnap.exists && mappingSnap.data()?.notionStudentPageId) {
            const canonicalRef = db.collection('notionStudentMappings').doc(hashStudentKey(normalizeNotionPageId(mappingSnap.data()!.notionStudentPageId)));
            const canonicalSnap = await t.get(canonicalRef);
            if (canonicalSnap.exists) { mappingRef = canonicalRef; mappingSnap = canonicalSnap; }
          }
          if (mappingSnap.exists) {
            const mdata = mappingSnap.data() as StoredNotionStudentMapping;
            if (mdata.firebaseUid === firebaseUid) {
              t.update(mappingRef, {
                firebaseUid: null,
                updatedAt: now,
              });
            }
          }
        }

        // users 문서에서 notionStudentKey 제거 (null)
        t.update(userRef, {
          notionStudentKey: null,
          updatedAt: now,
        });
      });

      return sendJson(res, 200, {
        ok: true,
        firebaseUid,
        message: '학생 계정 연결이 성공적으로 해제되었습니다.',
      });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch (err: any) {
    if (err.message === 'NOTION_STUDENT_ALREADY_LINKED_TO_ANOTHER_ACCOUNT') {
      return sendJson(res, 409, {
        ok: false,
        error: 'STUDENT_ALREADY_LINKED',
        message: '해당 Notion 학생은 이미 다른 학생 계정(Firebase UID)에 연결되어 있습니다.',
      });
    }
    if (err.message === 'USER_NOT_FOUND') {
      return sendJson(res, 404, { ok: false, error: 'USER_NOT_FOUND' });
    }
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR', message: err.message });
  }
}
