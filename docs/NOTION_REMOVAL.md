# Notion 의존도 제거 — 진행 기록과 검증 요청 (Claude → Codex)

역할: Claude가 ENG-repo에서 구현·커밋, Codex는 `checkpoint-10-a\ENG`에서 독립 검증(ENG-repo는 읽기만).
전환 조건(운영): 6개 영역 모두 앱 전용 — `academyCoreAuthority`, `academyClassAuthority`, `appScheduleAuthority`,
`lessonAppAuthority`, `messageTemplateAuthority`, `academicAppAuthority`가 `active: true`. 이 정리는 되돌리기(Notion 복귀)를 전제로 하지 않습니다.
원칙: 운영 데이터는 건드리지 않음(코드만), 공개 화면 ParentReportView·LearningReport 수정 없음, report-review 계약·권한·학생 계정 연결 절차 유지.

## 1단계 — 화면 (커밋 `3c94f78`)
삭제한 화면(전환 전 또는 Notion 점검 전용): ScheduleTransitionPanel, LessonMigrationPanel, NotionDisconnectPanel,
TeacherIntegrityAudit, WorkspaceSyncPanel(AcademyDirectoryManager, ManagedMigrationManager, MessageTemplateManager 본체 포함),
AcademicMigrationPanel·GradeCutoverPanel, TemplateCutoverPanel, AutomaticImportControl. `bootstrap-fast` 요청 제거.
남긴 것: 옛 선생님방(TeacherRoom 레거시) — 학부모 리포트 고정 주소(report-slug) 설정이 아직 여기에만 있음.

## 2단계 — 서버 경로·모듈 (이 커밋)
workspace.ts에서 제거한 action:
- GET: schedule-transition-audit, academic-cutover-status, integrity-audit, academic-migration-preview, notion-disconnect-status, lesson-migration-status
- POST: managed-migration-plan/-import-step/-activate, directory-*(목록·가져오기·제외·dry-run·cutover·approve; directory-restore-student는 유지),
  migrate-notion-records, retry-teacher-assignment(Notion 경로; 앱 전용 경로는 유지), enable-shared-notion, sync-notion-record, prepare-notion,
  academic-migration-reset/-next, academic-cutover/-deactivate, lesson-migration-start/-step/-pause/-hold/-hold-group, lesson-cutover/-deactivate,
  prepare-app-schedules, activate-app-schedules
- 크론 `/api/cron/lesson-migration`: Notion 일지 이전 실행 제거, 7일 지난 일지 휴지통 비우기만 유지(경로·CRON_SECRET 그대로).
삭제한 모듈: notionDisconnect, teacherIntegrityAudit, offlineMigration, scheduleReadiness, teacherMakeTrigger, messageTemplateWorker(+Firestore)
삭제한 스크립트: scripts/offline-migrate.ts, template-sync-worker.ts, template-worker.Dockerfile, prepare-template-worker-context.mjs
환경변수: MESSAGE_TEMPLATE_SYNC_ENABLED 제거(.env.example·목록 테스트).
삭제·수정한 테스트: 위 모듈 전용 테스트 삭제, appSchedule(전환 점검 3개)·messageTemplateStore(worker 2개)·academicAuthority(disconnect 확인 줄) 정리.
검증: tsc 0 · 테스트 755/755 · build 0 · 서버 import 검사 0.

## 2b단계 — Codex 중간 검토 반영 (이 커밋)
- [Codex 3] 매일 작업: 휴지통 비우기 실패를 숨기지 않음 → HTTP 500 + `LESSON_TRASH_PURGE_FAILED`(다음 날 재시도). 테스트 tests/trashCron.test.ts.
- [Codex 4] 휴지통 비우기 범위: 첫 500건만 보던 것을 archived=true 전체를 문서 순서로 페이지 넘김(하루 최대 5,000건, 남으면 more=true).
  추가 복합 인덱스 불필요(archived 단일 필드). 복원 경합 보호(트랜잭션 재확인)는 그대로. 7일 휴지통은 백업이 아님(백업은 Firestore 예약 백업 별도).
