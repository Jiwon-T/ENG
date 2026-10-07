# 체크포인트 10 B hotfix 8 — 두 띠 일지 레이아웃

## 구현
(1) 기존 table/fieldset 및 disabled 상속을 유지하는 편이 안전해 LessonFormLayout 컴포넌트 대신 두 화면에 같은 lesson-form-layout/grid-template-areas를 적용했다. DOM은 basics → schedule → content → assessment → extras 순서다. 바·툴바 불투명과 하단 정렬 유지.
(2) 첫 번째 띠: 왼쪽 수업 위/자습 아래, 오른쪽 수업 내용. 컨테이너 900px 이상에서 schedule clamp(440px,44%,520px). 카드 padding10/gap8, 시간 칸 최소104px, 작은 schedule은 2×2. 프리셋28px, 회차 안내 자리24px 고정으로 자습 전환 점프 방지. 내용 14줄 상한/최소3줄, 넓은 화면 최소8줄 및 schedule 높이 채움.
(3) 두 번째 띠: 1000px 이상 assessment min640 왼쪽, extras min320 오른쪽 세로3칸. 선택 입력 최대6줄. 평가 칩32px/라벨56px/간격6px, 점수 native details와 요약 유지.
(4) 900~1000px은 assessment 전체 폭 후 extras3열. 900px 미만은 한 열·44px 입력/칩. 모든 분기는 container query. 단일 입력부도 넓은 화면에서 1000px 구조를 쓸 수 있게 일지 탭만 최대1440px로 확장.
자습은 항상 펼친다. 같은 높이/좌표를 유지하고 기존 disabled 조건만 적용한다. 점수 입력은 닫혀도 DOM 유지, 값/관련 오류 시 자동 펼침. 기존 메모는 접지 않는 표시로 유지했다. 기존 직전 수업 버튼이 없어 새로 만들지 않았다. 오늘 정규 칩은 기존처럼 수업 시간에만 사용한다(자습 시간 값을 임의로 바꾸지 않음).

## 높이 (동일 모의 데이터, 학생1명, 점수 접힘)
단일은 학생 입력 위부터 시험범위 끝, 팝업은 칩/툴바 시작부터 extras 끝. DOM의 스크롤 위치 영향 제외 CSS px.

|뷰포트|단일 전→후|팝업 전→후|
|---|---:|---:|
|1440×900|847→590|697→696|
|1280×720|847→673|697→696|
|390×844|1811→1738|1816→1715|

1440 팝업 스크롤 영역 clientHeight=778, scrollHeight=778로 기본 상태 세로 스크롤 없음. 수업 내용 clientHeight273, lineHeight19.5px로 약13줄 표시(8줄 이상). 1280 팝업은 더 작은 높이로 스크롤이 필요하다. 모바일은 44px·한 열 유지.

## 검증
- 자습 있음/미확인 전환: 카드 각각144.125px, y249.833/401.958px 동일. 첫 띠296.333px와 다음 띠 y556.167px도 동일.
- 점수 3/20 자동 펼침 및 값 유지. 제거된 필드0개.
- 25줄 수업 내용: 입력 높이285px, scrollHeight500px, 내부 스크롤; 14줄 상한.
- 오류 안내 표시와 점수 펼침 확인. 학생8명 칩 strip nowrap 확인.
- 컨테이너961px: 첫 띠2열, 평가 전체폭 뒤 extras3열. 3개 뷰포트 전후12장과 상태 화면/측정/Tab 기록은 docs/hotfix-8-proof.
- 실제 Tab 키: 날짜→수업→자습→수업 내용→평가→점수→특이사항→과제→시험범위. 팝업 과목은 기존 읽기 전용이라 Tab 정지 없음. 날짜/시간 내부 세그먼트는 여러 번 정지할 수 있다.
- lint, npm test527/527, build 통과. 핵심 함수20개 AST 및 API/캐시/자동 회차 등94개 파일 해시 동일.
- 정적 검사가 생성된 검증 로그의 숫자 문자열을 검사 대상으로 잡는 충돌이 있어, 임시 로그를 코드 밖 보관 폴더로 옮겼다. 검사/검증 규칙은 변경하지 않았다.

## 바뀐 파일 / 안 바꾼 것 / 못 확인한 것
바뀜: TeacherWorkspace.tsx, TeacherLessonGrid.tsx, LessonAcademyFields.tsx(안내 자리만), AutoTextarea.tsx, useAutoGrowTextarea.ts, teacherWorkspace.css, 레이아웃 테스트·문서·증빙.
유지: 저장/반영/권한/캐시/API/자동 회차/autoTouches/값/키/필수/disabled 및 WorkspaceDialog embedding. 학생 데이터는 기존 메모리 보관만 유지.
미확인: 운영 로그인/실제 데이터 반영/Notion 저장, 실제 모바일 키보드/다른 브라우저 확대 비율. 배포·발송·Make 변경 없음. A의 미작성 판정 변경은 이번에도 미구현 상태.
