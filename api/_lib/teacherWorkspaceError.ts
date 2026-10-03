import { randomUUID } from 'node:crypto';
import { z } from 'zod';
export function workspaceError(error: unknown, failureStage: string) {
 const raw = error instanceof Error ? error.message : '';
 const allowed = ['UNAUTHORIZED','SESSION_REVOKED','FORBIDDEN','TEACHER_NOT_CONFIGURED','DRAFT_CONFLICT','SOURCE_IDENTITY_LOCKED','PUBLISH_IN_PROGRESS','NOTION_SCHEMA_SETUP_REQUIRED','MAKE_TRIGGER_NOT_CONFIGURED','MAKE_TRIGGER_FAILED','MAKE_SUBJECT_NOT_CONFIGURED','TEACHER_NOTION_LINK_REQUIRED','LESSON_ROUNDS_REQUIRED','SELF_STUDY_REQUIRED','LESSON_OR_STUDY_REQUIRED','ACADEMY_REQUIRED','INVALID_TEACHER','ACADEMY_MIGRATION_REQUIRED','ACADEMY_MEMBERSHIP_CONFLICT'];
 const config = raw.startsWith('CONFIG_ERROR') || raw === 'AUTH_SERVER_CONFIG_ERROR';
 const notion = /^NOTION_/.test(raw);
 const missingIndex = failureStage === 'report-review' && /requires an index|FAILED_PRECONDITION.*index/i.test(raw);
 const code = error instanceof z.ZodError ? 'INVALID_INPUT' : missingIndex ? 'REPORT_INDEX_REQUIRED' : config ? 'SERVER_CONFIG_ERROR' : allowed.includes(raw) ? raw : notion ? 'NOTION_CONNECTION_ERROR' : 'WORKSPACE_ERROR';
 const diagnosticId = randomUUID();
 const messages: Record<string,string> = {SERVER_CONFIG_ERROR:'서버 인증·연결 설정을 확인해야 합니다.',UNAUTHORIZED:'로그인 인증이 만료되었습니다. 다시 로그인해 주세요.',SESSION_REVOKED:'로그인이 해제되었습니다. 다시 로그인해 주세요.',NOTION_CONNECTION_ERROR:'Notion 연결 권한과 데이터베이스 설정을 확인해야 합니다.',LESSON_ROUNDS_REQUIRED:'수업이 있는 날은 출결과 수업 회차를 입력해 주세요.',SELF_STUDY_REQUIRED:'자습 여부를 선택하고, 자습이 있는 날은 시간과 회차를 입력해 주세요.',LESSON_OR_STUDY_REQUIRED:'수업 또는 자습 중 하나 이상을 기록해 주세요.'};
 messages.ACADEMY_MIGRATION_REQUIRED='이미 연결된 선생님의 학원 변경은 기존 기록을 함께 이전해야 합니다.';
 messages.ACADEMY_MEMBERSHIP_CONFLICT='다른 학원에 연결된 학생이 포함되어 있습니다. 소속 학원을 확인해 주세요.';
 messages.REPORT_INDEX_REQUIRED = '리포트 조회에 필요한 서버 인덱스 설정을 확인해야 합니다.';
 return {status: ['UNAUTHORIZED','SESSION_REVOKED'].includes(code) ? 401 : code === 'FORBIDDEN' ? 403 : ['SERVER_CONFIG_ERROR','WORKSPACE_ERROR','REPORT_INDEX_REQUIRED'].includes(code) ? 500 : code === 'NOTION_CONNECTION_ERROR' ? 502 : code === 'INVALID_INPUT' || code.includes('REQUIRED') ? 400 : 409, body:{ok:false,error:code,message:messages[code],failureStage,diagnosticId}};
}
