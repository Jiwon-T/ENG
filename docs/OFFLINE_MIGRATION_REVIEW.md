# 로컬 이전 도구 검토 — 2026-10-09 (Claude)

대상: Codex의 `scripts/offline-migrate.ts`, `api/_lib/offlineMigration.ts`, `api/_lib/migrationTransport.ts`와 관련 변경. Codex 원본은 `30d9944`에 그대로 커밋했고, 검토 수정은 그다음 커밋에 따로 넣었습니다.

## 확인한 것 (문제 없음)
- **새 도구가 쓰는 함수**: 모두 ENG-repo에 있습니다. `d7828b5`에 이미 들어간 묶음 크기 조절(`migrationBatchSize`)과 성적 미리보기(`dryRunAcademicPage`) 외에 빠진 의존 파일은 없습니다.
- **중복 구현**: 화면용 반·교재 진행기와 겹치는 부분은 없습니다. 도구는 서버 이전 함수를 직접 부릅니다.
- **실행 안전장치**:
  - 기본은 읽기 전용이고, 실제 저장은 `--apply --confirm`에 프로젝트·DB를 직접 맞춰 적어야 실행됩니다.
  - Notion은 조회(GET, DB query)만 허용하고, 요청 사이를 350ms씩 띄워 한 줄로 보냅니다.
  - 앱 전용 전환은 실행하지 않습니다(`activation:false`).
  - 콘솔에는 오류 코드만 출력합니다(개인정보 없음).
  - 도구 잠금(`offlineMigrationRuns/main`)이 있습니다.
- **일지**:
  - 2026-09-20 이후 일지만 다룹니다(서버 필터와 행별 검사, 이번 커밋의 기준일 코드 재사용).
  - `lessonSourceRecords` 검증 저장본에만 적재하고, 실제 조회 전환과는 분리돼 있습니다.
  - 자동 전환을 이미 요청한 작업이 있으면 실행을 거부합니다.
- **환경변수**: 서버 코드(api/)에는 새 환경변수가 없습니다. CLI는 기존 이름만 사용합니다.

## 고친 것 (ENG-repo, Codex 작업 폴더에도 반영 필요)
1. **일지 실행 루프가 쉬지 않고 도는 경우** (`offlineMigration.ts`)
   - 다른 실행기가 작업을 잡고 있거나 다음 실행 시각이 미래이면 `runLessonMigration`이 idle로 답합니다. 그런데 이 답에는 busy·waiting 표시가 없을 수 있습니다.
   - 그러면 기다리지 않고 즉시 다시 요청해서, Firestore를 계속 읽고 씁니다.
   - 수정: idle 답도 기다리게 했습니다. `completed`·`none`이면 끝냅니다.
2. **잠금 갱신이 매 단계 트랜잭션 쓰기** (`offlineMigration.ts`)
   - 수천 단계면 쓰기도 같은 수만큼 늘어납니다.
   - 수정: 잠금 시간은 5분 그대로 두고, 갱신은 1분에 한 번만 합니다(시작할 때는 반드시 갱신).
3. **일지 미리 점검이 이미 내린 결정을 무시** (`lessonMigration.ts`의 `dryRunLessonPage`)
   - "Notion에만 보관" 같은 결정을 반영하지 않아서, 501건 같은 이미 결정한 항목을 다시 '확인 필요'로 셌습니다.
   - 수정: 행마다 저장된 결정을 읽기 전용으로 읽어, 실제 실행과 같은 기준으로 셉니다. 쓰기는 여전히 0입니다.
4. **테스트가 기준일을 바꾸고 되돌리지 않음** (`tests/offlineMigration.test.ts`)
   - 수정: 바꾼 기준일을 되돌리고, 위 3번을 검증하는 테스트를 추가했습니다.

## 운영 실행 전 남은 일
- 운영 설정 파일이 아직 없습니다(Vercel의 민감한 값은 API로 받을 수 없음).
  - 사용자가 비공개 위치에 `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIRESTORE_DATABASE_ID`, `NOTION_INTEGRATION_TOKEN`, `ADMIN_UID`(그리고 학생 이전 시 `NOTION_STUDENT_DATABASE_ID`)를 직접 준비해야 합니다.
  - Git·ZIP·채팅에 넣지 않습니다.
- 순서: 읽기 전용 점검 → 보류 결과 보고 → 사용자 승인 → `--apply --confirm`.
- 관리자 화면이나 예약 실행으로 진행 중인 이전(현재 반·교재 진행 중)과 동시에 돌리지 않습니다.

## 협업 규칙 (동기화)
- `sync-eng-repo.py`는 작업 폴더를 ENG-repo에 그대로 복사합니다. 이제 다음 경우에는 멈춥니다.
  - ENG-repo에 커밋 안 된 변경이 있을 때
  - ENG-repo에 작업 폴더보다 새로운 검토 커밋이 있을 때. 이번 수정 3개 파일이 여기에 해당합니다.
- Codex는 위 수정 내용을 작업 폴더에 반영한 뒤 계속 작업해 주세요. 그 뒤 동기화하면 그대로 이어집니다.

## 검증 (ENG-repo에서 실행)
- lint 통과, 테스트 749/749, build 통과, Node 서버 import 통과, `offline-migrate.ts --help` 정상 실행.
- 운영 미리 점검과 실제 이전은 실행하지 않았습니다(설정 없음, 승인 필요).
