# 체크포인트 10 B hotfix 12 — 폼 바깥 화면 구조·디자인

## 결과
- 0: 빈 회차 안내의 고정 24px 여백을 제거했다. 프리셋은 입력 행에서 8px 아래다. 날짜 스테퍼·얇은 스크롤바·줄바꿈 없는 요약을 적용했다.
- 1: 상태색 5종(bg/fg/border/dot), 브랜드·타이포·반경·그림자 토큰을 정리했다. CSS 직접 HEX 144곳을 변수로 바꿨다. teacher TSX에는 직접 HEX 값이 없어 0곳이다. Tailwind 색 유틸리티는 지정한 교사 화면의 루트 토큰 스타일로 보정한다. 공용 StatusBadge는 오늘 수업·저장 기록·학생 이름 칩·하단 바·일정 카드에서 점+아이콘+텍스트/접근성 이름을 제공한다.
- 2: 제목·날짜를 탭 줄 왼쪽으로 이동했다. 슬림 탭은 기존 setTab과 기존 권한 조건을 사용한다. 작성 방식은 카드 제목의 세그먼트로, 작업 내역은 아이콘 팝오버로 이동했다. 상단 탭은 방향키/Home/End·roving tabindex·aria-selected·선택 탭 스크롤·양끝 페이드를 지원한다.
- 3: 진행바·숫자 칩·다음 미작성 버튼·현재 수업 강조·빈 상태·스켈레톤을 추가했다. 이미 로드된 기록만 사용한다. 440px 이상 패널에서는 날짜와 진행 요약을 한 줄로, 좁은 왼쪽 패널에서는 날짜와 진행 요약을 두 줄로 배치하되 숫자 칩은 줄바꿈하지 않는다. 폼 폭 보호를 위해 왼쪽 패널을 넓히지 않았다.
- 4: 실제 앱 저장 성공 후 3초 동안 '저장됨 ✓ 방금'을 표시하고 저장/대기는 황색으로 돌아온다. 실패 이유와 기존 저장 동작을 재호출하는 버튼을 제공한다. Notion 반영 결과 재확인은 기존 별도 복구 버튼을 유지한다. 120ms 이하 버튼/탭 전환, reduced-motion, 크기가 바뀌지 않는 스피너를 적용했다.
- 5: NAV_ITEMS 한 곳에서 데스크톱·모바일·더보기를 만든다. 컨테이너 또는 뷰포트가 768px 미만이면 모바일 탭바를 사용한다. 아래 스크롤/키보드 감지 시 숨김, 위 스크롤/키보드 닫힘 시 복귀하며 액션바를 탭바 위에 쌓는다. native dialog가 탭바 위를 덮는다.

## 날짜 연동
단일 작성의 왼쪽 목록 날짜(lessonDay)는 폼 날짜(lesson.date)와 독립이다. 날짜 스테퍼만 눌러서는 폼 날짜가 바뀌지 않고, 수업 카드를 선택할 때 해당 날짜가 폼에 들어간다. 여러 학생 작성의 목록 날짜는 기존 공통 날짜 설정과 같은 date 상태다. 기존 동작을 유지했다.

## 단일 화면·팝업 밀도
확정된 basics → schedule/content → assessment/extras의 영역과 lesson-input/lesson-schedule 컨테이너 기준점은 유지했다. 시험 점수는 출결·평가 아래의 기존 위치에서 항상 보인다. 자습은 항상 펼쳐져 있다. 요청한 빈 여백 제거를 공통 CSS에 적용해 두 화면이 같은 기준을 쓴다.

1440×900 CSS 뷰포트의 반영 완료 기록에서 두 화면 모두 입력 높이 38px, 프리셋 간격 8px, 시간 카드 116.1px, 수업 내용 218.3px이다. 팝업 시간 카드는 이전 144.1px, 내용 칸은 이전 274.3px이었다. 최신 팝업 내부 clientHeight=scrollHeight=737px로 시험 점수와 시험범위까지 세로 스크롤 없이 들어온다. 내용 최소 160px 규칙은 유지한다. 좁은 폭에서는 기존 기준으로 1열 전환한다.

