# 사용성 수정 및 마이그레이션 재개 순서 — 2026-10-08

## 구간별 순서
1. 사용성 수정: 선택 기준 다음 미작성 수업, 일정 반영 중 다른 저장 일정 열기, 대상 학생 미리보기, 화면 폭 통일. 이번 ZIP에서 구현/검증했습니다.
2. C-1 앱 전용 신규 등록: app-origin ID/기존 내부 ID를 구분하고 학원·학생·수강·담당·반을 원자적으로 저장, 재시도/중복 등록/계정/PIN/리포트 연결 검증. 다음 구현 묶음입니다. 기존 CORE_REGISTRATION_MIGRATION_REQUIRED 차단은 유지합니다.
3. 기존 자료 이전 준비: 현재 관리자 이전 기능으로 학생·수강·담당·반·시간표·교재의 dry-run, 건수/중복/누락/연결/권한 대조, 최종 변경분 비교. 운영 실행과 배포는 사용자 담당입니다.
4. C-1 읽기·수정·담당 권한 전환: 신규 등록 검증과 대조 완료 뒤 자료별 authority 전환. Notion 접근을 차단한 시험에서 정상 작동해야 통과합니다. 표식 수동 생성이나 낡은 Notion 경로로 단순 복귀 금지.
5. 일정·과거 일지·성적의 단계 이전: 기존 앱 저장본을 먼저 대조하고 Notion ID로 중복 방지, 진행 위치 저장, 소규모 시험, 필드/학생 연결/공개 범위/PIN 비교. 저장과 학부모 공개를 분리하고 직접 리포트 반영/실패 복구 유지.
6. 남은 문자 템플릿·상담·조회 경로 전환과 배포 후 비용/속도 확인. 실제 SMS 발송과 Make 중단은 별도 승인 전 실행하지 않습니다.

## 이번 변경
- todayLessonProgress/TeacherTodayLessons: 현재 학생·날짜·과목·시작 시간에 해당하는 선택 뒤에서 미작성만 탐색, 끝이면 앞쪽으로 한 번 순환. 현재 선택 자체는 건너뜁니다. 선택이 없으면 기존 최초 미작성 선택.
- TeacherScheduleEditor: 저장 목록 fieldset은 반영 중에도 읽기 선택 가능. 대상 학생 이름은 이미 로드한 data.students로 표시. 비동기 완료는 editorVersion이 같을 때만 현재 id/revision/baseline/notice 갱신.
- TeacherWorkspace: 저장 목록에서 다른 일정 선택은 nonce를 바꿔 기존 일정별 작업 잠금과 새 편집을 분리. 저장/반영 API와 payload, 서버 권한, 기존 confirm 흐름은 유지합니다.
- 장소 옵션은 다이얼로그 최초 로드/명시 새로고침 때 조회하고, 같은 창의 일정 선택에는 다시 요청하지 않습니다.
- teacherWorkspace.css: 모든 상단 탭 공통 최대 폭 1440px. 수업 일지의 기존 1440px 기준을 사용합니다. 입력 폼 내부 배치는 변경하지 않았습니다.

## 리포트 지연과 Notion 의존 조사
- loadTeacherReportReview 본문: lessonReports/studentSchedules/학생 과제 완료/슬러그 등을 Firestore에서 읽습니다. 온라인 loadTeacherOnlineLearning도 Firestore 조회입니다.
- teacherWorkspaceAuth의 teacherActor: coreActive=false이고 workspace profile에 notionTeacherPageId가 있으면 notionTeachingScopes를 호출합니다. coreActive=true에서는 readCoreScopes를 사용합니다. 따라서 본문만 Firestore라고 해서 전체 요청이 Notion과 독립된 것은 아닙니다.
- 성적 로더와 다른 미전환 소비 경로는 각 전환 구간에서 추가 대조해야 합니다. 이번에 인증 우회나 캐시/권한 완화를 하지 않았습니다.
- 실제 계정의 coreActive 값, Notion 호출 시간/횟수, 실제 이전 진행률은 확인하지 못했습니다. 화면만 보고 지연 중 Notion 비중을 수치로 추정하지 않습니다.

## 검증과 제한
lint/build 통과. 전체 632개 테스트 통과, 추가 경쟁상황 테스트 포함 관련 10개 재통과(추가 이후 전체 개수는 633개). 저장 payload 스냅샷은 그대로 비교 통과합니다. 이전 응답이 다른 일정 폼을 덮어쓰지 않는 VM 경쟁상황 검증 통과.
브라우저 초기화 실패가 이전 작업에서 지속되어 이번에도 실제 화면/너비/클릭 동작/응답 시간 실측은 하지 못했습니다. 운영 배포·Firestore 자료 이전/authority 활성화·SMS·Make 변경은 실행하지 않았습니다.

이번은 1번 구현 묶음이며, 데이터 마이그레이션 완료를 뜻하지 않습니다. 누적 ZIP과 이 재개 기록을 전달하고 구간 경계에서 멈춥니다. 다음은 2번 신규 등록 구현입니다.
