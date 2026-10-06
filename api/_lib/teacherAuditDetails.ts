import {workspaceError} from './teacherWorkspaceError.js';
export function auditPendingDetails(collection:string,r:any){
 const state=r.syncStatus||r.stage||r.status||'unknown';
 const kinds:Record<string,string>={teacherLessonDrafts:'수업 일지',teacherAcademicDrafts:'성적',teacherSchedules:'일정',teacherStudentRegistrations:'신입생 등록',teacherStudentEdits:'학생 정보 수정',teacherStudentEnrollmentEdits:'수강·담당·반 변경',teacherMessages:'문자'};
 const states:Record<string,string>={failed:'반영 실패',report_published_notion_pending:'앱 리포트 저장 · 노션 확인 필요',reflection_pending:'노션 저장 · 앱 연동 확인 필요',publishing:'반영 요청 처리 중',processing:'반영 결과 확인 중',notion_saved:'노션 저장 · 최종 완료 확인 필요',syncing:'동기화 처리 중',uncertain:'요청 결과 불명확',prepared:'본문 준비 · 노션 백업 확인 필요',sending:'발송 요청 시작 · 접수 결과 확인 필요'};
 const kind=kinds[collection]||'작업',isMessage=collection==='teacherMessages';
 let nextAction=isMessage?(state==='prepared'?'학생 관리 → 문자에서 저장된 본문 백업을 다시 확인하세요.':'Bati에서 접수 여부를 확인하세요. 결과 확인 전 다시 발송하지 마세요.'):
 collection==='teacherLessonDrafts'?'일지 조회에서 해당 날짜·학생 기록을 열어 저장 결과 확인·재시도를 실행하세요.':
 collection==='teacherAcademicDrafts'?'성적 관리에서 해당 학생·시험 기록을 열어 저장 결과 확인·재시도를 실행하세요.':
 collection==='teacherSchedules'?'일정 관리에서 해당 날짜·학생 기록을 열어 저장 결과 확인·재시도를 실행하세요.':
 collection==='teacherStudentRegistrations'?'학생 관리 → 신입생 등록에서 저장한 등록 요청의 결과 확인·재시도를 실행하세요.':
 collection==='teacherStudentEdits'?'학생 관리 → 해당 학생 → 정보 수정에서 기존 요청 결과를 확인하세요.':'학생 관리 → 해당 학생 → 수강·담당·반 변경에서 기존 요청 결과를 확인하세요.';
 if(r.deleteRequested){nextAction=`${kind} 관리에서 해당 기록의 삭제·취소 결과를 확인하세요. 같은 요청으로 복구하고 새 기록을 만들지 마세요.`;}
 const failure=r.failureCode||r.syncError;
 const failureReason=typeof failure==='string'?workspaceError(new Error(failure),'audit').body.message:undefined;
 return {workType:kind,state:r.deleteRequested?'삭제 결과 확인 필요':states[state]||'완료 상태 미확정',date:r.data?.date||r.data?.examDate||null,subject:r.data?.subject||r.subject||null,message:`${kind}: ${r.deleteRequested?'삭제 결과 확인 필요':states[state]||'완료 상태 미확정'}`,details:[...(['teacherLessonDrafts','teacherAcademicDrafts','teacherSchedules'].includes(collection)?[collection==='teacherLessonDrafts'?(r.directReportRevision===r.revision?'현재 수정본의 앱 리포트 저장 기록 있음':'현재 수정본의 앱 리포트 저장 완료 기록 없음'):(r.academicProjectionDoneRevision===r.revision||r.scheduleProjectionDoneRevision===r.revision?'현재 수정본의 앱 리포트 저장 기록 있음':'현재 수정본의 앱 리포트 저장 완료 기록 없음'),r.notionWrite?.done?'노션 저장 완료 기록 있음':'노션 저장 최종 확인 기록 없음']:[]),...(failureReason?[`최근 오류: ${failureReason}`]:[])],nextAction};
}
