# 체크포인트 10 A hotfix 2 — 선생님방 서버 인증 호환

2026-10-06. 기준: A hotfix 1. 이전 디자인, A 검증 및 상담/일지/일정 hotfix를 모두 포함합니다. B는 보류 상태입니다.

## 운영 증거와 원인 범위

사용자가 전달한 오류 ID af0918b9-33a5-4c2b-b652-f2a1a22c6dc7를 Vercel 운영 로그에서 읽었습니다. 해당 요청은 /api/teacher/workspace GET, HTTP 500, SERVER_CONFIG_ERROR, failureStage authentication입니다. 배포는 READY이며 운영 프로젝트 jiwont에 연결돼 있습니다. 필수 Firebase 환경변수 네 가지와 ADMIN_UID는 production 대상에 등록돼 있습니다. 비밀값은 복호화/출력하지 않았으므로 값의 유효성까지 검증한 것은 아닙니다.

A에서 추가한 verifyIdToken(token,true)는 서명 확인 뒤 Admin Auth getUser 조회도 수행합니다. 기존 Firestore 권한만 있는 서비스 계정은 firebaseauth.users.get 권한이 부족해 이 지점에서 실패할 수 있습니다. 운영 로그가 원래 Firebase 세부 오류 코드를 버려 정확한 IAM 부족 여부를 확정할 수는 없습니다. 동일 권한 부족 상황은 모의 테스트로 재현했습니다. 이 수정은 그 호환 문제를 해결하고, 원인 구분에 필요한 안전한 진단 코드를 보강합니다. 환경변수 누락/잘못된 비밀키 등의 다른 설정 실패를 성공으로 처리하지 않습니다.

## 수정

- Firebase 세션 검증을 공통 helper로 통합했습니다. 정상 환경에서는 기존 checkRevoked=true 검증을 그대로 사용합니다.
- auth/insufficient-permission 또는 권한 부족이 명확한 auth/internal-error일 때만 별도 경로를 사용합니다. 먼저 Admin SDK의 서명·만료·issuer·audience 검증을 다시 수행하고, 같은 사용자 ID 토큰으로 공식 accounts:lookup에서 본인 계정만 조회합니다.
- 반환 계정 ID, disabled, validSince와 토큰 auth_time을 비교합니다. 삭제/정지/취소 계정은 계속 차단합니다. 조회 실패/시간 초과/설정 오류/다른 프로젝트/다른 계정은 접근을 허용하지 않습니다. 토큰 자체의 오류나 무관한 내부 오류는 이 경로로 우회하지 않습니다.
- 기존 앱의 Firebase 공개 구성 파일을 사용하며 새로운 서비스 계정 권한이나 환경변수를 기본 사용에 요구하지 않습니다. 공개 API 구성은 기존 파일을 유지합니다. 계정 조회는 idToken만 전송하고 임의 사용자 조회나 계정 변경을 수행하지 않습니다.
- 선생님방, 관리자, 성적 동기화, 로그인 학생의 일지·일정·과제 완료 경로에 동일 검증을 적용합니다. 원장/선생님 학원 소속·작업 계정 비활성 검증, 리포트/PIN 구조는 유지합니다.
- 선생님방 인증 실패는 안전한 오류 코드만 로그에 남깁니다. 토큰·비밀키·개인 계정 응답·원시 오류 본문을 로그에 남기지 않습니다.
- JSON 구성 import에는 Node ESM의 명시적 type=json 속성을 사용합니다. 서버 import 검사도 같은 구성 파일을 임시 검사 폴더에 포함합니다. 실행 모듈의 .js 확장자 규칙은 유지하고, JSON import는 해당 속성과 유효한 JSON 파일을 별도로 검사합니다.

## 검증

전체 테스트 456개 통과. 타입 검사, native Node 서버 import, 프로덕션 빌드 통과. 기존 번들 크기/Firebase mixed import 경고는 남아 있습니다.

추가 6개 테스트: Admin 권한 부족 복구와 서명 재검증, 선생님방 실제 actor 경로 및 비활성 작업 계정 차단, 취소/정지/삭제/다른 계정 차단, 무관한 오류와 잘못된 서명 우회 방지, API 요청 형태·프로젝트 확인·설정 실패 차단, 정상 Admin 검증 시 REST 미호출.

운영에서 수행한 것은 로그/설정 메타데이터 읽기와, 실제 로그인 토큰 대신 invalid-test-token으로 계정 조회 API에 읽기 전용 요청 1회입니다. 응답은 HTTP 400 INVALID_ID_TOKEN으로, 공개 구성으로 해당 API에 연결되고 테스트 토큰이 거부됨을 확인했습니다. 실제 사용자 토큰의 로그인·계정 상태·화면 로딩 복구는 이 테스트로 증명되지 않습니다.

## 사용자 재배포 후 확인

1. 누적 ZIP의 전체 코드를 적용하고 기존 운영 환경변수를 유지한 채 재배포합니다. secret 환경파일은 ZIP에 포함하지 않았습니다.
2. 로그인 상태로 선생님방을 다시 열어 조회가 정상인지 확인합니다. SESSION_REVOKED/로그인 만료이면 로그아웃 후 다시 로그인합니다.
3. 일지 조회, 상담·신입생, 일정 화면과 기존 학생 리포트를 확인합니다.
4. 같은 설정 오류가 남으면 새 오류 ID를 알려 주세요. 이번 버전 로그의 TEACHER_AUTH_CHECK_FAILED 코드로 Firebase 계정 검사 실패와 환경변수/초기화 오류를 구분할 수 있습니다.

직접 배포/IAM 변경/운영 데이터 쓰기/실제 문자 발송/Make 변경은 수행하지 않았습니다.

공식 규약: https://docs.cloud.google.com/identity-platform/docs/use-rest-api (Get user data), https://firebase.google.com/docs/auth/admin/manage-sessions
