# 체크포인트 9 긴급 수정

2026-10-05 22:41~22:42 KST 운영 로그에서 /api/teacher/workspace가 500을 반환했습니다. 배포 dpl_FUBs6jBWDUSFeEWaNidPhZcsBruK, 커밋 4ede5ebb8b52e26d2a847be16a0a4fd7f4c66332에서 다음 오류가 확인됐습니다.

ERR_MODULE_NOT_FOUND: src/lib/studentAdmission imported from src/lib/studentRegistration.js

학생 조회 별도 API는 200이었지만 선생님방 API는 모듈 로딩 단계에서 종료돼 인증·업무 처리에 진입하지 못했습니다.

studentRegistration.ts의 studentAdmission import에 .js 확장자를 추가했습니다. Vite와 tsx는 확장자 없는 경로를 해결하지만 배포된 Node ESM은 해결하지 않아 기존 테스트·타입 검사·프런트 빌드가 이 오류를 발견하지 못했습니다.

npm run check:server-imports를 추가했습니다. api와 src/lib TypeScript를 임시 트리에 JavaScript로 변환하고 tsx/번들러 없이 일반 Node로 선생님방 API를 import합니다. 데이터베이스·노션·문자 핸들러는 호출하지 않습니다. 수정 전 동일한 모듈 오류가 재현됐고 수정 후 통과했습니다. 임시 트리는 성공·실패 모두 삭제됩니다.

체크포인트 9 전체와 이전 핫픽스를 포함합니다. 실제 운영 복구 여부는 사용자가 이 수정본을 배포한 뒤 확인해야 합니다. 배포·운영 데이터 변경·실제 문자 발송·Make 변경은 수행하지 않았습니다.
