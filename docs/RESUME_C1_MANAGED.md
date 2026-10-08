> 후속 앱 전용 신규 등록 구현은 RESUME_C1_APP_REGISTRATION.md를 기준으로 재개합니다. 아래는 이전 반·시간표 묶음 당시의 기록입니다.

# 재개 기록 — 반·시간표·교재 앱 저장

2026-10-08. 이전 C-1 core ZIP 전체를 유지합니다.

- 새 서버 모듈: managedAcademy (원본별 단계 이전, 최종 대조, 앱 저장/삭제, 연결/이력).
- 기존 workspace/Notion workspace 연결: 활성화 뒤 조회/저장/삭제가 앱에서 끝나도록 분기. 이전 Notion 캐시 재사용과 늦은 legacy 원본 쓰기 방지.
- UI: ManagedMigrationManager, 기존 반 관리의 실제 삭제 revision/앱 저장 메시지/Notion ID 없는 공통 계획 선택 보정. 기존 confirm와 폼 배치 유지.
- 테스트: managedAcademy, 관리 UI, 기존 로딩 모의 checkpoint 확장.
- 실제 클라우드·이전·배포·문자·Make 작업 없음.

다음 묶음은 **앱 전용 신규 등록**입니다. 기존 등록의 Notion 생성 경로를 app-origin ID/내부 ID/학원/수강/담당/반 연결의 원자적 저장으로 대체해야 합니다. 이를 마무리하기 전 현재 학원의 실운영 전환은 보류합니다. 등록 차단을 임의로 제거하거나 authority 문서를 수동으로 만들지 않습니다.

현재 코드·검증 범위와 복구 제한은 C1_MANAGED.md 및 C1_FIRESTORE_CORE.md를 함께 읽습니다. 전체 C-1/학원 전체의 Notion 독립 운영 완료는 아직 아닙니다.

검증: lint/build/일반 Node ESM import 및 전체 테스트 612개 통과. 기존 로딩 테스트는 전환 checkpoint만 추가했고 나머지 로딩/권한 검사를 유지했습니다. 운영 데이터/환경변수/클라우드 설정은 변경하지 않았습니다.
