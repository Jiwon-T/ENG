import { randomUUID } from 'node:crypto';
import { z } from 'zod';
export function workspaceError(error: unknown, failureStage: string) {
 const raw = error instanceof Error ? error.message : '';
 const allowed = ['COMMON_PLAN_NOT_SYNCED','INVALID_INPUT','UNAUTHORIZED','SESSION_REVOKED','FORBIDDEN','TEACHER_NOT_CONFIGURED','DRAFT_CONFLICT','SOURCE_IDENTITY_LOCKED','PUBLISH_IN_PROGRESS','NOTION_SCHEMA_SETUP_REQUIRED','MAKE_TRIGGER_NOT_CONFIGURED','MAKE_TRIGGER_FAILED','MAKE_SUBJECT_NOT_CONFIGURED','TEACHER_NOTION_LINK_REQUIRED','LESSON_ROUNDS_REQUIRED','SELF_STUDY_REQUIRED','LESSON_OR_STUDY_REQUIRED','ACADEMY_REQUIRED','INVALID_TEACHER','ACADEMY_MIGRATION_REQUIRED','ACADEMY_MEMBERSHIP_CONFLICT','NOTION_EDIT_CONFLICT','NOTION_SOURCE_NOT_CONFIGURED','NOTION_SOURCE_MISMATCH','NOTION_SHARED_TIMETABLE','NOTION_SOURCE_OWNER_CONFLICT','NOTION_DUPLICATE_ENROLLMENT','NOTION_ENROLLMENT_REQUIRED','NOTION_DUPLICATE_SOURCE'];
 const config = raw.startsWith('CONFIG_ERROR') || raw === 'AUTH_SERVER_CONFIG_ERROR';
 const notion = /^NOTION_/.test(raw);
 const missingIndex = failureStage === 'report-review' && /requires an index|FAILED_PRECONDITION.*index/i.test(raw);
 const code = error instanceof z.ZodError ? 'INVALID_INPUT' : missingIndex ? 'REPORT_INDEX_REQUIRED' : config ? 'SERVER_CONFIG_ERROR' : allowed.includes(raw) ? raw : notion ? 'NOTION_CONNECTION_ERROR' : 'WORKSPACE_ERROR';
 const diagnosticId = randomUUID();
 const messages: Record<string,string> = {SERVER_CONFIG_ERROR:'서버 인증·연결 설정을 확인해야 합니다.',UNAUTHORIZED:'로그인 인증이 만료되었습니다. 다시 로그인해 주세요.',SESSION_REVOKED:'로그인이 해제되었습니다. 다시 로그인해 주세요.',NOTION_CONNECTION_ERROR:'Notion 연결 권한과 데이터베이스 설정을 확인해야 합니다.',LESSON_ROUNDS_REQUIRED:'수업이 있는 날은 출결과 수업 회차를 입력해 주세요.',SELF_STUDY_REQUIRED:'자습 여부를 선택하고, 자습이 있는 날은 시간과 회차를 입력해 주세요.',LESSON_OR_STUDY_REQUIRED:'수업 또는 자습 중 하나 이상을 기록해 주세요.'};
 messages.NOTION_SHARED_DATA_REQUIRED='기존 반·커리큘럼의 담당 선생님·과목·학원 연결을 먼저 확인해 주세요.';
 messages.NOTION_LEGACY_MIGRATION_REQUIRED='기존 선생님별 DB 자료를 공용 DB로 옮긴 뒤 공용 연결을 시작해 주세요.';
 messages.NOTION_TEACHER_ID_CONFLICT='같은 노션 선생님 페이지가 여러 계정에 연결되어 있습니다. 관리자 설정을 확인해 주세요.';
 messages.NOTION_EDIT_CONFLICT='노션에서 이 자료가 변경되었습니다. 새로고침하고 다시 선택한 뒤 수정해 주세요.';
 messages.NOTION_SOURCE_NOT_CONFIGURED='이 선생님의 과목별 노션 DB를 관리자 설정에서 연결해 주세요.';
 messages.NOTION_SOURCE_OWNER_CONFLICT='같은 반 또는 커리큘럼 DB가 여러 선생님에게 연결되어 있습니다. 소속과 담당 DB 연결을 확인해 주세요.';
 messages.NOTION_SOURCE_MISMATCH='연결한 노션 DB와 자료의 원본 DB가 다릅니다. DB 연결을 확인해 주세요.';
 messages.NOTION_ENROLLMENT_REQUIRED='DB_수강에 학생당 하나의 수강 페이지가 필요합니다.';
 messages.NOTION_DUPLICATE_ENROLLMENT='DB_수강에 동일 학생의 페이지가 여러 개 있습니다. 중복을 확인해 주세요.';
 messages.NOTION_DUPLICATE_SOURCE='한 과목에는 DB 연결을 하나만 등록해 주세요.';
 messages.NOTION_SHARED_TIMETABLE='여러 반이 공동 사용 중인 시간표입니다. 해당 반 전용 시간대로 분리한 뒤 수정해 주세요.';
 messages.ACADEMY_MIGRATION_REQUIRED='이미 연결된 선생님의 학원 변경은 기존 기록을 함께 이전해야 합니다.';
 messages.ACADEMY_MEMBERSHIP_CONFLICT='다른 학원에 연결된 학생이 포함되어 있습니다. 소속 학원을 확인해 주세요.';
 messages.COMMON_PLAN_NOT_SYNCED='공통 교재를 먼저 노션에 반영한 뒤 반에서 선택해 주세요.';
 messages.INVALID_INPUT='입력한 값과 중복된 교재 선택을 확인해 주세요.';
 messages.REPORT_INDEX_REQUIRED = '리포트 조회에 필요한 서버 인덱스 설정을 확인해야 합니다.';
 return {status: ['UNAUTHORIZED','SESSION_REVOKED'].includes(code) ? 401 : code === 'FORBIDDEN' ? 403 : ['SERVER_CONFIG_ERROR','WORKSPACE_ERROR','REPORT_INDEX_REQUIRED'].includes(code) ? 500 : code === 'NOTION_EDIT_CONFLICT' ? 409 : code === 'NOTION_CONNECTION_ERROR' ? 502 : code === 'INVALID_INPUT' || code.includes('REQUIRED') ? 400 : 409, body:{ok:false,error:code,message:messages[code],failureStage,diagnosticId}};
}