- [Codex 5] 제거한 action을 부르는 남은 화면 코드 점검 → 발견해 정리: src/lib/automaticImportRunner.ts·managedMigrationRunner.ts(삭제),
  TeacherAssignmentManager(전환 전 전용, 'prepare-notion' 버튼, 삭제), TeacherWorkspace의 캐시 무효화 목록에서 sync-notion-record·migrate-notion-records 제거.
  재점검: 제거한 action 이름을 src에서 부르는 곳 0건.
  이름만 보고 옛 기능으로 분류하지 않고 유지한 것: import-source-record(앱 전용 경로 사용 중), restore-lesson, student-link, report-slug, previous-lesson,
  directory-restore-student, retry-teacher-assignment(앱 전용 분기), template-*(문자 템플릿 목록·저장).
- [Codex 2] 리포트 조회 비용(teacherReportReview 전체 조회 후 페이지 자르기): report-review 계약·캐시는 사용자 승인 없이 바꾸지 않기로 해 보류, 사용자에게 확인 요청.
- [Codex 1] 조건부 Notion fallback(teacherWorkspaceAuth notionTeachingScopes, studentIdentity lookupStudentByPageId, teacherMessages 원본 조회·PATCH):
  3단계에서 '앱 준비 오류'로 바꾸고 Notion 토큰·학생DB 설정 없이 동작하는 테스트를 확장 예정(Codex 검증 후 진행 — 사용자 결정).
검증: tsc 0 · 테스트 746/746 · build 0 · 서버 import 검사 0.

## 4단계 — Make → Notion 웹훅 제거 (이 커밋, 사용자 승인: "Make는 안 쓰고 있어", 2026-10-10)
- 삭제: api/webhooks/notion-report.ts, notion-schedule.ts, notion-academic.ts (server.ts 개발용 경로 3개 포함). 이제 이 주소로 오는 요청은 404.
- 환경변수 MAKE_NOTION_WEBHOOK_SECRET 제거(.env.example·목록 테스트). Vercel에 남아 있어도 무해하며 지워도 됨.
- 테스트: notionReportWebhookPayload 삭제, academic(웹훅 인증 1개) 삭제, teacherLessonGrid의 Make base64 해독 단계를 직접 입력으로 대체.
- 웹훅이 쓰던 공용 모듈(lessonWebhookProjection, scheduleProjection의 Notion 부분, academic.syncAcademicPage, notionUsage.recordMakeWebhook)은 3단계에서 정리.
- 과거 Notion DB/page ID 필드·컬렉션 이름(notionStudentMappings, notionPageId 등)은 출처·식별 연결이라 유지(지우면 계정·학부모 주소가 깨짐).
검증: tsc 0 · 테스트 743/743 · build 0 · 서버 import 검사 0.

