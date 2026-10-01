import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import {
  NotionScheduleWebhookSchema,
  type StoredStudentSchedule,
} from '../_lib/reportSchemas.js';
import { lookupStudentIdentity, migrateStudentMapping } from '../_lib/studentIdentity.js';
import { getSecretOrThrow } from '../_lib/security.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import crypto from 'crypto';

/**
 * 결정적 일정 문서 ID 생성:
 * hash(notionScheduleId + ':' + internalStudentId)
 * 학생 이름, 전화번호, 전체 studentKey가 문서 ID에 절대 노출되지 않음
 */
export function generateScheduleDocId(notionScheduleId: string, internalStudentId: string): string {
  return crypto
    .createHash('sha256')
    .update(`${notionScheduleId}:${internalStudentId}`)
    .digest('hex')
    .slice(0, 32);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    // 1) 웹훅 시크릿 인증: MAKE_NOTION_WEBHOOK_SECRET 재사용
    let expectedSecret: string;
    try {
      expectedSecret = getSecretOrThrow('MAKE_NOTION_WEBHOOK_SECRET', 32);
    } catch {
      return sendJson(res, 500, { ok: false, error: 'SERVER_CONFIG_ERROR' });
    }

    const providedSecret = req.headers['x-webhook-secret'];
    if (!providedSecret || providedSecret !== expectedSecret) {
      return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED_WEBHOOK' });
    }

    // 2) 바디 파싱 및 Zod 검증
    const rawBody = await parseJsonBody(req);
    const parsed = NotionScheduleWebhookSchema.safeParse(rawBody);

    if (!parsed.success) {
      return sendJson(res, 400, {
        ok: false,
        error: 'INVALID_PAYLOAD',
        details: parsed.error.issues.map(i => i.message),
      });
    }

    const data = parsed.data;
    const { db } = getFirebaseAdmin();
    const now = new Date().toISOString();
    const sourceUpdatedAt = data.sourceUpdatedAt || now;

    // 3) 중복 studentKey 제거 및 정규화
    const identities = data.notionStudentPageIds ?? data.studentKeys ?? [];
    const uniqueStudentKeys = Array.from(new Set(identities.map(k => k.trim()))).filter(Boolean);
    if (uniqueStudentKeys.length === 0 && data.notionStudentPageIds === undefined) {
      return sendJson(res, 400, {
        ok: false,
        error: 'EMPTY_STUDENT_KEYS',
        message: '최소 1명 이상의 유효한 studentKey가 필요합니다.',
      });
    }

    // 4) 각 studentKey별 internalStudentId 매핑 확인 (또는 Notion 자동 조회 생성)
    // 정책: 한 명이라도 해석할 수 없으면 일정 문서는 전혀 변경하지 않는다.
    // 부분 성공은 기존 학생을 실수로 취소시킬 수 있으므로 일정 동기화에는 원자적 실패가 더 안전하다.
    const resolvedStudents: Array<{ studentKey: string; internalStudentId: string }> = [];
    const unresolvableKeys: string[] = [];

    for (const key of uniqueStudentKeys) {
      try {
        const student = await lookupStudentIdentity(db, key, false);
        const mapping = await migrateStudentMapping(db, student.notionStudentPageId, student.studentDisplayName);
        resolvedStudents.push({ studentKey: mapping.studentKey, internalStudentId: mapping.internalStudentId });
      } catch {
        unresolvableKeys.push(key);
      }
    }

    if (unresolvableKeys.length > 0) {
      return sendJson(res, 422, {
        ok: false,
        error: 'STUDENTS_UNRESOLVABLE',
        message: '일부 학생을 찾을 수 없어 일정 변경을 적용하지 않았습니다.',
        unresolvableKeys,
      });
    }

    const currentInternalStudentIds = new Set(resolvedStudents.map(s => s.internalStudentId));

    // 5) 이전 전송에 포함되었으나 이번 전송에서 제외된 학생 처리:
    // notionScheduleId로 기존 studentSchedules 조회
    const existingSnap = await db.collection('studentSchedules')
      .where('notionScheduleId', '==', data.notionScheduleId)
      .get();

    const batch = db.batch();
    const existingByDocId = new Map<string, StoredStudentSchedule>();

    existingSnap.forEach(docSnap => {
      const existingSchedule = docSnap.data() as StoredStudentSchedule;
      existingByDocId.set(docSnap.id, existingSchedule);
      // 현재 요청 학생 목록에 없고, 아직 '취소' 상태가 아닌 경우 -> 상태를 '취소'로 변경
      if (!currentInternalStudentIds.has(existingSchedule.internalStudentId)) {
        if (existingSchedule.status !== '취소') {
          batch.update(docSnap.ref, {
            status: '취소',
            serverUpdatedAt: now,
            notice: existingSchedule.notice
              ? `${existingSchedule.notice} (대상에서 제외됨)`
              : '(일정 대상에서 제외됨)',
          });
        }
      }
    });

    // 6) 현재 선택된 학생들의 일정 문서 Upsert (결정적 ID 사용)
    for (const student of resolvedStudents) {
      const scheduleDocId = generateScheduleDocId(data.notionScheduleId, student.internalStudentId);
      const scheduleRef = db.collection('studentSchedules').doc(scheduleDocId);
      const existingSchedule = existingByDocId.get(scheduleDocId);

      const scheduleData: StoredStudentSchedule = {
        scheduleDocId,
        notionScheduleId: data.notionScheduleId,
        internalStudentId: student.internalStudentId,
        studentKey: student.studentKey,
        title: data.title,
        startAt: data.startAt,
        endAt: data.endAt || null,
        scheduleType: data.scheduleType || '정규 수업',
        status: data.status,
        completedAt: data.status === '완료'
          ? (existingSchedule?.status === '완료'
            ? existingSchedule.completedAt || existingSchedule.serverUpdatedAt || now
            : now)
          : null,
        notice: data.notice || null,
        sourceUpdatedAt,
        serverReceivedAt: existingSchedule?.serverReceivedAt || now,
        serverUpdatedAt: now,
      };

      // Upsert: 기존 문서가 있으면 보존/갱신, 없으면 생성
      batch.set(scheduleRef, scheduleData, { merge: true });
    }

    await batch.commit();

    return sendJson(res, 200, {
      ok: true,
      notionScheduleId: data.notionScheduleId,
      syncedStudentsCount: resolvedStudents.length,
      unresolvableKeys: unresolvableKeys.length > 0 ? unresolvableKeys : undefined,
    });
  } catch (err: any) {
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
