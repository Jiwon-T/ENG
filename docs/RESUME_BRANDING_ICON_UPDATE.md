# 재개 — 둥근 펜촉 이미지 적용

사용자가 승인한 최신 이미지로 checkpoint-10-a/ENG만 변경. ENG-repo 수정 금지 유지.
원본 public/branding/pen-nib-approved.png, 내보내기 scripts/export-branding-assets.ps1.
생성/교체: public/favicon*.png 및 favicon.ico, android-icon*.png, apple-icon*.png, ms-icon*.png, icon.png, splash_screens/*.png(44개).
참조: index.html(버전쿼리·faviconICO·OGPNG), public/manifest.json(8개아이콘), public/sw.js(캐시v16).
검증: 44개 스플래시의 크기/방향, 61개참조 존재, 8개manifest 해상도, ICO구조와alpha, 직접 이미지 미리보기, build 통과. 기능/API/데이터/마이그레이션 코드 변경 없음. 기존 미커밋 코드 보존. 운영배포·실기기설치테스트 미실행.
클로드에 전달 시 해당 자산/HTML/manifest/sw/내보내기 스크립트만 비교하여 ENG-repo에 반영. 필요하면 클로드의 더 최신 서비스워커 CACHE_NAME에 합쳐서 적용할 것.

누락 수정: 루트의 favicon/스플래시/icons 옛 자산도 교체 완료. public과 루트의 대응이미지75개SHA256일치. export-branding-assets.ps1가 양쪽경로모두갱신. ENG-repo/운영사이트는 미반영. 이미지 전용패치ZIP을클로드가적용해야함.