## 리포트 조회 개선 — 수업 기록 (이 커밋, 사용자 승인 2026-10-10, 3단계와 별도 커밋)
범위: 선생님방 학습 리포트의 '수업 기록' 섹션(report-review, section=lessons). 일정·성적·온라인 학습, 섹션 없는 전체 조회, 공개 화면(ParentReportView·LearningReport)은 변경 없음.
바뀐 것:
- 색인 읽기: lessonReports(internalStudentId == X)를 `select('subject','lessonDateStart')`로 읽어 색인만 만듦(본문 없음).
- 페이지 읽기: 색인에서 과목 필터 → 5개 단위로 자른 뒤, 그 5개 문서만 getAll로 전체 읽기. 사이에 지워진 문서는 건너뜀.
- 과제 완료: 학생 시점에서 그 5개의 lessonReportId만 getAll(이전: assignmentCompletions 전체). contentHash 비교 그대로(과제 수정 후 완료 표시 안 붙음). 학부모 시점·미연결 학생은 읽지 않음.
Codex 지적별 처리:
1 페이지 계약: 숫자 page·reportTotal/reportPage/reportPages·5개 단위 그대로. 커서 도입 안 함(임의 페이지·되돌아가기 그대로 동작). offset 없음.
2 캐시: 서버 캐시는 기존 키(학생·audience·section)에 '색인'만 저장. 페이지 본문은 요청마다 새로 읽고 캐시하지 않음 → 페이지/과목별 키 불필요. force 새로고침·무효화 정책 그대로. 색인은 enumerable=false라 응답에 실리지 않음(테스트로 확인).
3 권한 필터: 이전과 같은 visible(과목 권한, 빈 과목=영어)을 색인 전체에 먼저 적용한 뒤 총건수·페이지 계산.
4 정렬·옛 자료: Firestore orderBy를 쓰지 않음 → 정렬 필드 없는 문서가 빠지지 않음. 이전과 같은 JS 정렬(Date.parse 내림차순, 같은 반환 순서). archived/removed 조건 추가 없음.
5 건수·과목: reportTotal·subjectOptions는 권한 적용된 전체 색인 기준(현재 페이지 길이 아님). 일정 3개 단위·노출 규칙 미변경.
6 과제 완료: 위와 같음.
7 성적: 차트·통계용 전체 자료 그대로(변경 없음).
8 인덱스: 새 인덱스 없음(동등 조건 1개 + projection). 읽기량: 색인 N건 + 본문 ≤5 + 완료 ≤5(이전: 본문 N + 완료 M). 색인은 여전히 N에 비례하고, 캐시가 살아 있어도 페이지 본문 5건은 다시 읽음.
  범위는 '수업 본문·완료 조회 경량화'이며 전체 리포트 비용 최적화가 아님. Enterprise 청구 감소는 확인되지 않은 예상(실제 Query Explain·사용량으로만 확인 가능).
테스트: teacherReportReview — select 필드, 본문 5건만 읽음, 색인 미노출, 2쪽 순서, 완료는 페이지 5건만·수정된 과제 미완료·학부모 시점 0건.
검증: tsc 0 · 테스트 744/744 · build 0 · 서버 import 검사 0.

## 3a단계 — 앱 전용에서 남아 있던 Notion 호출·설정 의존 (커밋 241f2ac)
- teacherStudentProfile.discardStudentProfile: 무조건 Notion 페이지 조회 → 전환 후 앱 기록(coreStudentPage) 사용.
- teacherStudentProfile·teacherStudentEnrollment access: NOTION_STUDENT_DATABASE_ID 일치 요구 → 전환 후에는 불필요(teacherMessages와 같은 방식).
- teacherWorkspaceAuth: 전환 안 된 학원은 Notion 담당 조회 대신 CORE_NOT_READY. 담당 범위는 항상 앱(readCoreScopes).
- 테스트: appOnlyNoNotion(Notion 차단·설정 제거)에 정보 수정 취소·수강 조회 추가, 로그인 테스트 픽스처를 실제 앱 전용 상태로(UUID 담당, 전환 문서), 읽기 수 갱신.

## 3b단계 — 옛 선생님방의 Notion 부분과 전용 서버 주소 (이 커밋)
- 학부모 리포트 고정 주소(report-slug) 설정을 학생 관리 상세 머리글로 옮김: ParentLinkControl(관리자, /api/teacher/report-slug 그대로 사용, 만들기·바꾸기·복사).
- 옛 선생님방(TeacherRoom 레거시)에서 제거: Notion 학생 목록 패널, Notion 학생 연결 선택, 학부모 주소 모달, AcademicImport.
  남긴 것(노션과 무관): 학생 앱 이름·선생님 메모·역할 변경·학생 기록 삭제, 단어장/문법/시험 탭, 리포트 탭. 완전 제거 여부는 사용자 확인 후.
