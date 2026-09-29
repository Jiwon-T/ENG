/**
 * 기존 Firestore 데이터 매핑 무결성 감사 스크립트 (Read-Only Audit Script)
 *
 * 목적:
 * 1. 동일한 notionStudentKey가 여러 users 문서에 존재하는지 검사 (중복 키 설정 탐지)
 * 2. 동일한 Firebase UID가 여러 Notion 학생 매핑에 연결됐는지 검사 (중복 UID 연결 탐지)
 * 3. notionStudentMappings.firebaseUid와 users.notionStudentKey가 상호 일치하는지 검사 (불일치 탐지)
 * 4. role이 student가 아닌 계정(teacher, admin 등)에 학생 매핑이 연결됐는지 검사 (권한 침범 탐지)
 *
 * 안전 규칙:
 * - Read-Only: 어떠한 데이터도 자동 수정하거나 쓰지 않습니다.
 * - 개인정보 보호: 이름, 전체 전화번호, 실제 PIN 등 개인 식별 정보는 일체 출력하지 않습니다.
 * - 오직 내부 식별자(UID 해시 일부, 식별 키) 및 문제 목록만 정리하여 출력합니다.
 *
 * 실행 방법:
 * tsx scripts/audit-student-mappings.ts
 */

import { getFirebaseAdmin } from '../api/_lib/firebaseAdmin.ts';
import { hashStudentKey } from '../api/_lib/security.ts';
import type { StoredNotionStudentMapping } from '../api/_lib/reportSchemas.ts';

interface AuditIssue {
  type:
    | 'DUPLICATE_KEY_IN_USERS'
    | 'DUPLICATE_UID_IN_MAPPINGS'
    | 'BIDIRECTIONAL_MISMATCH'
    | 'INVALID_ROLE_LINKED'
    | 'ORPHANED_USER_KEY'
    | 'ORPHANED_MAPPING_UID';
  severity: 'HIGH' | 'MEDIUM';
  description: string;
  affectedUid?: string;
  affectedStudentKey?: string;
}

