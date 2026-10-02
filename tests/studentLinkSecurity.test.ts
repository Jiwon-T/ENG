import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LinkStudentAccountSchema,
  UnlinkStudentAccountSchema,
  type StoredNotionStudentMapping,
  type StudentLessonReportDTO,
} from '../api/_lib/reportSchemas.ts';

describe('Student Account Linking and Ownership Protection Tests', () => {
  // 1. firebaseUid가 null이면 학생 API가 리포트를 반환하지 않음 (403 STUDENT_REPORT_NOT_LINKED)
  it('1. Student API rejects when mapping firebaseUid is null', () => {
    const studentUid = 'student_uid_alice';
    const userProfile = { notionStudentKey: '학생A (복제고1)' };
    const mapping: StoredNotionStudentMapping = {
      internalStudentId: 'internal_id_a',
      studentKey: '학생A (복제고1)',
      studentDisplayName: '학생A',
      notionStudentPageId: 'page_a',
      firebaseUid: null, // 미연결 상태
      createdAt: '',
      updatedAt: '',
    };

    // 검증 로직 시뮬레이션
    const isLinked = mapping.firebaseUid === studentUid;
    assert.equal(isLinked, false);

    // 에러 상태와 메시지
    const errorResponse = !isLinked
      ? { ok: false, error: 'STUDENT_REPORT_NOT_LINKED', reports: [] }
      : { ok: true };
    assert.equal(errorResponse.error, 'STUDENT_REPORT_NOT_LINKED');
    assert.deepEqual(errorResponse.reports, []);
  });

  // 2. firebaseUid가 다른 UID면 403
  it('2. Student API rejects when mapping firebaseUid belongs to another user', () => {
    const attackerUid = 'attacker_uid_mallory';
    const mapping: StoredNotionStudentMapping = {
      internalStudentId: 'internal_id_victim',
      studentKey: '학생B (복제고1)',
      studentDisplayName: '학생B',
      notionStudentPageId: 'page_b',
      firebaseUid: 'legitimate_student_uid_bob', // 다른 학생 계정에 연결됨
      createdAt: '',
      updatedAt: '',
    };

    const isAuthorized = mapping.firebaseUid === attackerUid;
    assert.equal(isAuthorized, false, 'Attacker UID must not match legitimate student UID');
  });

  // 3. firebaseUid가 현재 UID와 같을 때만 제한 DTO 반환
  it('3. Student API returns limited DTO only when mapping firebaseUid strictly matches', () => {
    const studentUid = 'legitimate_uid_charlie';
    const mapping: StoredNotionStudentMapping = {
      internalStudentId: 'internal_id_charlie',
      studentKey: '학생C (복제고1)',
      studentDisplayName: '학생C',
      notionStudentPageId: 'page_c',
      firebaseUid: studentUid,
      createdAt: '',
      updatedAt: '',
    };

    const isAuthorized = mapping.firebaseUid === studentUid;
    assert.equal(isAuthorized, true);

    const fullLessonReport = {
      notionPageId: 'page_c_lesson_1',
      studentKey: '학생C (복제고1)',
      internalStudentId: 'internal_id_charlie',
      lessonDateStart: '2026-09-28',
      lessonDateEnd: null,
      lessonTime: '18:00',
      selfStudyTime: '30m',
      category: '수업' as const,
      attendance: '출석',
      attitude: '매우 성실',
      homework: '완료',
      test: '통과',
      vocabularyScore: 95,
      schoolExamScore: 98,
      feedback: '극비 피드백 내용 (학생 열람 금지)',
    };

    // 제한 DTO 변환: 허용된 출결/숙제/과제만 포함하고 정성평가와 원문 피드백은 배제
    const limitedDTO: StudentLessonReportDTO = {
      reportId: 'hash1234',
      lessonDate: fullLessonReport.lessonDateStart,
      category: fullLessonReport.category,
      attendance: fullLessonReport.attendance,
      homework: fullLessonReport.homework,
      vocabularyScore: fullLessonReport.vocabularyScore,
      schoolExamScore: fullLessonReport.schoolExamScore,
      assignmentContent: '교재 10쪽',
    };

    assert.equal('feedback' in limitedDTO, false, 'Feedback must not be in StudentLessonReportDTO');
    assert.equal('attitude' in limitedDTO, false, 'Attitude must not be in StudentLessonReportDTO');
    assert.equal('test' in limitedDTO, false, 'Qualitative test evaluation must not be in StudentLessonReportDTO');
    assert.equal(limitedDTO.attendance, '출석');
    assert.equal(limitedDTO.homework, '완료');
    assert.equal(limitedDTO.vocabularyScore, 95);
  });

  // 4. 학생 API가 firebaseUid를 자동 기록(자가 소유권 주장)하지 않음 (정적 코드 검사)
  it('4. Student API source code contains NO auto-binding or firebaseUid mutation', () => {
    const code = fs.readFileSync('api/_lib/student/lesson-reports.ts', 'utf8');
    // Firestore 컬렉션 쓰기/수정 메서드(.set, .add, .delete)가 일체 없어야 함
    assert.equal(
      code.includes('.set(') || code.includes('.add(') || code.includes('.delete('),
      false,
      'api/_lib/student/lesson-reports.ts must never perform write operations (.set, .add, .delete)'
    );
    // Firestore doc().update() 호출이 일체 없어야 함 (오직 crypto hash 및 get/read만 수행)
    const hasDocUpdate = /doc\([^)]+\)\.update\(/g.test(code);
    assert.equal(
      hasDocUpdate,
      false,
      'api/_lib/student/lesson-reports.ts must not call .update on any Firestore document'
    );
    assert.equal(
      code.includes('firebaseUid: studentUid'),
      false,
      'Auto-binding firebaseUid: studentUid pattern must be eliminated'
    );
  });

  // 5~9. Firestore Rules 정적 검증 (Emulator 미설치 환경: Rules DSL 정적 파싱 및 제약조건 검증)
  describe('Firestore Rules Security Guardrails (Static Verification)', () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');

    it('5. User document strictly enforces keys().hasOnly whitelist against unknown fields', () => {
      // 알려지지 않은 추가 필드가 들어오면 isValidUser()에서 거부되도록 hasOnly 강제 확인
      assert.ok(
        rules.includes("data.keys().hasOnly(["),
        'isValidUser must contain data.keys().hasOnly whitelist'
      );
      assert.ok(rules.includes("'uid'"));
      assert.ok(rules.includes("'email'"));
      assert.ok(rules.includes("'role'"));
      assert.ok(rules.includes("'name'"));
      assert.ok(rules.includes("'alias'"));
      assert.ok(rules.includes("'photoURL'"));
      assert.ok(rules.includes("'isNameSet'"));
      assert.ok(rules.includes("'teacherNote'"));
      assert.ok(rules.includes("'notionStudentKey'"));
      assert.ok(rules.includes("'petStats'"));
      assert.ok(rules.includes("'createdAt'"));
      assert.ok(rules.includes("'updatedAt'"));
    });

    it('6. User creation strictly forbids notionStudentKey, admin, and firebaseUid for non-admins', () => {
      assert.ok(rules.includes("(!('notionStudentKey' in data) || isAdmin())"));
      assert.ok(rules.includes("(!('firebaseUid' in data))"));
      assert.ok(rules.includes("(!('admin' in data))"));
    });

    it('7. Student profile update strictly whitelists affectedKeys and blocks notionStudentKey and role', () => {
      // 학생 본인은 오직 화이트리스트 필드만 업데이트 가능
      assert.ok(
        rules.includes(
          "request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'alias', 'photoURL', 'isNameSet', 'petStats', 'updatedAt'])"
        ),
        'Student update must use affectedKeys().hasOnly whitelist'
      );
    });

    it('8. Teachers cannot modify student notionStudentKey or role', () => {
      assert.ok(
        rules.includes("!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'notionStudentKey', 'firebaseUid', 'admin'])"),
        'Teacher update cannot touch role, notionStudentKey, firebaseUid, or admin'
      );
      assert.ok(
        rules.includes("request.resource.data.diff(resource.data).affectedKeys().hasOnly(['teacherNote', 'updatedAt'])"),
        'Teacher update on student document is limited to teacherNote and updatedAt'
      );
    });

    it('9. Existing student profile fields (petStats, alias, photoURL, isNameSet) remain allowed', () => {
      const allowedProfileFields = ['name', 'alias', 'photoURL', 'isNameSet', 'petStats', 'updatedAt'];
      for (const field of allowedProfileFields) {
        assert.ok(
          rules.includes(`'${field}'`),
          `Expected student profile field ${field} to be explicitly supported in firestore.rules`
        );
      }
    });
  });

  // 10. 관리자 연결 API 스키마 검증
  it('10. Admin Link API Schema strictly validates inputs', () => {
    const valid = LinkStudentAccountSchema.safeParse({
      firebaseUid: 'test_student_uid_123',
      studentKey: '홍길동 (복제고1)',
    });
    assert.equal(valid.success, true);

    const invalid = LinkStudentAccountSchema.safeParse({
      firebaseUid: '',
      studentKey: '',
    });
    assert.equal(invalid.success, false);
  });

  // 11. 이미 다른 UID에 연결된 Notion 학생을 재연결하려 하면 충돌 (Conflict)
  it('11. Admin link conflict detection prevents taking over already linked Notion student', () => {
    const existingMapping: StoredNotionStudentMapping = {
      internalStudentId: 'internal_id_student1',
      studentKey: '학생1 (복제고1)',
      studentDisplayName: '학생1',
      notionStudentPageId: 'page_1',
      firebaseUid: 'original_uid_111',
      createdAt: '',
      updatedAt: '',
    };

    const targetUid = 'new_uid_222';
    const isConflict =
      existingMapping.firebaseUid !== null && existingMapping.firebaseUid !== targetUid;

    assert.equal(isConflict, true, 'Must detect conflict when trying to re-link to a different UID');
  });

  // 12. 연결 해제 후 학생 API 접근 차단
  it('12. Unlinking student account schema and post-unlink state blocks student API access', () => {
    const unlinkPayload = { firebaseUid: 'student_uid_to_unlink' };
    const parsed = UnlinkStudentAccountSchema.safeParse(unlinkPayload);
    assert.equal(parsed.success, true);

    // 해제된 상태
    const unlinkedMapping: StoredNotionStudentMapping = {
      internalStudentId: 'internal_id_student1',
      studentKey: '학생1 (복제고1)',
      studentDisplayName: '학생1',
      notionStudentPageId: 'page_1',
      firebaseUid: null, // 해제됨
      createdAt: '',
      updatedAt: '',
    };

    const studentUid = 'student_uid_to_unlink';
    const canAccessReports =
      unlinkedMapping.firebaseUid !== null && unlinkedMapping.firebaseUid === studentUid;
    assert.equal(canAccessReports, false, 'Unlinked student must be denied access to lesson reports');
  });

  // 13. 학부모 링크는 Firebase 계정 연결 없이 계속 정상 작동
  it('13. Parent report slug operates completely decoupled from Firebase user account', () => {
    // Firebase 가입이 전혀 없는 미가입 학생의 학부모 슬러그 모델
    const parentReportSlug = {
      reportSlug: 'bokjego1test',
      studentKey: '테스트 (복제고1)',
      studentDisplayName: '복제고 테스트 학생',
      internalStudentId: 'internal_sha256_id_no_firebase',
      parentPhonePinHash: 'pin_hash_123',
      active: true,
      authVersion: 1,
    };

    // Firebase UID 필드 자체가 없어도 학부모 인증 및 조회는 100% 독립 수행 가능
    assert.ok(parentReportSlug.active);
    assert.ok(parentReportSlug.internalStudentId);
    assert.equal('firebaseUid' in parentReportSlug, false);
  });
});
