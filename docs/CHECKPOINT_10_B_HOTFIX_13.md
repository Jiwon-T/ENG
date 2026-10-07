# 체크포인트 10 B hotfix 13 — 시간표·일정 디자인 통일

## 변경 범위
0. 모바일 하단 메뉴의 mobileLabel(일지/시간표/학생/조회), 한 줄 말줄임과 min-width 보정. sticky 앱 바·탭 줄 불투명 배경과 제목 높이 보정.
1. ScheduleEventCard / WeekBoard / statusMap / ScheduleStatus / ScheduleActionBar 공용 부품. Notion 완료는 ✓+툴팁, 초안/실패는 StatusBadge. 일정 예정/변경/완료는 중립 아이콘+문구, 취소만 danger+취소선. 반 진행 중은 숨기고 중단/대기는 중립 배지다.
2. 세 보기(이번 주 일정/정규 시간표/반 관리)를 메모리 세그먼트로 전환한다. 주 버튼은 각 기존 생성 동작에 연결한다. 주간 조회 컴포넌트는 재마운트하지 않는다. 시간·제목·학생 요약/과목 카드와 오늘 강조, sticky 요일 헤더를 적용했다.
3. WeekBoard 컨테이너 700px 이상은 7열, 700px 미만은 스트립+선택일 아젠다. 날짜/과목/취소 필터는 좁은 화면의 시트로 이동했다. 좌우/Home/End 키로 날짜 선택이 가능하며 오늘이 주에 없으면 월요일부터 보여 준다.
4. 정규 표는 WeekBoard regular를 재사용한다. 기존 중단 반/중단 슬롯 제외 규칙과 시간 정렬은 유지한다. 반 관리는 로드된 반/학생 이름·초성 검색, 상태 필터와 카드 그리드를 제공한다.
5. 일정 다이얼로그는 헤더 하나·안쪽 테두리 없음·폼/저장 목록 2열(900px 미만 세그먼트). 시간 프리셋, 반 불러오기, 학생 이름 칩(X), 권한/과목 필터를 거친 StudentCombobox, 자동 확장 안내 입력, 날짜 그룹/상태 필터 목록, 하단 바와 삭제 메뉴를 적용했다.
6. 반 다이얼로그는 헤더 하나·3열 기본 정보·학생 세그먼트/검색/선택 칩·요일 ChipGroup·기존 시간/상태/중단 확인·삭제 아이콘·교재 접힘 요약·하단 저장/반영과 삭제 메뉴로 통일했다.

## 보존한 것
- 서버 API/Notion/권한/캐시/주간 로딩 방식 및 요청 계약은 변경하지 않았다. 핵심 함수 15개와 주간 조회 상태·효과 블록이 변경 전과 동일하다.
- request, workspaceSection, mergeData, loadDrafts, refresh, act, selectStudent, resetLesson, setField, openDraft, openSchedule, submitSingleLesson, 일정 initial/submit, 반 archive를 비교했다.
- 수업 일지 폼과 배열·자동 회차·LessonAcademyFields·TeacherLessonGrid·teacherWorkspace.css·sessionNumbers·teacherReadCache·scheduleSubmission 소스를 보존했다. 공통 메뉴/불투명 sticky 보정은 요청한 0번의 예외 범위다.
- 기존 저장/반영/삭제 버튼의 처리식을 옮겼고 기존 disabled·필수/검증·confirm 조건을 유지했다. 반 상태 중단 시 '시간표만/반도 함께' 기존 선택을 유지한다. 슬롯 삭제에는 원래 confirm이 없어 새 confirm을 추가하지 않았다.
- 학생 검색은 기존 권한/과목/재원 여부를 통과한 목록에서만 한다. 선택 값·순서·키·다른 필드가 표시 변경으로 정리되거나 누락되지 않는다. 브라우저 저장소에는 넣지 않았다.

## 검증 결과
- 타입 검사, 테스트 546개, 프로덕션 빌드. 기존 정규 표 테스트 2개는 새 헤더/보드 마크업과 설명 문구에 맞게 선택자만 수정했다. 정렬/중단 제외/학생 범위의 기능 기대값은 그대로다.
- 새 테스트: statusMap 색 의미, 완료 아이콘/예외 배지/취소선/링크 구조, WeekBoard 경계·스트립 선택, 반 이름·학생 이름·초성/상태 필터, 두 저장 콜백의 기존 브라우저 payload 스냅샷과 동등성.
- 실제 브라우저 모의 저장 버튼을 실행했으며 일정/반 payload는 각각 변경 전과 일치했다. 운영 요청은 모두 차단한 모의 어댑터다.
- 700px에서 7열, 699px에서 아젠다, Enter로 카드 열림, 오른쪽 방향키로 수→목 이동을 확인했다. 슬롯 요일 칩은 390px에서도 7개가 한 줄이고 45px 이상이다.
- 학생 8명 일정/반, 반영 실패·초안 배지, 빈 주, 로딩 스켈레톤, 취소 표시, 중단 반, 불투명 sticky를 확인했다. 표/목록 안쪽 스크롤은 0이며 다이얼로그는 본문 한 겹만 스크롤한다.

## 정량 비교 (1440×900, 동일 모의 데이터)
|항목|이전|이후|
|---|---:|---:|
|시간표 탭 전체 높이|1334.2px|1008.7px|
|표/목록 안쪽 스크롤바|1|0|
|첫 화면에 완전히 보이는 일정 카드|10|14|
|초기 진입+일정 탭 동일 동선 래퍼 요청|7|7|
|세 보기 전환 추가 요청|0|0|

이후 높이는 선택된 '이번 주 일정' 보기 기준이다. 세 보기 전환은 다른 두 보기를 숨겨 표시하며 컴포넌트/데이터는 유지한다. 요청 구성은 bootstrap-fast 2, bootstrap 2, drafts-page 1, schedule-records 2였다. 필터/검색/정렬/날짜 스트립 선택은 요청을 추가하지 않는다. 기존 주 이동·장소 새로고침은 기존 요청을 그대로 수행한다.

## 바뀐 파일
TeacherWeeklyCalendar / TeacherScheduleEditor / TeacherClassManager, 시간표 보기의 TeacherWorkspace 연결, 공용 NAV_ITEMS·WorkspaceMobileNavigation·WorkspaceNavigation(0번), 새 scheduleWorkspace.css와 공용 카드·보드·상태·액션바·반 카드·보기 헤더, statusMap/schedulePresentation, 테스트·스냅샷·문서·증빙.

## 못 확인한 것
실제 운영 계정/Notion 옵션과 데이터에서의 배포 후 동작, 실제 모바일 브라우저/키보드. 운영 저장·삭제·실제 문자·Make·배포는 하지 않았다. 수업 일지 입력 화면은 이번 범위로 재디자인하지 않았다.

전후 30장과 예외 화면·측정·모의 payload 원본은 [일정 검증 보고서](WORKSPACE_SCHEDULE_PROOF/index.html)에 포함한다. 누적 전체 ZIP에는 이전 변경을 모두 포함하고 미리보기용 인증/서버 모의 코드는 제외한다.