- 삭제한 서버 주소: /api/teacher/notion-students, /api/teacher/import-academic(+server.ts 개발 경로), AcademicImport.tsx, studentDirectoryRoster 테스트(notion-students 전용).
검증: tsc 0 · 테스트 745/745 · build 0 · 서버 import 검사 0.

## 3c단계 — workspace.ts의 Notion 분기 (커밋 faa2be5 · 8355464 · c0ff2f0)
원칙: 앱 전용 경로는 그대로 두고, Notion으로 가던 대체 경로는 명시적 오류로 바꿈(앱 전용 학원에서는 도달하지 않음).
- 읽기(1/3): 학생 목록은 앱 명부만(전환 안 됐으면 CORE_NOT_READY), schedule-options는 readAppSchedulePlaces, teacher-assignment는 readCoreScopes,
  academy-lessons는 readAppSourceLessons만, schedule-records의 Notion 원본·반영 확인 제거, 충돌 검토 GET은 항상 *_APP_ACTIVE. confirmLessonRecords는 빈 함수.
- bootstrap(2/3): 반·커리큘럼은 managed만, 수강은 readCoreEnrollmentSummaries, Notion 일정 원본 없음, 일지·일정 '반영 확인' 루프 제거.
- 쓰기(3/3): sync-student-registration은 앱 등록만(아니면 CORE_NOT_READY) · grant의 saveCoreGrant 뒤 Notion 담당 동기화 제거 ·
  import-source-record는 앱 기록만(LESSON_APP_REQUIRED / CORE_NOT_READY) · save/archive class·curriculum·schedule, publish-schedule은 앱 경로가 아니면 CORE_NOT_READY ·
  save-draft·publish·archive-lesson은 LESSON_APP_REQUIRED · resolve-*-conflict는 항상 *_APP_ACTIVE · previous-lesson은 앱 원본(previousAppSourceLesson)만.
- 테스트: Notion 모드 경로를 직접 돌리던 테스트 삭제(Notion fetch 흉내·옛 save-draft·Notion 담당 동기화).
- 참고: c0ff2f0 이전 일부 커밋은 줄바꿈(CRLF/LF)이 바뀌어 diff가 파일 전체로 보입니다. 내용 비교는 `git diff --ignore-cr-at-eol`로 해 주세요. c0ff2f0부터는 원래 줄바꿈을 유지합니다.

## 3d단계 — 호출자가 없어진 Notion 모듈 삭제 (커밋 a2c7252 · 16f372c · 70c83cb · 7607ee1)
- (1) workspace.ts의 쓰지 않는 import 정리 후 앱 코드에서 아무도 부르지 않게 된 모듈 삭제: lessonWebhookProjection, studentDirectoryError, teacherAssignmentRetry,
  teacherAuditDetails, teacherClassStatus, teacherLessonArchive, teacherLessonConflict, teacherLessonImport, teacherNotionPublish, teacherRecordArchive,
  teacherRecordAudit, teacherRecordConflict, teacherStudentRegistrationSync, teacherStudentSnapshot.
- (2) academyBackfill, lessonExamScope, teacherTestProperties(Notion 속성 생성), teacherSchedulePlaces(Notion 장소 목록; 앱은 readAppSchedulePlaces).
- (3) 일회성 이전 도구: lessonMigration·academicMigration 삭제. lessonAuthority/academicAuthority는 lessonAppActive/academicAppActive만 남김(검증 기록 대조 그대로).
  managedAcademy에서 managedPlan·importManagedStep·activateManaged와 Notion 파싱 제거(readManaged/saveManaged/archiveManaged 그대로). LESSON_MIGRATION_BUDGET_MS 환경변수 목록에서 제거.
  이전을 돌려 앱 모드를 만들던 테스트는 이전 완료 상태를 직접 넣는 픽스처로 교체: tests/helpers/lessonAppFixture.ts(lessonSourceRecords + 전환 문서 + 검증 기록),
  managedAcademy.test의 반·커리큘럼 시드(옛 setup이 만들던 문서와 같은 모양).
