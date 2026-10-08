# 학생 관리·리포트 대시보드 — 2026-10-08

## 상태
0~4 코드 구현과 로컬 회귀 검증을 마쳤습니다. 브라우저 시각 검증은 미완료이며 완료 판정은 보류합니다. 5의 공개 부품 공용화는 전후 스크린샷 동등성 조건을 확인할 수 없어 실행하지 않았습니다. 공개 화면을 변경하지 않은 선생님용 부품을 유지합니다.

## 변경 파일
- TeacherWorkspace: students 카드 격자를 학생 목록/인라인 상세로 전환. 첫 학생 자동 선택 없음. 학생 선택과 바깥 탭 이동을 StudentManagementDialog attempt에 연결.
- StudentMasterPanel(신규): 이미 권한이 확인된 students만 초성 검색·구분·과목 필터, listbox 위/아래/Enter, 예외 배지. 900px 컨테이너 아래에서는 콤보박스/학생 이동.
- StudentManagementDialog: 기존 모달 기본 동작 유지, inline 프레임 선택과 외부 attempt 등록 추가. 권한별 탭과 embedding을 재사용. busy 상태에서는 이동 차단.
- StudentRegistrationManager: 로딩/건수와 관계없이 기본 접힘, 추가 버튼도 펼침 안에 배치. 요청·저장 경로 유지.
- TeacherReportReview: 미조회 섹션은 숫자 0 대신 · 표시. 선택된 학생·audience·과목·section과 응답 scope가 일치할 때만 건수 표시. 인라인 학생 이동 제거, 관리 헤더에 연결 상태/새로고침/학부모 링크를 portal로 표시. 선생님 도구와 공개 미리보기 분리.
- TeacherOnlineLearning: 날짜 그룹, 컴팩트 행, 건수 포함 ChipGroup, 오답 필터·모두 펼침/접기·aria-expanded, 읽기 전용 오답 2열. 커서 이동 유지.
- ScoreTrend(신규): 자동 범위 축·날짜·값·포커스 가능한 점, 최신 점 강조. 유효한 단어 테스트 2회 이상에서만 표시.
- SessionRow, LessonRecordCard, LessonDetailPane, ReportPill(신규), ReportScheduleRow: 선생님 전용 표시. 출결 알약 클래스는 ParentReportView의 실제 emerald/amber/rose 규칙을 따름.
- teacherWorkspace.css: 바깥 브랜드/안쪽 공개 색 분리. 공개 indigo/slate/emerald/rose Tailwind 테마 토큰 사용. 데스크톱 접힌 행 64px 기준, 칩 32px/터치 장치 44px, 한 목록 스크롤과 페이지 본문.
- teacherReportPresentation helpers와 studentDashboard/온라인 UI 테스트.

## 안 바꾼 것
report-review API 입력·응답·캐시·계정 연결·권한·저장/반영 서버 코드는 변경하지 않았습니다. 새 서버 요청·브라우저 학생 정보 저장·개인정보 로그는 추가하지 않았습니다. visibleStudentSchedules/sortParentSchedules, 수업 일지와 시간표 폼 로직은 유지합니다.
ParentReportView/LearningReport/AcademicPanel 3개 파일은 이전 누적 ZIP과 바이트 단위 동일합니다. AcademicPanel의 기존 teacher variant에 CSS만 적용했습니다.
배포·운영 데이터 수정·SMS 발송·Make 변경은 하지 않았습니다.

## 검증
lint 통과, 전체 테스트 630/630 통과, build 통과. 기존 CSS @import 순서와 큰 번들 경고는 남습니다.
테스트: 미로딩 건수/실제 0, 높은 점수 자동 축, 포커스/날짜, 오답 필터와 펼침 계산, 초성 검색의 입력 범위 보존, 인라인 모달 미생성/권한 탭, 학생 전환 guard 거절/수락. 기존 공개 화면·audience DTO·점수 계산 회귀도 통과했습니다.

## 요청 수·동선
정적 경로 확인 결과 학생 관리 진입의 기존 bootstrap/등록 목록 요청 경로는 유지하고, 선택 전 report-review 요청은 없습니다. 학생 선택 시 기존 report-review 요청 1개 경로를 재사용합니다. 학생 목록 검색·필터·키보드·오답·차트가 요청을 추가하지 않습니다. 실제 네트워크 수(캐시/동시 요청 포함)는 미측정입니다.
학생 전환은 목록 1번 선택 동선이며, 첫 선택 후 점수 표시를 위해 별도 리포트 버튼을 누를 필요가 없습니다. 실제 클릭 수 전후 실측은 없습니다.

## 못 확인한 것
CUA 브라우저를 reset 후 재시도했지만 trusted Node process 종료로 실행되지 않았습니다. 1440/1024/390px 스크린샷, 미연결/빈 기록/긴 피드백/20명 이상 상태의 실제 레이아웃, 공개 전후 스크린샷은 없습니다.
활동 행 높이: 첨부 화면 사용자 추정 약270px → CSS 설계 64~72px, 실측 미확인.
첫 콘텐츠: 헤더·탭·툴바 간격을 줄였으나 180px 이하 여부 미측정.
1440×900에서 8행 이상 표시 여부 미확인. 차트와 필터 줄바꿈을 포함해 실제 화면에서 추가 밀도 조정이 필요할 수 있습니다.
계정 명단에는 연결됨으로 보였으나 온라인 응답에서 연결 불일치가 밝혀지는 경우, 추가 요청을 피하기 위해 안내 상태를 표시하고 자동으로 다른 section을 재조회하지 않습니다.
스크린샷이 검증되기 전까지 5의 공용 부품 추출은 보류합니다.
