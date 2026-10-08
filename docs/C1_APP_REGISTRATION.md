# C-1 앱 전용 신규 학생 등록 — 2026-10-08

## 구현
기존 상담/등록 저장 API와 sync-student-registration 입력은 유지합니다. core authority가 활성화된 main 학원에서만 앱 확정 경로를 사용하며, 전환 전에는 기존 Notion 경로를 유지합니다. 실제 authority나 운영 환경은 변경하지 않았습니다.

- 신규 appStudentRegistration 처리기는 저장한 등록 revision을 소비합니다. 학생·디렉터리·내부 ID·수강 투영·담당 scope·반 구성·등록 완료·변경 이력을 같은 Firestore 트랜잭션으로 기록합니다.
- 신규 학생/수강은 서버 UUID, 내부 ID는 app 학원 namespace로 생성합니다. entityId/studentKey와 origin=app, sourceMode=firestore를 명시하며 notionPageId/notionStudentPageId는 null입니다. 실제 Notion 페이지 ID를 만들어낸 것처럼 저장하지 않습니다.
- 기존 논리 디렉터리 키/컬렉션을 재사용해 새 학생도 목록/프로필/수강/연락처 조회를 사용할 수 있게 연결했습니다. Notion 형태의 properties는 기존 필드 어댑터를 재사용하기 위한 로컬 표현이며 원본이 Notion이라는 의미는 아닙니다.
- 동일 등록의 동시/반복 확정은 저장된 동일 학생 ID를 반환합니다. 다른 학생 ID나 계정을 자동 병합하지 않습니다. 저장 실패 시 일부 연결만 남지 않습니다.
- 학원·admin/principal·현재 등록 revision·현재 선생님 역할/재직/담당 과목·반 학원/과목/담당/상태를 다시 확인합니다. 반·수강 authority가 준비되지 않으면 저장하지 않습니다.
- 입력 저장은 아직 확정하지 않은 상담/등록 요청이고, ‘앱 등록 확정’에서 학생 명부 연결이 완료됩니다. 기존 신규 학생을 Firebase 계정에 자동 연결하거나 계정을 새로 만들지 않습니다.
- 앱 프로필/수강 읽기와 프로필 편집은 실제 Notion ID가 없는 앱 원본도 처리합니다. 기존 학생의 계정·내부 ID·report URL·PIN/authVersion/잠금 상태는 유지합니다.
- 앱 초안은 원본 모드를 보존하고, authority가 내려갔다고 Notion 생성 경로로 되돌아가지 않습니다. 앱 원본의 연락처 조회도 Notion fallback을 하지 않습니다.
- 진행 중/불확실/부분 생성된 기존 Notion 등록은 cutover를 차단합니다. legacy 등록 lease 확정도 core authority를 읽어 전환과 충돌하지 않게 합니다. 불확실한 기존 등록을 앱 신규 학생으로 중복 생성하지 않습니다.

## 바뀐 파일
appStudentRegistration 신규 처리기/테스트, academyCore/academyDirectorySource/studentIdentity, registration 저장·기존 sync/담당 옵션/오류 안내, workspace dispatch, reportSchemas의 nullable 원본 필드, StudentRegistrationManager와 등록 타입·호출 prop. 기존 폼 필드/검증/입력 계약은 유지합니다.

## 안 바꾼 것
공개 리포트 화면, 수업 일지 입력 배치, 시간표·일정 UI, 기존 학생 계정/Firebase users, PIN/slug 생성 규칙, report-review 계약과 캐시는 변경하지 않았습니다. 학생 개인정보를 브라우저 저장소나 콘솔에 추가하지 않았습니다. 새 서버 요청 종류나 주기적 동기화를 추가하지 않았습니다.

## 검증
lint, 전체 테스트 640/640, build, Native Node workspace import 통과.
모의 검증: 동시 확정·동일 ID 재시도, commit 실패 0부분 저장, 중단 선생님/다른 학원 반/오래된 revision/권한 부족/미전환 거부, 목록·프로필·수강·연락처 조회, 신규 프로필 편집, 기존 URL/PIN 보호, 재원생 전환, 불확실/부분 생성 Notion 등록의 전환 차단, 늦은 legacy 작업의 Notion 요청 0, 안전한 오류 안내.
실제 Firestore RU/요금·운영 등록·학생 계정 연결 화면·브라우저 화면·배포·실제 데이터 이전은 미확인입니다. 기존 CSS @import와 큰 bundle 경고는 남습니다.

## 남은 범위/운영 주의
전체 Notion 독립 운영이나 운영 전환 완료가 아닙니다. 특히 새 앱 원본의 일정·일지·성적 공개/반영은 후속 소비 경로의 Notion 의존 제거와 함께 검증해야 합니다. 신규 앱 학생에게 기존 Notion 기반 공개 반영이 모두 동작한다고 가정하지 않습니다.
Firestore core 활성화 전 실제 자료/관계/권한 대조와 남은 리포트 반영 경로 점검이 필요합니다. 이번에는 운영 활성화·기존 자료 삭제/병합·Notion mutation·SMS 발송·Make 변경을 하지 않았습니다.
등록 원본과 디렉터리/반 변경 이력은 서버에 보존합니다. 이 이력만으로 별도 전체 백업이 완성되는 것은 아니며 실제 백업 설정/복구 훈련은 후속 운영 검증에 포함됩니다.
