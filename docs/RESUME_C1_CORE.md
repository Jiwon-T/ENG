# 재개 기록 — C-1 기존 학생·수강·담당 권한

2026-10-08. B 누적 ZIP 이후 작업이며 목표는 사용자 지시에 따라 Notion 독립 운영으로 변경됐습니다.

- 구현 파일: academyDirectorySource(대조/이전), academyCore(읽기/쓰기/권한/전환/선택 복원), notionAcademicSources(초기화 순환 없는 기존 ID 상수).
- 연결 파일: workspace/auth/profile/enrollment/assignment options/source enrollments/student identity/academic projection/notion-report/contact consumer.
- UI: 관리자 설정의 AcademyDirectoryManager. 기존 폼 내부 레이아웃은 변경하지 않습니다.
- 설정: 기존 예제 환경변수/deny rules/인덱스 확장. 실제 설정과 데이터는 변경하지 않았습니다.
- 테스트: academyCore, 이전 관리 UI, 기존 동시 읽기 기대값에 전환 checkpoint 1개 반영. 기존 권한/PIN/계정 검증 유지.

현재는 **C-1 첫 코드 묶음**입니다. 반 연결이 있는 현재 운영은 반·시간표의 앱 전용 전환이 완료되기 전에는 활성화하지 않습니다. 다음은 반·정규 시간표·교재의 읽기/쓰기와 연결 이전, 앱 전용 신규 등록입니다. 현재 반 authority marker를 수동으로 만들어 조건을 우회하지 않습니다.

운영 배포/이전/Notion 차단/Make 중단/문자 발송은 하지 않았습니다. Docker·Cloud Run·실제 Firestore·실제 화면·청구량은 미확인입니다. 모의 차단 환경에서 기존 학생 수정·수강·담당 권한과 PIN/URL 보존을 검증했습니다.

자세한 범위·상한·전환과 복구 방법은 `C1_FIRESTORE_CORE.md`를 읽습니다. 전환 뒤 오래된 Notion 경로로 단순 복귀하지 않습니다. 학생 선택 복원 API는 새 revision/PIN 갱신과 현재 권한 검사를 사용합니다.

빌드의 기존 CSS @import와 bundle 크기 경고는 유지합니다. 최종 검증 결과와 로컬 커밋은 전달 메시지에서 확인합니다. 이전 B 문서는 당시 파일럿 기록이며 현재 설계 방향은 본 기록이 우선입니다.

검증 기록: lint/build/일반 Node ESM import 통과. 최종 전체 테스트 607개 통과. 오래된 계정 snapshot, 활성 학생 누락, 기존 필드 검증을 포함합니다. 서버 기반 로컬 커밋은 `5c78439`입니다. 다음 묶음에서는 반/정규 시간표/신규 등록과 남은 Notion 소비 경로를 확인하고, 현재 source 전환 조건을 우회하지 않습니다.