- (4) mergeNotionRows를 api/_lib/mergeSourceRows.ts로 그대로 옮김(앱 행과 managed 원본 병합에 계속 사용). teacherAcademicArchive는 cancelAcademicArchive만 남김.
  서로만 import하던 묶음 삭제: teacherNotionWorkspace, teacherAcademicNotion, teacherNotionMirror, teacherNotionWrite, notionFailure, notionReadFilter,
  sharedNotionPolicy, teacherAssignmentSync, lessonSpecialNote.
- 테스트 정리: 위 모듈 전용 테스트 삭제, 섞인 파일은 해당 테스트만 제거. 성적 삭제 취소 테스트는 앱 기록 기준으로 다시 작성.
- 유지(식별 연결): notionStudentMappings, notionPageId, lessonSourceRecords, lessonAppAuthority/lessonVerificationRuns, academicAppAuthority/academicVerificationRuns 등 컬렉션·필드.
검증(7607ee1): tsc 0 · 테스트 582/582 · build 0 · 서버 import 검사 0.

## Codex 3c·3d 검증 반영 (커밋 bc2263e · 9f80877)
- [P1] 이전 일지 삭제가 휴지통 비움 뒤에도 유지: 삭제 트랜잭션에서 연결된 lessonSourceRecords에 appDeleted {draftId, at} 표시(원본 ID·앱 기록 ID로만 찾음, 학생+날짜 아님).
  7일 안 복원은 표시를 지움. 휴지통 비움은 표시를 유지하고, 표시 없이 삭제됐던 옛 일지에는 이때 표시를 붙임. 목록·직전 수업·회차·다시 가져오기에서 표시된 원본 제외.
  원본 본문은 이력으로 남김(화면에는 안 보임).
- [P2] 수정·공개한 앱 일지가 목록과 직전 수업에서 옛 원본 값으로 보이던 문제: mergeNotionRows는 앱 소유 행(sourceMode firestore)의 값을 유지.
  previousAppSourceLesson은 원본과 연결된 앱 일지가 공개 상태면 그 값을 사용, 삭제 상태면 원본 숨김, 미공개 초안이면 원본 값 유지(다른 사람 비공개 수정 노출 안 함). 작성자 변경 없음.
- 회귀 테스트 tests/appLessonRetention.test.ts(바라는 동작으로 assert, 수정 전 코드에서 3개 모두 실패 확인): 같은 날 두 수업 중 하나만 삭제·복원·휴지통 비움 뒤 재등장/재생성 없음,
  옛 삭제분 표시, 공개 수정이 교사·관리자 목록과 관리자 직전 수업에 반영, 이후 미공개 수정은 관리자에게 안 보임.
- [3] 함께 지워졌던 순수 앱 검사 복구(Notion 변환 assertion만 제외): 점수 0·선택 시험 독립·이어쓰기 초기화(reconstruction), 입력 순서·분모 변경(teacherPerformance45),
  이전 평가 복사·직접 수정 보호(previousLessonAssessment).
- [리포트 06da600] lessonReportPage가 새로 읽은 본문을 색인 당시의 학생·허용 과목·선택 과목으로 다시 확인하고 맞지 않으면 건너뜀(비열거 lessonScope). 경합 테스트 추가(수정 전 실패 확인).
  비용 표현은 위 리포트 섹션 8번에서 고침.
- 운영 자료 영향(확인 필요, 미조회): 이 수정 전에 삭제되고 7일이 지나 휴지통에서 지워진 이전 일지는 원본에 표시가 없어 목록에 다시 보였을 수 있음.
  초안·archive 이력은 이미 지워졌으므로 자동 복구는 불가. 단서: lessonAppHistory/{원본ID}:1:import는 남아 있는데 teacherLessonDrafts/{원본ID}가 없는 원본. 사용자 승인 후 읽기 전용으로만 대조.
