# 재개 — 로컬 일회성 이전
새 도구 scripts/offline-migrate.ts. 구현 상세는 OFFLINE_MIGRATION.md.
checkPoint-10-a/ENG만 수정. ENG-repo/OneDrive GitHub 저장소는 환경설정 이름만 읽었으며 수정 없음.
실제 대상 프로젝트 gen-lang-client-0399631857, DB ai-studio-fa3e8961-76b4-4df9-8815-8e963dcfb5f4. 일지 날짜2026-09-20 포함 이후. 사용자가 실제 이전을 요청했으나 운영 환경설정 파일은 아직 없음. 현재 운영 dry-run/이전 모두 미실행. 필요한 설정 경로 또는 Vercel 프로젝트 이름을 요청해 둠.
정상 흐름: 읽기 전용 점검 → 보류/중복/누락 보고 → --apply --confirm 명시 대상 실행 → 추가 변경분/결과 검증. 자동 authority 전환, SMS, Make 중단 금지.
기존 앱 자료 보존 규칙은 자료별 기존 importer 재사용. 일지는 lessonSourceRecords staging에만 적재하므로 전체 공개 자료 이전 완료로 보고하지 말 것.
Vercel 확인: 위 프로젝트에 연결 성공했지만 production sensitive 변수 값은 API에서 반환하지 않음. 외부 저장소 변경/운영 데이터 읽기 또는 쓰기 없음. 비공개 설정 파일 경로 또는 도구만 전달 선호를 사용자에게 요청한 상태.

검증: lint, 전체 748개 테스트, build, plain Node 서버 import 통과. 실제 화면 확인은 수행하지 않았으며 운영 dry-run/이전도 설정 미확보로 미실행입니다.
변경 파일: api/_lib/migrationTransport.ts, offlineMigration.ts, messageTemplateStore.ts, academyDirectorySource.ts, managedAcademy.ts, academicMigration.ts, lessonMigration.ts; scripts/offline-migrate.ts; tests/offlineMigration.test.ts; docs/OFFLINE_MIGRATION.md, RESUME_OFFLINE_MIGRATION.md.
작업 시작 전 기존 미커밋 변경이 다수 있어 타인의 변경을 묶어 커밋하지 않았습니다. 현재 소스와 검증 결과를 누적 ZIP으로 전달합니다.

검토 반영(2026-10-09): ENG-repo의 Claude 검토 내용을 요청대로 수신. offlineMigration.ts/tests/offlineMigration.test.ts/docs/OFFLINE_MIGRATION_REVIEW.md는 바이트 동일 복사; lessonMigration.ts는 dryRunLessonPage 함수만 교체하고 앞부분 유지. ENG-repo에는 Git 메타데이터가 없어 전달된 218df65 커밋 해시는 현장에서 검증하지 못했지만 현재 파일 내용은 검토 문서와 일치함.
반영 후 lint, 전체 749개 테스트, build, Node import, CLI --help 통과. ENG-repo 수정/운영 이전/원격 push 없음. 기존 미커밋 변경 보존.
