# 재개 기록 — C2 일지 이전·전환

저장소 파일: `C:\Users\lizzi\Downloads\지원t-english\ENG-repo` — `.git`이 없어 GitHub 저장소 폴더에 그대로 복사·덮어쓰기할 수 있습니다(사용법: `ENG-repo-사용법.txt`).
변경 기록: `ENG-repo.git` (`git --git-dir=ENG-repo.git --work-tree=ENG-repo log --oneline`)
- 태그 `c2-auto-import` → `c2-lesson-migration` → `c2-lesson-cutover-switch` → `c2-lesson-app-paths` → `c2-notion-dependency-audit` → `c2-template-cutover` → `c2-lesson-read-scope` → `c2-lesson-restore` → `c2-lesson-review-period` → `c2-design-rosy-peach` → `c2-notion-disconnect-readiness` → `c2-app-only-notion-gaps` → `c2-grade-cutover` → `c2-first-load-verified` → `c2-review-grade-redesign` → `c2-managed-app-first`
- 작업 폴더 `checkpoint-10-a\ENG`에서 고친 뒤 `python -I sync-eng-repo.py`로 저장소에 반영하고 커밋합니다. ENG-repo에 커밋 안 된 변경이 있으면 동기화가 멈춥니다(ENG-repo에서 직접 고치지 말고 작업 폴더에서 고칠 것).
- 전역 git 설정 `core.autocrlf=true`와 달리, 이 저장소만 `false`로 두어 파일 바이트를 그대로 보존합니다.

상세 문서(docs/): C2_LESSON_MIGRATION · C2_LESSON_CUTOVER · C2_LESSON_APP_PATHS · C2_NOTION_DEPENDENCY_AUDIT · C2_TEMPLATE_CUTOVER · C2_LESSON_READ_SCOPE · C2_LESSON_RESTORE · C2_LESSON_REVIEW_PERIOD · C2_NOTION_DISCONNECT · C2_APP_ONLY_NOTION_GAPS · C2_GRADE_CUTOVER · C2_REVIEW_GRADE_REDESIGN · C2_MANAGED_PENDING_WRITE

## 현재 상태 (`c2-managed-app-first`)
- 영역별 검증 기반 앱 전용 스위치가 모두 있습니다: 학생·선생님(C1) · 반·교재·시간표(C1) · 일정 · 일지 · 문자 템플릿 · 성적.
- 모든 스위치를 켜면 앱 화면(첫 화면 포함)의 Notion 호출이 0회입니다(테스트로 확인). 남은 Notion 사용은 관리자 진단·설정·이전 도구뿐입니다.
- 전환 후 Make 수신(일지·일정·성적·수강)은 반영하지 않습니다.
- 설정 탭 `Notion·Make 연결 정리 준비` 카드: 영역별 전환 상태·순서·위치, Make·작업기·토큰 정리 단계, 최근 7일 사용량.
- 디자인: 로지 피치 알약 버튼, Pretendard(선생님 화면만). 일지 조회·성적 관리·성적 입력 팝업 새 디자인(시험명은 학생 관리의 학교·학년으로 `세교중2-2중간`처럼 자동 완성).
- 운영 미실행: 배포, 데이터 이전, 전환, 실제 로그인 화면, Make 변경·중단, 문자 발송, 원격 push.

## 배포 후 사용자 순서 (승인 후)
0. 반·교재 이전이 `MANAGED_PENDING_WRITE`로 멈췄다면 `전체 자료 이전 시작·재개` → `반·교재 앱 저장본 확정` 순서로 다시 진행합니다(미완료 반은 앱 저장본으로 지킴, `C2_MANAGED_PENDING_WRITE.md`).
1. 연결 정리 카드의 `다음 차례`를 따라 영역별로 전환합니다. 각 카드는 버튼 하나로 최종 대조 후 전환하고, 문제가 있으면 전환하지 않습니다.
2. 카드의 정리 단계에 따라 Make 일지 → 일정 → 성적 시나리오, 템플릿 작업기, Notion 쓰기 권한을 차례로 정리합니다.
3. 문제가 생기면 해당 영역의 `전환 해제`로 되돌립니다. 앱 자료는 보존됩니다.

## 다음 구간 후보
1. 배포 후 사용량 카드에 예상 밖 Notion 경로가 보이면 정리.
2. 디자인 후속: 9~11px 작은 글자(약 57곳) 점검(사용자 결정으로 보류 중).

## 보존할 것
학생 계정·내부 ID·담당, 리포트 주소·PIN, 원본 DB/페이지 ID, 공개 ID/reportIdentity, 기존 이전 도구, report-review 계약, ParentReportView·LearningReport 무변경.