검증: tsc 0 · 테스트 589/589 · build 0 · 서버 import 검사 0.
- [재검증 P2] 공개 뒤 다시 임시 저장한 일지: 관리자 직전 수업이 최초 이전 값으로 돌아가던 문제. takenOver가 미공개 초안이면 마지막 공개본
  (lessonAppHistory/{id}:{appPublishedRevision}:publish 또는 공개 복원의 :restore, afterDraft의 revision·stage·학생·과목 확인)의 값을 사용. 초안 값은 계속 비공개.
  추가 읽기: 공개 뒤 다시 고친 일지 1건당 이력 문서 1~2건. 테스트를 equal('16:00')·회차 1.5로 강화(수정 전 실패 확인).

## 3d단계 계속 — 서버의 Notion 호출 완전 제거 (커밋 e844f7e · f673c56 · 7e2e5db · 4259935)
결과: 서버 코드에서 Notion API를 부르는 곳이 없음. NOTION_INTEGRATION_TOKEN 환경변수 목록에서 제거(서버가 더 이상 참조하지 않음).
- (5) 문자 템플릿: messageTemplateStore는 목록·저장·이력·복원·저장본 읽기만. Notion 가져오기·캐치업·대조·전송 작업·재시도·충돌 해결 삭제.
  스위치 없이 저장하면 TEMPLATE_APP_REQUIRED(Notion 복사 대기열 안 만듦). 액션은 template-list/save/history/restore만, 나머지는 INVALID_INPUT.
  messageTemplateAuthority는 templateAppActive만. 저장 키는 원래 Notion DB ID를 포함한 그대로라 기존 문서가 그대로 찾아짐.
  보호자 문자(teacherMessages): 학생은 앱 명부만(core 전 CORE_NOT_READY, NOTION_STUDENT_DATABASE_ID 확인 없음), 템플릿은 앱 저장본만, 보낸 본문의 Notion 백업 PATCH 삭제.
- (6) academyDirectorySource: 키·상수·앱 학생 목록·요약 덮어쓰기만. 명부 가져오기(dryRun/import/reconcile/approve/exclude/worker/directoryAction) 삭제.
  앱 명부 읽기는 core 스위치 필요. academyCore.cutoverCore 삭제. ACADEMY_DIRECTORY_READ_MODE·ACADEMY_DIRECTORY_SYNC_ENABLED·MESSAGE_TEMPLATE_WORKER_SECRET 제거.
  academyCore 테스트는 가져오기·전환이 남긴 상태(명부 행·동기화 상태·이력·담당·수강 투영·core 스위치)를 직접 넣음(옛 코드로 만든 문서 모양을 덤프해 대조).
- (7) scheduleProjection은 scheduleSourceKey·generateScheduleDocId만(앱 일정이 같은 리포트 ID로 공개). Make 일정 반영과 웹훅 스키마 삭제.
  호출자 없는 작은 함수 삭제: migrationTransport 전체, notionRequest, listNotionStudents·lookupStudentAndGuardianContact, captureNotionUsage, 입학 Notion 스키마 확인,
  writeDirectLessonReport, 일지 Notion 필드 진단, 등록 페이지·스키마 조회, publishDecision.
- (8) 학생 정보(teacherStudentProfile)·수강(teacherStudentEnrollment)·등록 담당 선택(teacherRegistrationAssignments)·학교(studentSchool)·학생 식별(lookupStudentIdentity): 앱 경로만.
  전환 전이면 CORE_NOT_READY. Notion 매개변수 제거. academic.syncAcademicPage(Make 성적·수강 반영) 삭제. notion.ts와 등록용 Notion HTTP 클라이언트 삭제.
  등록 담당 선택은 권한 확인(403)이 core 확인보다 먼저.
