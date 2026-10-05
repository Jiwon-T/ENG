export function assignmentError(code:string='') {
 if(code.startsWith('ASSIGNMENT_SCHEMA:'))return `노션 DB 속성 확인 필요: ${code.slice(18)}. 해당 속성의 종류와 연결 대상을 확인하세요.`;
 const messages:Record<string,string>={NOTION_TEACHER_ID_CONFLICT:'같은 노션 선생님 페이지가 여러 앱 계정에 연결됐습니다. 다른 계정의 중복 연결을 먼저 확인하세요.',NOTION_SOURCE_NOT_CONFIGURED:'이 학원의 학생·수강·선생님 노션 DB 연결을 확인하세요.',TEACHER_NOTION_LINK_REQUIRED:'DB_선생님의 선생님 페이지를 먼저 연결하세요.',NOTION_SOURCE_MISMATCH:'선택한 페이지가 DB_선생님의 선생님 페이지인지 확인하세요.',TEACHER_NOT_CONFIGURED:'연결한 선생님이 중단·휴직 상태이거나 삭제되었습니다.',NOTION_ENROLLMENT_REQUIRED:'DB_수강에서 학생당 수강 페이지가 정확히 한 개 있는지 확인하세요.',NOTION_RELATION_INCOMPLETE:'담당 관계 전체를 읽지 못했습니다. 기존 담당을 보존하기 위해 반영을 멈췄습니다.',NOTION_400:'노션이 속성 종류 또는 관계 값을 거절했습니다. 담당 관계의 연결 대상과 담당 과목 옵션을 확인하세요.',NOTION_401:'서버의 노션 연결 토큰 인증을 확인하세요.',NOTION_403:'노션 연결에 학생·수강·선생님 DB의 접근 권한을 부여하세요.',NOTION_404:'수강·선생님 DB와 페이지 주소 및 연결 공유 권한을 확인하세요.',NOTION_429:'노션 요청 제한입니다. 잠시 후 저장한 담당 범위로 다시 반영하세요.',ASSIGNMENT_RETRY_REQUIRED:'일부 담당 변경이 반영됐을 수 있습니다. 저장한 범위를 먼저 다시 반영한 뒤 수정하세요.'};
 return messages[code]||'노션 반영 결과를 확인하지 못했습니다. 저장한 담당 범위로 다시 반영하세요.';
}
export function assignmentStatus(profile:any) {
 return profile.disabled?'사용 중지':profile.notionAssignmentStage==='synced'?'노션 반영 완료':profile.notionAssignmentStage==='failed'?'노션 반영 실패':profile.notionAssignmentStage==='pending'?'노션 반영 대기':'반영 상태 확인 필요';
}
export function assignmentNeedsRecovery(profile:any) {
 if(!['pending','failed'].includes(profile?.notionAssignmentStage))return false;
 return profile.notionAssignmentTouched??!['TEACHER_NOTION_LINK_REQUIRED','NOTION_SOURCE_MISMATCH'].includes(profile.notionAssignmentError);
}