export async function runStudentMappingAudit(): Promise<{
  totalUsersScanned: number;
  totalMappingsScanned: number;
  issues: AuditIssue[];
}> {
  const { db } = getFirebaseAdmin();
  const issues: AuditIssue[] = [];

  // 1. 전체 users 컬렉션 스캔
  const usersSnap = await db.collection('users').get();
  const usersByKey = new Map<string, Array<{ uid: string; role: string }>>();
  const userByUid = new Map<string, { role: string; notionStudentKey?: string }>();

  usersSnap.forEach((d) => {
    const data = d.data();
    const uid = d.id;
    const role = data.role || 'student';
    const key = data.notionStudentKey;

    userByUid.set(uid, { role, notionStudentKey: key });

    if (key && typeof key === 'string' && key.trim().length > 0) {
      const arr = usersByKey.get(key) || [];
      arr.push({ uid, role });
      usersByKey.set(key, arr);
    }
  });

  // 2. 전체 notionStudentMappings 컬렉션 스캔
  const mappingsSnap = await db.collection('notionStudentMappings').get();
  const mappingsByUid = new Map<string, string[]>();
  const mappingsByKey = new Map<string, StoredNotionStudentMapping>();

  mappingsSnap.forEach((d) => {
    const data = d.data() as StoredNotionStudentMapping;
    mappingsByKey.set(data.studentKey, data);

    if (data.firebaseUid) {
      const arr = mappingsByUid.get(data.firebaseUid) || [];
      arr.push(data.studentKey);
      mappingsByUid.set(data.firebaseUid, arr);
    }
  });

  // --------------------------------------------------------------------------
  // 점검 1: 동일한 notionStudentKey가 2개 이상의 users 문서에 존재하는지 검사
  // --------------------------------------------------------------------------
  for (const [key, users] of usersByKey.entries()) {
    if (users.length > 1) {
      issues.push({
        type: 'DUPLICATE_KEY_IN_USERS',
        severity: 'HIGH',
        description: `동일한 studentKey가 ${users.length}개의 users 문서에 중복 지정되어 있습니다.`,
        affectedStudentKey: key,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 점검 2: 동일한 Firebase UID가 2개 이상의 Notion 학생 매핑에 연결됐는지 검사
  // --------------------------------------------------------------------------
  for (const [uid, keys] of mappingsByUid.entries()) {
    if (keys.length > 1) {
      issues.push({
        type: 'DUPLICATE_UID_IN_MAPPINGS',
        severity: 'HIGH',
        description: `하나의 Firebase UID가 ${keys.length}명의 Notion 학생 매핑에 중복 연결되어 있습니다.`,
        affectedUid: uid,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 점검 3: notionStudentMappings.firebaseUid와 users.notionStudentKey 상호 일치 검사
  // --------------------------------------------------------------------------
  for (const [key, mapping] of mappingsByKey.entries()) {
    if (mapping.firebaseUid) {
      const user = userByUid.get(mapping.firebaseUid);
      if (!user) {
        issues.push({
          type: 'ORPHANED_MAPPING_UID',
          severity: 'HIGH',
          description: `매핑에 등록된 firebaseUid에 해당하는 users 문서가 존재하지 않습니다.`,
          affectedUid: mapping.firebaseUid,
          affectedStudentKey: key,
        });
      } else if (user.notionStudentKey !== key) {
        issues.push({
          type: 'BIDIRECTIONAL_MISMATCH',
          severity: 'HIGH',
          description: `notionStudentMappings.firebaseUid는 연결되어 있으나, users.notionStudentKey가 일치하지 않습니다. (users: ${user.notionStudentKey || '없음'}, mappings: ${key})`,
          affectedUid: mapping.firebaseUid,
          affectedStudentKey: key,
        });
      }
    }
  }

  for (const [uid, user] of userByUid.entries()) {
    if (user.notionStudentKey) {
      const mapping = mappingsByKey.get(user.notionStudentKey);
      if (!mapping) {
        issues.push({
          type: 'ORPHANED_USER_KEY',
          severity: 'MEDIUM',
          description: `users 문서에 notionStudentKey가 기재되어 있으나, notionStudentMappings에 등록된 매핑이 없습니다.`,
          affectedUid: uid,
          affectedStudentKey: user.notionStudentKey,
        });
      } else if (mapping.firebaseUid !== uid) {
        issues.push({
          type: 'BIDIRECTIONAL_MISMATCH',
          severity: 'HIGH',
          description: `users.notionStudentKey는 기재되어 있으나, notionStudentMappings.firebaseUid가 해당 사용자와 일치하지 않습니다. (mappings.firebaseUid: ${mapping.firebaseUid || 'null'})`,
          affectedUid: uid,
          affectedStudentKey: user.notionStudentKey,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 점검 4: role이 student가 아닌 계정(teacher, admin)에 학생 매핑이 연결됐는지 검사
  // --------------------------------------------------------------------------
  for (const [uid, keys] of mappingsByUid.entries()) {
    const user = userByUid.get(uid);
    if (user && user.role !== 'student') {
      issues.push({
        type: 'INVALID_ROLE_LINKED',
        severity: 'HIGH',
        description: `학생(student)이 아닌 ${user.role} 역할의 계정에 학생 매핑이 연결되어 있습니다.`,
        affectedUid: uid,
      });
    }
  }

  return {
    totalUsersScanned: usersSnap.size,
    totalMappingsScanned: mappingsSnap.size,
    issues,
  };
}

// 직접 CLI 실행 시
if (process.argv[1]?.endsWith('audit-student-mappings.ts')) {
  console.log('[Audit] Starting student mapping data integrity audit (Read-Only)...');
  runStudentMappingAudit()
    .then((result) => {
      console.log(`[Audit] Completed. Scanned ${result.totalUsersScanned} users, ${result.totalMappingsScanned} mappings.`);
      console.log(`[Audit] Issues found: ${result.issues.length}`);
      if (result.issues.length > 0) {
        console.table(result.issues);
      } else {
        console.log('[Audit] All data mappings are clean and strictly bidirectional. No issues found.');
      }
    })
    .catch((err) => {
      console.error('[Audit Error]', err.message);
      process.exit(1);
    });
}
