# 입력 화면 디자인 1–3 / B hotfix 2

## 바뀐 파일
- TeacherLessonGrid.tsx: 이름과 작은 X가 한 덩어리인 칩, 상태 점/접근성 이름, 가로 스크롤, 행별 sticky 액션바, 공용 평가 칩.
- TeacherWorkspace.tsx: 단일 편집기 sticky 액션바, 기존 새로고침의 아이콘 표시, 공용 평가 칩.
- teacherWorkspace.css: .teacher-workspace 루트 토큰, 컴포넌트 상태별 스타일, 모바일 44px 터치 영역/48px 액션, safe-area, 데스크톱 이름 36px/평가 36–38px, 포커스 링 2px #ec4899 + offset 2px.
- LessonActionBar.tsx: 상태/반영 불가 이유/기존 버튼을 배치하는 표시용 컴포넌트.
- ChipGroup.tsx: radiogroup/radio, 선택 유지, 방향키 순환/Home/End, 그룹당 한 번 Tab 진입.
- lessonOptions.ts: 원래 옵션 문자열과 순서를 그대로 옮긴 단일 출처. 숙제·테스트는 앞 세 값 뒤에 구분선.
- lessonPresentation.ts: 기존 stageLabel 매핑 재사용과 표시용 상태/색 분류.

## 의도적으로 안 바꾼 것
저장/반영/request/act/setField/autoTouches/applyPreviousLesson/캐시/API를 바꾸지 않았습니다. 단일 화면 15개, 여러 학생 화면 7개 기존 핸들러를 AST로 추출해 직전 ZIP 코드와 동일함을 확인했습니다. API 전체, WorkspaceDialog.tsx와 modalFrame.css도 원본 그대로입니다. 버튼 클릭 함수와 기존 disabled 식/fieldset disabled 조건을 유지했습니다. 여러 학생의 상태 확인 버튼은 기존처럼 처리 중에도 활성일 수 있습니다.
새 라이브러리·자동 회차·자동 임시저장·검색·새 데이터 필드·배포·운영 데이터 변경은 없습니다. X의 기존 confirm와 제거 함수도 그대로입니다.
저장 시각을 새로 추적하지 않습니다. 실제 최신 저장 시각을 보장할 수 없는 경우 ‘방금’을 붙이지 않고 ‘저장됨’을 표시합니다. 처리 종류를 추측하지 않고 공통 잠금 상태에는 ‘저장·반영 처리 중’을 표시합니다.

## 검증
npm run lint / npm test(493개) / npm run build 통과. 기존 번들 크기와 Firebase mixed import 경고는 남습니다. 기존 테스트 수정은 없습니다.
로컬 브라우저: 실제 여러 학생 컴포넌트와 실제 단일 편집기의 lessonEditor JSX를 모의 상태·응답으로 렌더링했습니다. 이름/X 통합, 선택 상태, 저장 상태 반영, 방향키 이동, 그룹당 한 Tab, 버튼 중첩 없음, 콘솔 오류 없음 확인.
390px 모바일: 네 칩 그룹 모두 두 줄, 각 칩 44px, 저장·반영 버튼 48px/동일 너비 확인. 모달 스크롤 하단 sticky 바를 확인했습니다. 데스크톱 이름 칩/평가 칩 36px 확인.

## 확인 못 한 것
실제 로그인된 선생님방과 Notion 운영 반영, iOS Safari의 키보드/safe-area, 실기기 스크린리더는 확인하지 않았습니다. 배포 후 단일/여러 학생 모달과 학생 관리 내 embedding 편집기에서 스크롤·저장·반영·실패 상태를 확인해 주세요. 실제 저장 흐름은 기존 테스트로 검증했으며 이번 브라우저 응답은 모의입니다.
Bati 실제 규약 미확인과 발송 차단을 유지합니다. C/Make 중단은 진행하지 않았습니다.

## 커밋
로컬 Git 저장소가 없어 변경 전 지정 파일 다섯 개의 기준 스냅샷을 먼저 기록했습니다. 이후 이름 칩 → 액션바 → 평가 칩 순서로 독립 커밋했습니다. docs/design-patches의 세 patch에도 같은 순서를 보관합니다. ZIP은 이전 누적 코드를 모두 포함하며 .git·node_modules·dist·비밀 환경파일·모의 화면은 제외합니다.
