# TASK — 배포 & 구글 클라우드 동기화

[docs/cloud-sync.md](docs/cloud-sync.md) 조사 내용을 실제 작업 항목으로 정리한 문서입니다. 상태 표시: ✅ 코드 반영 완료 / ⚠️ 사용자의 수동 설정이 필요(리포지토리 관리자·Google 계정 소유자만 할 수 있는 작업이라 에이전트가 대신 할 수 없음).

## 1. 일반 사용자 배포 (GitHub Pages)

- [x] `.github/workflows/deploy-pages.yml` 추가 — `web/` 변경 시 자동으로 GitHub Pages에 배포
- [ ] ⚠️ 저장소 **Settings → Pages → Source**를 "GitHub Actions"로 지정 (GitHub 웹 UI에서 1회 설정 필요)
- [ ] ⚠️ (선택) 커스텀 도메인 연결 시 **Settings → Pages → Custom domain** 입력 및 DNS CNAME 설정

## 2. 구글 계정 로그인

- [x] `web/js/config.js` 추가 — `GOOGLE_CLIENT_ID` 설정 자리 마련
- [x] `web/js/cloudSync.js` — Google Identity Services 로그인(`initGoogleSignIn`), 로그아웃 구현
- [x] `web/index.html`에 GIS 스크립트 태그, 설정 모달 내 로그인 버튼 영역 추가
- [ ] ⚠️ [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성 → OAuth 동의 화면 등록 → OAuth 클라이언트 ID(웹 애플리케이션) 발급
- [ ] ⚠️ 발급받은 Client ID를 `web/js/config.js`의 `GOOGLE_CLIENT_ID`에 입력
- [ ] ⚠️ OAuth 클라이언트의 **승인된 자바스크립트 출처**에 실제 배포 도메인(예: `https://<사용자명>.github.io`) 등록
- [ ] ⚠️ 테스트 사용자 100명을 초과할 예정이면 OAuth 동의 화면을 "프로덕션"으로 전환 신청 (Google 심사 필요, [docs/cloud-sync.md §2.4](docs/cloud-sync.md#24-배포운영-시-주의할-제약) 참고)

## 3. 구글 드라이브 백업/복원

- [x] `web/js/cloudSync.js` — `drive.appdata` 스코프 토큰 클라이언트, `backupToDrive()` / `restoreFromDrive()` 구현
- [x] 설정 모달에 "지금 백업" / "드라이브에서 복원" 버튼 연결
- [ ] ⚠️ 2번 항목의 Client ID 설정이 선행되어야 실제로 동작 (미설정 시 버튼이 비활성화되고 안내 문구 표시)

## 4. 구글 드라이브 대체 저장 방식

- [x] JSON 내보내기/가져오기(`exportJson`, `importJsonFile`) — 외부 계정 없이 항상 사용 가능
- [x] File System Access API 기반 로컬 폴더 저장(`exportToLocalFolder`) — Chromium 계열 브라우저에서 로컬 동기화 폴더(구글 드라이브/Dropbox 데스크톱 폴더 등)에 직접 저장, 미지원 브라우저에서는 버튼 숨김
- [ ] (선택, 미구현) Dropbox/OneDrive API, Firebase/Supabase 전환 — 필요 시 [docs/cloud-sync.md §4.3~4.4](docs/cloud-sync.md#43-다른-클라우드-스토리지-api로-대체)를 참고해 후속 작업으로 진행

## 배포 상태

코드는 `main` 브랜치에 커밋·푸시되었습니다. 위 ⚠️ 항목(Google Cloud Console 설정, GitHub Pages 활성화)은 **리포지토리/Google 계정 소유자의 로그인이 필요한 작업**이라 에이전트가 대신 수행할 수 없습니다 — 완료 후 앱이 실제로 공개 URL에서 로그인·동기화까지 정상 동작합니다.