- 테스트: 문서 행을 넣는 방식으로 바꾼 파일 — messageTemplateStore(새로 작성), teacherMessages(앱 모드 픽스처, 경합 테스트는 템플릿 읽기 중에 발생시킴), academyCore.
  삭제한 파일 — messageTemplateAuthority, teacherStudentProfile, teacherStudentEnrollment, teacherRegistrationAssignments, teacherAcademicOwnership,
  notionStudentRename, notionStudentStatus(모두 Notion 경로 전용). 순수 규칙은 studentRecordValidation으로 이동(연락처 변경 중 발급 차단, 수강 입력 검증, 반 선택 검증).
  삭제 파일 중 workspace 경로 수준 검증(학생 정보·수강 액션의 권한·위조 필드 거부)은 Notion 픽스처 기반이라 함께 빠짐 — academyCore의 '실제 workspace actor' 테스트가 앱 경로 권한을 일부 대신함.
검증(4259935): tsc 0 · 테스트 492/492 · build 0 · 서버 import 검사 0.

## 재검증 반영 (커밋 77dfaab)
- 공개 뒤 다시 임시 저장한 일지: 관리자 직전 수업이 최초 이전 값으로 돌아가던 문제 → 마지막 공개본 값 사용(위 'Codex 3c·3d 검증 반영'의 [재검증 P2]).

## 테스트 복구 (커밋 670d08c) — Codex 서버 최종 검증 권고
- academyCore.test에 학생 정보·수강 workspace 경계 테스트를 앱 명부 픽스처로 복구: 일반 선생님 조회·저장 403, 위조 academyId·internalStudentId 400,
  거부 전후 문서 불변·외부 요청 0건, 관리자 정상 읽기·저장(Notion 환경변수 없이), 학생 연결 internalStudentId 유지.

## 3e단계 — 화면·문구·사용량 기록 (커밋 0b7121d)
- 공개 화면(ParentReportView·LearningReport)은 손대지 않음.
- LessonConflictReview(앱·노션 비교 버튼, NOTION_EDIT_CONFLICT 때만 표시; 서버에서 이미 닫힘)를 일지·수업 기록 검토·성적·일정 화면에서 제거.
- 문자 템플릿 편집기: 앱 전용(저장 버튼만). Notion 동기화 상태·재시도·원격 충돌 표시와 관련 CSS 제거. 렌더 테스트 갱신.
- 쓰지 않는 클라이언트 모듈 삭제: lessonMigrationDriver, teacherAssignmentStatus. 빈 notionSources/notionIssues 기본값 제거.
- 오류 문구: 앱 경로가 아직 내는 코드에 Notion 없는 설명(CORE_NOT_READY, LESSON_APP_REQUIRED[저장·공개·삭제·복원 공통으로 고침], TEMPLATE_APP_REQUIRED[새로 등록],
  *_APP_ACTIVE, INVALID_TEACHER[새로 등록]). 이름에 NOTION이 들어간 코드(NOTION_EDIT_CONFLICT 등 5개)는 화면·테스트 호환을 위해 코드는 유지하고 문구만 앱 기준으로.
  tests/appOnlyMessages.test.ts가 이 코드들의 문구에 Notion/노션이 없음을 확인.
- notionUsage(Notion 호출·Make 수신 집계) 삭제: 5개 경로 래퍼 제거, NOTION_STUDENT_DATABASE_ID 환경변수 제거. 기존 notionUsage 문서는 그대로 둠.
- 브라우저 화면 확인은 하지 않음(바뀐 화면: 충돌 버튼 제거—평소 표시 안 됨, 템플릿 편집기—렌더 테스트로 확인).
검증(0b7121d): tsc 0 · 테스트 495/495 · build 0 · 서버 import 검사 0.

