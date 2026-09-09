# TASK — 배포 & 데이터 백업/공유

[docs/backup-and-deploy.md](docs/backup-and-deploy.md) 내용을 실제 작업 항목으로 정리한 문서입니다.

> 처음에는 구글 계정 로그인 + 구글 드라이브 동기화로 설계했으나, "각 사용자가 자기 데이터를 직접 저장"하는 것이 목적이라는 피드백에 따라 **계정 로그인 없이 파일로 직접 백업/복원/공유**하는 방식으로 전환했습니다.

## 1. 일반 사용자 배포 (GitHub Pages)

- [x] `.github/workflows/deploy-pages.yml` — `web/` 변경 시 자동으로 GitHub Pages에 배포
- [x] 저장소 **Settings → Pages → Source**를 "GitHub Actions"로 지정 완료
- [x] 배포 확인 완료 — `https://JaminJeong.github.io/imgangr/`
- [ ] (선택) 커스텀 도메인 연결 시 **Settings → Pages → Custom domain** 입력 및 DNS CNAME 설정

## 2. 내 파일로 백업/복원

- [x] `web/js/backup.js` — `buildPayload()` / `restorePayload()`로 세션·마커를 JSON 백업 데이터로 조립·복원
- [x] `exportToDownload()` — 파일로 저장 (다운로드)
- [x] `importFromFile()` — 저장된 파일에서 복원
- [x] 설정(⚙️) 모달에 "파일로 저장" / "파일에서 복원" 버튼 연결

## 3. 로컬 동기화 폴더에 저장

- [x] `exportToLocalFolder()` — File System Access API로 사용자가 고른 폴더(구글 드라이브/Dropbox 데스크톱 동기화 폴더 등)에 직접 저장
- [x] 미지원 브라우저(Firefox/Safari 등)에서는 버튼 자동 숨김 (`isFileSystemAccessSupported()`)

## 4. 메일 등으로 공유하기

- [x] `shareBackup()` — Web Share API(`navigator.share`)로 백업 파일을 OS 공유 시트에 전달, 사용자가 메일 앱을 고르면 파일 첨부된 새 메일 작성 화면이 열림
- [x] 미지원 브라우저에서는 버튼을 숨기고 "파일로 저장 후 직접 첨부" 안내 문구 표시 (`isShareSupported()`)
- [ ] (선택, 미구현) 외부 이메일 API(EmailJS 등) 연동으로 완전 자동 발송 — 제3자 서비스 계정·API 키가 필요해 현재 범위에서는 제외. 필요 시 [docs/backup-and-deploy.md §4](docs/backup-and-deploy.md#4-메일-등으로-공유하기) 참고

## 배포 상태

모든 항목이 코드에 반영되어 `main` 브랜치에 푸시·배포되었습니다. 남은 항목은 커스텀 도메인 연결(선택)과 완전 자동 이메일 발송(선택, 제3자 계정 필요) 정도이며, 핵심 기능(배포·백업·복원·공유)은 별도 설정 없이 바로 사용 가능합니다.
