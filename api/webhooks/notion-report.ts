import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../_lib/http.ts';
import { NotionReportWebhookSchema, type StoredLessonReport } from '../_lib/reportSchemas.ts';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const expectedSecret = process.env.MAKE_NOTION_WEBHOOK_SECRET;
  const providedSecret = req.headers['x-webhook-secret'];

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED_WEBHOOK' });
  }

  try {
    const rawBody = await parseJsonBody(req);
    const parsed = NotionReportWebhookSchema.safeParse(rawBody);

    if (!parsed.success) {
      return sendJson(res, 400, {
        ok: false,
        error: 'INVALID_PAYLOAD',
        details: parsed.error.issues.map(i => i.message),
      });
    }

    const data = parsed.data;
    const { db } = getFirebaseAdmin();

    // 학생 studentId 매핑:
    // 테스트 학생 고정 식별자, 또는 users 컬렉션 notionStudentKey 매핑
    let studentId: string;
    if (data.studentKey === '테스트 (복제고1)') {
      studentId = 'test-student-bokje-uid';
    } else {
      const userSnap = await db.collection('users').where('notionStudentKey', '==', data.studentKey).limit(1).get();
      if (!userSnap.empty) {
        studentId = userSnap.docs[0].id;
      } else {
        return sendJson(res, 422, {
          ok: false,
          error: 'STUDENT_NOT_MAPPED',
          message: '수강생 시스템에 매핑되지 않은 학생입니다.',
        });
      }
    }

    const now = new Date().toISOString();
    const docRef = db.collection('lessonReports').doc(data.notionPageId);
    const prevSnap = await docRef.get();

    const storedReport: StoredLessonReport = {
      notionPageId: data.notionPageId,
      studentKey: data.studentKey,
      studentId,
      lessonDateStart: data.lessonDateStart,
      lessonDateEnd: data.lessonDateEnd || null,
      lessonTime: data.lessonTime || '',
      selfStudyTime: data.selfStudyTime || '',
      category: data.category,
      attendance: data.attendance || '',
      attitude: data.attitude || '',
      homework: data.homework || '',
      test: data.test || '',
      vocabularyScore: data.vocabularyScore ?? null,
      schoolExamScore: data.schoolExamScore ?? null,
      feedback: data.feedback || '',
      sourceUpdatedAt: now,
      serverReceivedAt: prevSnap.exists ? (prevSnap.data() as StoredLessonReport).serverReceivedAt : now,
      serverUpdatedAt: now,
    };

    await docRef.set(storedReport, { merge: true });

    return sendJson(res, 200, {
      ok: true,
      notionPageId: data.notionPageId,
      isNew: !prevSnap.exists,
    });
  } catch (err: any) {
    return sendJson(res, 500, {
      ok: false,
      error: 'SERVER_ERROR',
      message: err.message?.startsWith('CONFIG_ERROR') ? err.message : 'Internal Server Error',
    });
  }
}
