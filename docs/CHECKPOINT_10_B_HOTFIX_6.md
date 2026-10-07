# 체크포인트 10 B hotfix 6 — 일지 입력 화면 밀도

## 완료 범위
0: 이름 띠/하단 바 불투명 흰색, 경계선/z-index, 팝업 바 바닥 정렬, 중복 수업 내용 제목 제거.
1: field-h/gap/card-pad/label-size/chip-h 토큰, fine pointer 밀도, touch 44px, 단일/팝업 독립 container query.
2: 학생→날짜→과목→새 일지, 수업·자습의 유무→회차→시작→종료 순서와 프리셋 줄. 중복 시간 요약 제거. 자습 필드는 hidden으로 유지하고 값/있음/오류 시 노출.
3·4: 출결·평가 칩 밀도, 일괄 상 버튼 위치, 두 점수 카드의 native details 접기·자동 펼침·요약.
5: 수업 내용과 선택 텍스트 영역 그리드, AutoTextarea 2~8줄 자동 높이 및 내부 스크롤. 필수 속성과 기존 값/콜백 유지.
6: 오늘 수업 두 줄 카드, 저장 기록 한 줄, 좌측 sticky, 일지 탭 hero 축소.
7: 팝업 2줄 툴바, 1~2명 이전/다음 hidden, 중복 이름 제거, 기존 날짜/과목 표시. 좁은 툴바는 가로 스크롤로 44px 클릭 영역을 유지한다. 공통 입력을 펼치면 입력 영역이 추가된다.

## 높이 측정 (기본 상태)
같은 모의 데이터, 점수 미입력/접힘, 자습 미확인. 단일은 학생 입력칸 위부터 시험범위 textarea 아래까지, 팝업은 학생 툴바 시작부터 같은 끝까지. 스크롤 위치를 제외한 실제 브라우저 CSS px이다.

| 뷰포트 | 단일 전→후 | 팝업 전→후 |
|---|---:|---:|
|1440×900|1831→805 (44.0%)|1455→722 (49.6%)|
|1280×720|1831→805 (44.0%)|1455→722 (49.6%)|
|390×844|2159→1632 (75.6%)|2294→1671 (72.8%)|

데스크톱 기본 상태의 약 50% 이하 목표를 달성했다. 모바일은 44px과 줄바꿈을 유지하므로 50%로 줄이지 않았다. 값/오류로 점수와 자습이 펼쳐지면 높이가 늘어난다. 상태별 전체 측정은 density-proof/index.html 및 measurements.json에 있다.
1440 단일에서 PageDown 한 번 후 시험범위 끝 778.1px < 바 시작 800.1px. 1280 팝업도 한 번 후 끝 625px < 바 시작 647.7px로 바에 가리지 않았다.

## 브라우저 검증
- 3크기×4상태×2화면×전후 48장 및 2개의 스크롤 보충 화면. 실제 컴포넌트/단일 JSX와 모의 데이터 사용. 운영 화면 캡처는 아니다.
- 점수 3/20 유지, 값이 있으면 접힘 방지, 비우면 접힘, 닫힌 상태도 4 input 계속 존재.
- 자습 ‘있음’ 노출, 접힘/펼침 중 제거된 input/select/textarea 0개(MutationObserver).
- 긴 텍스트 높이 168px, 내부 scrollHeight 500px, resize none, overflow auto.
- 단일·팝업 네이티브 Tab 키 기록. 날짜/시간의 내부 세그먼트는 같은 필드로 반복되지만 필드 순서는 학생→날짜→과목→수업→자습→출결·평가→점수→내용이다. 팝업 과목은 기존처럼 읽기 전용 텍스트다.
- 팝업 바 bottom 883.333px = 스크롤 컨테이너 bottom 883.333px. 바/툴바 background rgb(255,255,255).
- 390px input/select 44px, 칩 최소 높이 44px 확인. 테스트 브라우저 pointer는 fine이고, coarse 44px CSS를 함께 적용했다. 실제 터치 기기/가상 키보드는 미확인.

## 검증·변경 보호
npm run lint(타입 검사), npm test 523/523, npm run build 통과. 기존 테스트는 수정하지 않았다. LessonTimeFields의 기존 정확한 class 표기도 유지했다.
기존 핵심 함수 20개의 TypeScript AST가 같고, API/캐시/자동 회차/필드 입력 규칙 등 94개 파일의 해시가 이전 hotfix 5와 같다. WorkspaceDialog 및 StudentCombobox 소스는 변경하지 않았다. 학생 정보는 기존 메모리 상태에만 둔다. 새 라이브러리는 추가하지 않았다.
새 테스트: 접힘/값/오류/0값, 필드 DOM 유지와 disabled, 입력 순서, 2~8줄 높이, 작은 학생 수의 내비게이션 표시.

## 바뀐 파일 / 안 바꾼 것 / 못 확인한 것
바뀜: TeacherWorkspace.tsx, TeacherLessonGrid.tsx, LessonAcademyFields.tsx, LessonTimePresets.tsx, LessonTests.tsx, TeacherTodayLessons.tsx, teacherWorkspace.css, AutoTextarea.tsx, useAutoGrowTextarea.ts, lessonDisclosure.ts, lessonDensity.test.tsx, 문서/증빙.
유지: 저장·반영·권한·캐시·API, 자동 회차·autoTouches, 필드 키/값·검증·필수·disabled, 인증/PIN/기존 ID 및 연결, WorkspaceDialog embedding.
미확인: 운영 로그인/데이터 반영/실제 학생 데이터, 실제 모바일 IME·가상 키보드, 다양한 운영 장문/브라우저 확대 비율. 배포·문자 발송·Make 변경은 하지 않았다. A의 미작성 판정 수정은 기존 미구현 상태다.

성공 저장/반영 안내는 오류로 취급하지 않는다. 관련 자습/점수 검증 안내만 접힘 자동 노출의 오류 조건으로 사용한다. 브라우저 스크린샷 파일은 스크롤바 영역을 제외할 수 있으며 측정표의 크기는 CSS 뷰포트 기준이다.

