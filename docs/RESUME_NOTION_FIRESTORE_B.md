# 재개 기록 — Notion/Firestore B 파일럿

2026-10-08. A 조사 후 첫 자료 종류인 문자 템플릿의 코드 구현 구간입니다. C는 아직 시작하지 않습니다.

## 현재 위치

- 누적 기준: Hotfix 18의 작성자 단방향 관계형 속성 수정까지 포함합니다.
- 서버 기반 로컬 커밋: `324547d` (영구 템플릿·불변 작업·복구·설정·테스트). 이 저장소의 일부 기존 파일은 미추적 상태여서 이번 커밋에 create로 보입니다. 기존 전체 앱은 누적 ZIP에 보존합니다.
- 별도 운영 이전/배포/예약 작업/실제 문자 발송/Make 중단은 실행하지 않았습니다.
- 기존 Notion 조회가 기본입니다. 새 Firestore 조회와 작업 서버는 명시적 전환/enable 전에 활성화하지 않습니다.
- 전체 절차·원본 범위·환경 설정·복귀 방법은 `NOTION_FIRESTORE_TEMPLATE_PILOT_B.md`를 읽습니다.

## 변경 파일

- 서버: messageTemplateStore / messageTemplateActions / messageTemplateWorker / messageTemplateWorkerFirestore.
- 기존 연결: api/teacher/workspace.ts, teacherMessages.ts, teacherWorkspaceError.ts.
- UI: MessageTemplateManager.tsx, WorkspaceSyncPanel.tsx, 해당 패널 한정 CSS.
- 설정: .env.example, firestore.rules, firestore.indexes.json, .gitignore.
- worker 준비: template-sync-worker.ts, template-worker.Dockerfile, prepare-template-worker-context.mjs.
- 테스트: templateFirestore helper, messageTemplateStore/Manager 테스트, 기존 teacherMessages 및 envValidation의 추가 검증.
- 문서: 본 기록과 파일럿 절차.

## 배포 후 사용자가 확인할 것

1. Firestore 실제 리전/Native 모드·Enterprise 과금 및 프로젝트 연결, 인덱스 준비 여부.
2. 이전 대상 dry-run의 실제 건수/원본 속성/연결/보관 상태. 소규모부터 확인.
3. main 관리자만 접근하고 일반 선생님의 기존 문자 권한이 유지되는지.
4. 앱 저장 → private worker 반영 → 원본 확인, 실패 복구·충돌 선택·텍스트 선택 복원.
5. 최초 전체/catch-up 완료 후 read mode 전환. 문제 시 최신 앱 자료를 보존하고 복귀.
6. 실제 Notion 요청·Firestore RU/WU·전송량·응답 시간 비교. 모의 호출 수를 실제 청구 단위로 해석하지 않기.

학생 정보·담당 범위의 Notion 의존은 아직 남아 있습니다. 후속 C-1은 학생/선생님/수강부터 진행합니다. 새 템플릿 생성/삭제와 전체 DB 독립 백업 활성화도 이번 파일럿 완료라고 표시하지 않습니다.

## 실행 검증

최종 lint/test 590개/build 통과, Node ESM 서버 import 통과. 비활성 로컬 worker는 /health 200, /run 503 TEMPLATE_WORKER_DISABLED를 확인한 뒤 종료했습니다. Docker가 설치되지 않아 이미지 빌드·실제 Cloud Run/ADC 실행은 확인하지 못했습니다. 기존 빌드 경고는 그대로입니다.

다음 구현 구간을 재개하기 전 사용자의 운영 확인 결과를 반영합니다. 코드 검증만으로 운영 마이그레이션 완료를 선언하지 않습니다.
