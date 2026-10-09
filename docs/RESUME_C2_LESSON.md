# 재개 기록 — C2 일지 기반

누적 기준 ENG-firestore-C2-schedule.zip. appLesson.ts에 네이티브 저장/공개/삭제와 lessonAppHistory 기록 구현. 아직 workspace 라우트·화면·운영 authority 연결 없음. 배포 시 동작 변화 없음.

다음: 과거 원본 일지의 재개 가능한 dry-run/이전과 최종 대조부터 구현. 원본 DB·페이지 ID, 공개 문서 ID/reportIdentity, 작성자, 회차/자습 회차, 학생·내부 계정·PIN/주소를 보존. 불확실 Notion 생성·중복 원본·담당 연결 누락·삭제는 자동 병합/무시 금지. 대조 증거가 없는 빈 원본 반환이나 전체 Notion 차단 금지.

대조 후 조건부로 saveAppLesson/publishAppLesson/archiveAppLesson 연결. 공개 리포트 로더는 삭제 문서를 읽지 않으므로 삭제 시 공개 문서를 제거하되 트랜잭션 history에 원본을 보관함. 복원 UI/API는 미구현. 이전 수업과 회차 계산 조회를 마지막에 전환.

운영 배포·실제 화면은 사용자 담당. 실제 데이터 이전/활성화·문자·Make 중단 미실행.

갱신(2026-10-09): 과거 일지 dry-run·재개 가능한 이전·대조 구현됨 → C2_LESSON_MIGRATION.md / RESUME_C2_LESSON_MIGRATION.md. 라우트 연결·조회 전환은 아직 남음.
