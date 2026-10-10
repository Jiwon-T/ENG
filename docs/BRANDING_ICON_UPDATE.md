# 둥근 펜촉 브랜드 이미지 교체 — 2026-10-10

승인 원본: public/branding/pen-nib-approved.png. 둥근 보라 타일/흰 펜촉과 투명한 바깥 모서리를 유지했습니다. 새 디자인 생성이나 색 재해석 없이 크기별로 내보냈습니다.

scripts/export-branding-assets.ps1로 PNG/ICO 및 HTML의 기기별 splash 이미지들을 재생성할 수 있습니다(Windows System.Drawing). favicon은 투명 PNG 및 16/32/48px ICO, Apple/Windows 아이콘은 검정 모서리를 피하기 위해 흰 배경을 사용합니다. Android 일반/512px와 별도 maskable 안전 여백 아이콘을 제공합니다.

스플래시: index.html의 기존 기기 크기·배율·방향을 유지하며, 흰 배경 중앙에 128 CSS px 아이콘을 둡니다. 기기 선택 media 조건은 바꾸지 않았습니다.

index.html/manifest.json 이미지 참조에 버전 문자열을 추가했고 서비스워커 캐시 이름을 갱신했습니다. 잘못된 OG icon.svg 경로를 실제 icon.png로 고쳤습니다. 앱 기능/API/데이터/운영 환경 변경 없음. ENG-repo 수정 없음.

운영 반영은 배포 후 확인해야 합니다. 이미 홈 화면에 설치된 아이콘/스플래시는 OS 캐시 때문에 기존 바로가기를 삭제 후 다시 추가해야 갱신될 수 있습니다. 실제 기기의 설치 화면은 아직 확인하지 않았습니다.

검증 완료: 기기별 스플래시 44개 크기·방향·흰 배경 검사, HTML 이미지/manifest 참조 61개 존재 확인, manifest 아이콘8개 크기 확인, ICO16/32/48 구조·favicon 모서리 투명도 확인, 빌드 통과. 내보낸 icon.png와 iPhone 세로 스플래시는 실제 파일을 열어 배치 확인했습니다. 브라우저/실기기 설치 화면 검증 및 배포는 미실행입니다.

## 누락 보정 — 2026-10-10
첫 작업에서 public만 교체하여 루트 favicon PNG/기존 splash_screens/기존 icons는 옛 이미지가 남아 있었습니다. 루트의 75개 이미지도 교체하고 대응 public 파일과 SHA256 동일 검증을 완료했습니다. apple-icon.png/apple-icon-precomposed.png와 icons/icon-192.png/icon-512.png도 새 이미지로 내보냅니다. 내보내기 스크립트는 양쪽 파일을 함께 갱신하도록 수정했습니다.
ENG-repo는 사용자의 작업 분리 규칙 때문에 수정하지 않았습니다. 따라서 그 폴더 및 그 폴더에서 배포한 사이트는 이 패치를 클로드가 반영하기 전까지 옛 디자인입니다.
교체 전용 ZIP의 엔트리는 프로젝트 루트 기준입니다. 클로드는 승인된 최종 폴더에 이미지들을 복사하고 index.html/manifest.json/sw.js의 참조·캐시 변경만 대조 병합하세요. 운영 코드나 마이그레이션 파일을 이 이미지 패치 때문에 덮어쓰지 마세요.

## 홈 화면 아이콘 보정 — 2026-10-10 (Claude)
apple-icon-*(apple-icon.png, apple-icon-precomposed.png 포함)과 android-icon-maskable-512x512.png는 흰 바탕 대신 타일 보라색(#542CFA)으로 캔버스 전체를 채웁니다. iOS는 투명 픽셀을 검정으로 보여 주고 직접 둥근 모서리로 자르며, Android는 maskable 아이콘을 원·둥근 사각형으로 자르므로, 두 기기 모두 바깥 흰 테두리 없이 보라색 둥근 사각형 + 흰 펜촉으로 보입니다. maskable의 펜촉 크기(400/512)는 안전 영역 안에 그대로 둡니다. export-branding-assets.ps1의 $brandFill 옵션으로 재생성됩니다.
manifest.json에 name/short_name "지원T", start_url/scope "/", display "standalone", background_color/theme_color "#ffffff"를 넣어 Android 홈 화면 이름이 "App" 대신 "지원T"로 보이게 했습니다. 이미지 버전 문자열은 pen-nib-20261010b, 서비스워커 캐시는 edu-manager-v17-branding-20261010b로 올렸습니다.