## 폼 카드 시작 위치
스크롤 0·높이 900px·개발용 측정 행을 본문에서 제외한 격리 모의 화면 기준이다. 공통 앱 바가 없는 미리보기이므로 운영의 절대 y는 달라질 수 있다.

| CSS 뷰포트 | 이전 y | 이후 y | 위로 이동 |
|---|---:|---:|---:|
|1440×900|192.3|68.0|124.3px|
|1024×900|1041.2|68.0|973.2px|
|768×900|1041.2|919.7|121.5px|
|390×900|1127.2|959.0|168.2px|

1024px 개선에는 기존에 폼 위로 쌓였던 왼쪽 문맥 패널을 옆에 놓는 바깥 레이아웃 보정이 포함된다. 내부 폼 분기 기준을 바꾼 것은 아니다.

## 검증
- npm run lint / npm test(541개) / npm run build.
- 상태색 5개 및 브랜드 주요 버튼 텍스트 조합 WCAG AA 4.5:1 이상. 4개 폭 × 4개 탭 첫 화면의 활성 텍스트에서 미달 항목 0. 비활성 컨트롤은 AA 예외로 검사에서 제외한다.
- 일반 교사의 관리자 설정 미노출, NAV_ITEMS 단일 출처, 탭 방향키/aria, 공용 상태 점+문구+아이콘, 진행률 0/미작성/완료/혼합, 스크롤·키보드 감지 판단, 실패 이유/재시도를 테스트했다.
- 브라우저에서 날짜 독립성, 가장 이른 미작성(18:30) 선택과 강조, 저장 성공 3초 후 황색 복귀, 모의 실패 이유/재시도, 일반 교사 더보기 권한, 방향키 선택/포커스, 모바일 아래/위 스크롤 숨김/복귀를 확인했다.
- 보호한 request/workspaceSection/mergeData/loadDrafts/refresh/act/selectStudent/resetLesson/setField/openDraft/openSchedule 11개 함수는 변경 전과 텍스트가 동일하다. 수업 입력·회차·캐시 모듈을 포함한 기존 src/lib·teacher 파일 87개가 동일하다. 서버 API와 계약, 저장·반영·권한·캐시·자동 회차·autoTouches·필드 값/키·검증·기존 disabled 조건을 변경하지 않았다.
- 새 서버 요청·배포·실제 운영 저장·문자·Make 작업은 없다. 모의 요청과 응답으로만 화면을 검증했다. 학생 정보는 메모리에만 둔다.
- 학원 전체 미반영/실패 건수는 페이지에 없는 기록을 포함해 확정할 수 없어 선택 사항인 공통 동기화 배지는 추가하지 않았다.
- 실제 모바일 키보드/IME·운영 앱 공통 바 높이와 레이어·실제 계정 데이터로의 배포 후 확인은 미확인이다.

전후 32장과 단일/팝업 추가 증빙은 [스크린샷 보고서](WORKSPACE_SHELL_PROOF/index.html)에 포함했다. 비교 이미지는 comparison-1440/1024/768/390.png다. 기존 테스트의 기능 기대값은 변경하지 않았다.

## 바뀐 파일
teacherWorkspace.css, TeacherWorkspace.tsx, TeacherLessonGrid.tsx, TeacherTodayLessons.tsx, TeacherWeeklyCalendar.tsx, LessonActionBar.tsx; 새 DateStepper/StatusBadge/WorkspaceNavigation/LessonModeSwitch/WorkspaceMobileNavigation, workspaceNavigation/useWorkspaceMobileBars, todayLessonProgress의 표시용 계산, workspaceShell.test.tsx, 이 문서와 재개 기록·스크린샷 증빙.

## 안 바꾼 것
LessonAcademyFields / LessonTimePresets / AutoTextarea / ChipGroup / LessonTests의 소스와 필드 구조, 폼 내부 영역·기준점, 서버·API·캐시·회차·권한·라우팅 흐름. 변경은 표시와 이벤트 연결의 범위다.
