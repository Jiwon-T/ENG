import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decodeMakeBase64Payload } from '../api/webhooks/notion-report.ts';
import { NotionReportWebhookSchema } from '../api/_lib/reportSchemas.ts';

const b64 = (value: string) => Buffer.from(value, 'utf8').toString('base64');

describe('Notion report webhook Make payload decoding', () => {
  it('decodes the Notion student relation page ID and Korean feedback safely', () => {
    const decoded = decodeMakeBase64Payload({
      payloadEncoding: 'base64',
      schemaVersion: 1,
      notionPageId: b64('3ea0d0f1-c79a-8043-a9d8-dfcdbc8617c8'),
      notionStudentPageId: b64('3e90d0f1-c79a-8105-94c4-ff6f31f73223'),
      studentKey: b64('테스트 (복제고1)'),
      lessonDateStart: b64('2026-09-29T18:00:00+09:00'),
      lessonDateEnd: b64('2026-09-29T19:30:00+09:00'),
      lessonTime: b64('오후 6:10 ~ 오후 7:25'),
      selfStudyTime: b64('60분 (1회차)'),
      category: b64('수업'),
      attendance: b64('출석'),
      attitude: b64('중상'),
      homework: b64('미제출'),
      test: b64('최상'),
      vocabularyScore: '92',
      schoolExamScore: '',
      feedback: b64('첫째 줄\n과제: 문법 10문제 풀기 "오답 정리"'),
      sourceUpdatedAt: b64('2026-09-30T07:00:00.000Z'),
    });

    const parsed = NotionReportWebhookSchema.parse(decoded);
    assert.equal(parsed.notionStudentPageId, '3e90d0f1-c79a-8105-94c4-ff6f31f73223');
    assert.equal(parsed.studentKey, '테스트 (복제고1)');
    assert.equal(parsed.feedback, '첫째 줄\n과제: 문법 10문제 풀기 "오답 정리"');
    assert.equal(parsed.vocabularyScore, 92);
    assert.equal(parsed.schoolExamScore, null);
  });

  it('rejects a decoded payload when the student relation page ID is absent', () => {
    const decoded = decodeMakeBase64Payload({
      payloadEncoding: 'base64',
      schemaVersion: 1,
      notionPageId: b64('lesson-page'),
      studentKey: b64('테스트 학생'),
      lessonDateStart: b64('2026-09-29T18:00:00+09:00'),
      category: b64('수업'),
    });

    assert.equal(NotionReportWebhookSchema.safeParse(decoded).success, false);
  });
});