## 남은 일
- 데이터에 남은 옛 단계 값(notion_saved, report_published_notion_pending 등) 표시용 라벨·타입은 기존 기록 표시를 위해 유지.
- 테스트 안의 NOTION_* 환경변수 설정·notion 이름 변수(무해) 정리는 선택.
- 5단계: 옛 선생님방의 노션 무관 기능(앱 이름·메모·역할·기록 삭제) 이전 여부 — 사용자 결정.
- 운영 자료 확인(사용자 승인 필요): 수정 전 휴지통에서 지워진 이전 일지가 다시 보이는지 읽기 전용 대조.

## Codex에 요청하는 검증 (복구 테스트 · 3e)
1. 복구한 workspace 경계 테스트가 권고 범위(조회·저장 거부, 위조 필드, 불변·네트워크 0, 관리자 정상 경로)를 덮는지.
2. 충돌 버튼 제거 후 남은 화면 흐름(일지 재시도·성적 반영 재시도·일정 저장)에 빠진 조건이나 깨진 JSX가 없는지.
3. 템플릿 편집기가 앱 저장·더티 표시·보관 템플릿 잠금을 그대로 하는지.
4. 오류 문구 덮어쓰기 순서: appOnlyMessages가 뒤의 messages 대입에 다시 덮이지 않는지(특히 NOTION_EDIT_CONFLICT·NOTION_SOURCE_MISMATCH).
5. notionUsage 제거로 응답·쿠키·상태 코드가 바뀐 경로가 없는지(parent/student/report-slug/student-link/workspace·cron).
결과는 파일·줄 번호와 재현 방법으로 보고해 주세요. 수정은 Claude가 ENG-repo에 반영합니다.

## 이전 검증 요청 (3d 5–8, 완료)
1. 서버에서 api.notion.com 호출이 정말 0인지: 문자열·동적 import·fetch 래퍼 포함. 남은 NOTION_* 참조(notionUsage의 NOTION_STUDENT_DATABASE_ID 라벨용) 외 없는지.
2. 앱 전용 학원에서 문자(읽기·준비·발송), 템플릿(목록·저장·이력·복원), 학생 정보·수강 읽기/저장, 등록 담당 선택, 학교 표시, 학생 식별(학부모 주소·계정 연결)이 그대로 되는지.
3. 템플릿·명부 저장 키가 기존 문서와 같은지(원래 Notion DB ID 포함 해시) — 운영 문서를 새 키로 다시 만들지 않는지.
4. 지운 테스트 중 앱 경로를 검증하던 것이 있는지(위 삭제 파일 목록). 특히 workspace 수준 학생 정보·수강 권한 검사를 앱 모드로 되살려야 하는지 의견.
5. CORE_NOT_READY로 바뀐 경로가 운영(6개 스위치 모두 켜짐)에서 막히지 않는지.
결과는 파일·줄 번호와 재현 방법으로 보고해 주세요. 수정은 Claude가 ENG-repo에 반영합니다.

## 이전 검증 요청 (3c·3d 1–4, 완료)
1. 3c 오류 대체가 앱 전용 학원의 정상 경로를 막지 않는지: 각 action에서 앱 분기 조건(coreActive·classesActive·appSchedulesActive·lessonAppActive)이 운영 상태에서 참인지,
   그리고 앱 분기 앞에서 새 throw가 먼저 걸리는 순서 문제가 없는지(workspace.ts POST 순서).
2. 삭제한 모듈을 동적 import(`await import('...')`)로 부르는 곳이 남았는지 — 빌드·tsc는 통과하지만 문자열 경로 실수 여부.
3. 픽스처 교체가 테스트 의미를 바꾸지 않았는지: lessonAppFixture의 lessonSourceRecords 모양이 실제 운영 문서와 같은지(appLessonSource가 읽는 필드).
4. 지운 테스트 중 앱 전용 동작을 검증하던 것이 섞여 있었는지(목록: 커밋 diff의 tests/).
5. 위 '남은 일' 순서·범위에 대한 의견.
결과는 파일·줄 번호와 재현 방법으로 보고해 주세요. 수정은 Claude가 ENG-repo에 반영합니다.
