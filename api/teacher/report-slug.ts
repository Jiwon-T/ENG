import {assertContactEditAllowsIssuance} from '../_lib/studentContactEdit.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import { verifyAdminAuth } from '../_lib/auth.js';
import {
  CreateReportSlugSchema,
  PatchReportSlugSchema,
  DeleteReportSlugSchema,
  isReservedSlug,
  type StoredReportSlug,
  type StudentReportMapping,
  type StoredNotionStudentMapping,
} from '../_lib/reportSchemas.js';
import { lookupStudentIdentity, migrateStudentMapping } from '../_lib/studentIdentity.js';
import { hashStudentKey } from '../_lib/security.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';

export default function handler(req: IncomingMessage, res: ServerResponse) { return routeHandler(req, res); }
async function routeHandler(req: IncomingMessage, res: ServerResponse) {
  try {
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
      return sendJson(res, 500, { ok: false, error: 'AUTH_INITIALIZATION_ERROR' });
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
        const page = await lookupStudentIdentity(db, studentKey, false);
        const mapping = await migrateStudentMapping(db, page.notionStudentPageId, page.studentDisplayName);
        const snap = await db.collection('reportSlugs')
          .where('internalStudentId', '==', mapping.internalStudentId)
          .get();

        const activeDocument = snap.docs.find(doc => doc.data().active === true);
        if (!activeDocument) {
          return sendJson(res, 200, { ok: true, reportSlug: null });
        }

        const current = activeDocument.data() as StoredReportSlug;
        return sendJson(res, 200, {
          ok: true,
          reportSlug: current.reportSlug,
          active: current.active,
          reportUrl: `/${current.reportSlug}`,
          shortUrl: `/${current.reportSlug}`,
        });
      } catch (e: any) {
        return sendJson(res, 500, { ok: false, error: 'DATASTORE_UNAVAILABLE' });
      }
    }

    // ----------------------------------------------------
    // POST: 신규 고정 주소 생성 (Firebase 가입 여부와 무관하게 Notion 기반 발급)
    // ----------------------------------------------------
    if (req.method === 'POST') {
      const rawBody = await parseJsonBody(req);
      const parsed = CreateReportSlugSchema.safeParse(rawBody);
      if (!parsed.success) {
        return sendJson(res, 400, {
          ok: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.issues.map(i => i.message),
        });
      }

      const { reportSlug } = parsed.data;
      let studentKey = parsed.data.studentKey;

      if (isReservedSlug(reportSlug)) {
        return sendJson(res, 400, {
          ok: false,
          error: 'RESERVED_SLUG',
          message: '예약된 시스템 경로는 리포트 주소로 지정할 수 없습니다.',
        });
      }

      // 1) Notion DB_학생 관리에서 학생 및 보호자 연락처, Notion Page ID 조회
      let notionLookup;
      try {
        notionLookup = await lookupStudentIdentity(db, studentKey);
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

      // 2) Notion 학생 페이지 ID로부터 안정적인 internalStudentId 생성
      const existingIdentity = await migrateStudentMapping(db, notionLookup.notionStudentPageId, notionLookup.studentDisplayName);
      studentKey = existingIdentity.studentKey;
      const internalStudentId = existingIdentity.internalStudentId;
      const studentKeyHash = hashStudentKey(studentKey);

      const targetDocRef = db.collection('reportSlugs').doc(reportSlug);
      const mappingDocRef = db.collection('studentReportMappings').doc(internalStudentId);
      const notionMappingDocRef = db.collection('notionStudentMappings').doc(studentKeyHash);

      // 3) Firestore Transaction: 슬러그 생성, 학생 활성 슬러그 보장, notionStudentMappings 동기화
      // 학부모 리포트 발급은 학생 계정 연결과 완전히 독립적입니다.
      // 단순히 users 컬렉션에 적힌 키로 자동 연결하지 않으며, 이미 관리자 연결 API로 검증된 firebaseUid만 보존합니다.
      await db.runTransaction(async (t) => {
        const docSnap = await t.get(targetDocRef);
        if (docSnap.exists) {
          throw new Error('SLUG_ALREADY_IN_USE');
        }

        const mappingSnap = await t.get(mappingDocRef);
        const notionMappingSnap = await t.get(notionMappingDocRef);
        const contactEdit=(await t.get(db.collection('teacherStudentEdits').doc(hashStudentKey(studentKey)))).data();
        assertContactEditAllowsIssuance(contactEdit,notionLookup.sourceUpdatedAt);
        const now = new Date().toISOString();

        if (mappingSnap.exists) {
          const mappingData = mappingSnap.data() as StudentReportMapping;
          if (mappingData.activeReportSlug) {
            // 이전 활성 슬러그 비활성화 및 authVersion 증가 (기존 세션 즉시 무효화)
            const oldSlugRef = db.collection('reportSlugs').doc(mappingData.activeReportSlug);
            const oldSlugSnap = await t.get(oldSlugRef);
            if (oldSlugSnap.exists) {
              const oldSlugData = oldSlugSnap.data() as StoredReportSlug;
              t.update(oldSlugRef, {
                active: false,
                authVersion: (oldSlugData.authVersion || 1) + 1,
                updatedAt: now,
              });
            }
          }
        }

        // 새 슬러그 문서 생성 (학부모용 studentDisplayName 별도 저장)
        const slugRecord: StoredReportSlug = {
          reportSlug,
          studentKey,
          studentDisplayName: notionLookup.studentDisplayName,
          internalStudentId,
          parentPhonePinHash: notionLookup.parentPhonePinHash,
          active: true,
          authVersion: 1,
          failedAttempts: 0,
          lockedUntil: null,
          createdAt: now,
          updatedAt: now,
          createdByUid: adminUser.uid,
        };
        t.set(targetDocRef, slugRecord);

        // 학생별 활성 슬러그 매핑 문서 갱신
        const updatedMapping: StudentReportMapping = {
          internalStudentId,
          studentKey,
          activeReportSlug: reportSlug,
          updatedAt: now,
        };
        t.set(mappingDocRef, updatedMapping);

        // notionStudentMappings: 이미 관리자 연결 API를 통해 설정된 기존 firebaseUid가 있다면 보존, 신규는 null
        let preservedFirebaseUid: string | null = null;
        if (notionMappingSnap.exists) {
          const existing = notionMappingSnap.data() as StoredNotionStudentMapping;
          preservedFirebaseUid = existing.firebaseUid || null;
        }

        const notionMappingData: StoredNotionStudentMapping = {
          internalStudentId,
          studentKey,
          studentDisplayName: notionLookup.studentDisplayName,
          notionStudentPageId: notionLookup.notionStudentPageId,
          firebaseUid: preservedFirebaseUid,
          createdAt: notionMappingSnap.exists ? (notionMappingSnap.data() as StoredNotionStudentMapping).createdAt : now,
          updatedAt: now,
        };
        t.set(notionMappingDocRef, notionMappingData, { merge: true });
      });

      return sendJson(res, 200, {
        ok: true,
        reportSlug,
        reportUrl: `/${reportSlug}`,
        shortUrl: `/${reportSlug}`,
        guardianContactStatus: 'verified',
      });
    }

    // ----------------------------------------------------
    // PATCH: 고정 주소 변경 (newReportSlug 발급)
    // ----------------------------------------------------
    if (req.method === 'PATCH') {
      const rawBody = await parseJsonBody(req);
      const parsed = PatchReportSlugSchema.safeParse(rawBody);
      if (!parsed.success) {
        return sendJson(res, 400, { ok: false, error: 'VALIDATION_ERROR', details: parsed.error.issues });
      }

      const { reportSlug, newReportSlug } = parsed.data;
      if (!newReportSlug || newReportSlug === reportSlug) {
        return sendJson(res, 400, {
          ok: false,
          error: 'NEW_SLUG_REQUIRED',
          message: '새로운 고정 주소(newReportSlug)를 입력해 주세요.',
        });
      }

      if (isReservedSlug(newReportSlug)) {
        return sendJson(res, 400, { ok: false, error: 'RESERVED_SLUG' });
      }

      const docRef = db.collection('reportSlugs').doc(reportSlug);
      const newDocRef = db.collection('reportSlugs').doc(newReportSlug);

      await db.runTransaction(async (t) => {
        const snap = await t.get(docRef);
        if (!snap.exists) {
          throw new Error('SLUG_NOT_FOUND');
        }

        const data = snap.data() as StoredReportSlug;
        const newSnap = await t.get(newDocRef);
        if (newSnap.exists) {
          throw new Error('NEW_SLUG_ALREADY_IN_USE');
        }

        const mappingDocRef = db.collection('studentReportMappings').doc(data.internalStudentId);
        const now = new Date().toISOString();

        // 기존 슬러그 비활성화 및 authVersion 증가
        t.update(docRef, {
          active: false,
          authVersion: (data.authVersion || 1) + 1,
          updatedAt: now,
        });

        // 새 슬러그 활성 생성
        const newRecord: StoredReportSlug = {
          ...data,
          reportSlug: newReportSlug,
          active: true,
          authVersion: 1,
          failedAttempts: 0,
          lockedUntil: null,
          createdAt: now,
          updatedAt: now,
          createdByUid: adminUser.uid,
        };
        t.set(newDocRef, newRecord);

        // 학생 매핑 문서 갱신
        t.set(mappingDocRef, {
          internalStudentId: data.internalStudentId,
          studentKey: data.studentKey,
          activeReportSlug: newReportSlug,
          updatedAt: now,
        });
      });

      return sendJson(res, 200, {
        ok: true,
        reportSlug: newReportSlug,
        active: true,
        reportUrl: `/${newReportSlug}`,
      });
    }

    // ----------------------------------------------------
    // DELETE: 고정 주소 비활성화 (active: false 및 authVersion 증가)
    // 매핑 문서 누락 안전 처리: 매핑 문서가 없더라도 슬러그 비활성화는 반드시 완수
    // ----------------------------------------------------
    if (req.method === 'DELETE') {
      const rawBody = await parseJsonBody(req);
      const parsed = DeleteReportSlugSchema.safeParse(rawBody);
      if (!parsed.success) {
        return sendJson(res, 400, { ok: false, error: 'VALIDATION_ERROR' });
      }

      const { reportSlug } = parsed.data;
      const docRef = db.collection('reportSlugs').doc(reportSlug);

      await db.runTransaction(async (t) => {
        const snap = await t.get(docRef);
        if (!snap.exists) {
          throw new Error('SLUG_NOT_FOUND');
        }

        const data = snap.data() as StoredReportSlug;
        const now = new Date().toISOString();

        // 어떤 경우에도 슬러그 비활성화 및 authVersion 증가로 기존 세션 즉시 차단
        t.update(docRef, {
          active: false,
          authVersion: (data.authVersion || 1) + 1,
          updatedAt: now,
        });

        // 학생 매핑 문서 누락 안전 처리: 존재하면 갱신, 없으면 무시
        if (data.internalStudentId) {
          const mappingDocRef = db.collection('studentReportMappings').doc(data.internalStudentId);
          const mappingSnap = await t.get(mappingDocRef);
          if (mappingSnap.exists) {
            t.update(mappingDocRef, {
              activeReportSlug: null,
              updatedAt: now,
            });
          }
        }
      });

      return sendJson(res, 200, { ok: true, reportSlug, active: false });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return sendJson(res, 405, {
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
      allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    });
  } catch (err: any) {
    if (err.message === 'STUDENT_PROFILE_CONTACT_PENDING')return sendJson(res,409,{ok:false,error:'STUDENT_PROFILE_CONTACT_PENDING',message:'보호자 번호 변경 결과를 먼저 확인한 뒤 리포트 주소를 발급해 주세요.'});
    if (err.message === 'SLUG_ALREADY_IN_USE' || err.message === 'NEW_SLUG_ALREADY_IN_USE') {
      return sendJson(res, 409, { ok: false, error: 'SLUG_ALREADY_IN_USE' });
    }
    if (err.message === 'SLUG_NOT_FOUND') {
      return sendJson(res, 404, { ok: false, error: 'SLUG_NOT_FOUND' });
    }
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
