# 배포 및 데이터 백업/공유 가이드 (Deployment & Backup)

본 문서는 **임장기록(Imgangr)**을 일반 사용자가 접속할 수 있도록 배포하는 방법과, 각 사용자가 자신의 기록을 계정 로그인 없이 직접 저장·복원·공유하는 방법을 다룹니다.

> 📌 **설계 원칙**: 임장기록은 [서버 없는 로컬 우선(Local-First) 앱](backend.md)입니다. 데이터를 특정 회사의 클라우드 계정(구글 등)에 자동 동기화하는 대신, **사용자가 자신의 데이터를 파일로 직접 소유하고 옮길 수 있게** 하는 쪽을 택했습니다.

> 📌 **구현 현황**: 아래 내용은 `web/js/backup.js`(백업/복원/공유 로직), `web/index.html`의 설정(⚙️) 모달, `.github/workflows/deploy-pages.yml`로 이미 코드에 반영되어 실제 배포까지 완료되었습니다. 진행 상황은 [TASK.md](../TASK.md)를 참고하세요.

---

## 목차

1. [일반 사용자를 위한 배포 방법](#1-일반-사용자를-위한-배포-방법)
2. [내 파일로 백업/복원](#2-내-파일로-백업복원)
3. [로컬 동기화 폴더에 저장](#3-로컬-동기화-폴더에-저장)
4. [메일 등으로 공유하기](#4-메일-등으로-공유하기)

---

## 1. 일반 사용자를 위한 배포 방법

`web/` 디렉터리는 빌드 과정이 없는 순수 정적 파일이므로 무료 정적 사이트 호스팅에 그대로 올릴 수 있습니다. 현재 이 저장소는 **GitHub Pages**로 배포되어 있습니다.

> ⚠️ **필수 조건**: [GPS·마이크 권한은 HTTPS(보안 컨텍스트)에서만 동작](usage.md#스마트폰에서-접속하기-https-필수)합니다. GitHub Pages는 커스텀 도메인에도 자동으로 무료 SSL 인증서를 발급하므로 이 조건을 만족합니다.

### 실제 배포 주소

```
https://JaminJeong.github.io/imgangr/
```

### 동작 방식

`.github/workflows/deploy-pages.yml`이 `main` 브랜치의 `web/**` 변경을 감지해 자동으로 GitHub Pages에 배포합니다. 저장소 **Settings → Pages → Source**가 "GitHub Actions"로 지정되어 있어야 하며(1회만 설정하면 됨), 이후로는 `web/` 아래 파일을 커밋·푸시할 때마다 자동 재배포됩니다.

```yaml
# .github/workflows/deploy-pages.yml (요약)
on:
  push:
    branches: [main]
    paths: ['web/**']
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: web }
      - uses: actions/deploy-pages@v4
```

> 💡 자체 서버(Docker)와 정적 호스팅(Pages)은 배타적이지 않습니다. 사내/개인 서버는 [backend.md](backend.md)의 Docker 방식을, 불특정 다수 사용자 대상 공개 배포는 GitHub Pages를 병행할 수 있습니다.

---

## 2. 내 파일로 백업/복원

설정(⚙️) 모달의 **"파일로 저장"** 버튼을 누르면 [데이터 모델](data-model.md)의 모든 `Session`·`Marker`를 JSON 파일 하나로 내려받습니다. 계정이나 인터넷 연결이 전혀 필요 없습니다.

```javascript
// web/js/backup.js
async exportToDownload() {
  const blob = await this._buildBackupBlob(); // { version, exportedAt, sessions, markers }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `imgangr-backup-${날짜}.json`;
  a.click();
}
```

기기를 바꾸거나 브라우저 데이터가 초기화된 뒤에는 같은 모달의 **"파일에서 복원"**으로 그 파일을 선택하면 `Storage.saveSession()` / `Storage.saveMarker()`를 통해 로컬 IndexedDB에 다시 채워 넣습니다. 기존 기록과는 `id` 기준으로 병합되며, 같은 `id`가 있으면 덮어씁니다.

---

## 3. 로컬 동기화 폴더에 저장

Chrome/Edge/Opera 데스크톱에서는 **File System Access API**로 사용자가 지정한 로컬 폴더에 백업 파일을 바로 저장할 수 있습니다. 그 폴더로 **PC에 설치된 구글 드라이브/Dropbox/OneDrive 데스크톱 동기화 폴더**를 지정하면, 그 서비스의 로그인 연동 없이도 결과적으로 클라우드에 백업되는 효과를 낼 수 있습니다.

```javascript
async exportToLocalFolder() {
  const dirHandle = await window.showDirectoryPicker(); // 사용자가 동기화 폴더 선택
  const fileHandle = await dirHandle.getFileHandle('imgangr-backup-....json', { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}
```

> ⚠️ **브라우저 지원 한계**: Firefox와 Safari는 로컬 디스크 선택 기능을 지원하지 않습니다. 이 방식은 **Chromium 계열 데스크톱 브라우저 전용**이며, 앱은 `window.showDirectoryPicker`가 없는 브라우저에서는 이 버튼 자체를 숨깁니다(`Backup.isFileSystemAccessSupported()`).

---

## 4. 메일 등으로 공유하기

설정 모달의 **"공유하기 (메일 등)"** 버튼은 **Web Share API**(`navigator.share`)로 백업 파일을 OS 공유 시트에 전달합니다. 사용자가 그 시트에서 메일 앱을 고르면, 파일이 첨부된 새 메일 작성 화면이 바로 열립니다.

```javascript
async shareBackup() {
  const file = new File([blob], 'imgangr-backup-....json', { type: 'application/json' });
  await navigator.share({
    files: [file],
    title: '임장기록 백업',
    text: '임장기록 백업 파일입니다. 설정 > 파일에서 복원으로 복원할 수 있습니다.',
  });
}
```

### 왜 `mailto:`가 아니라 Web Share API인가

`mailto:` 링크는 제목과 본문 텍스트만 채울 수 있고, 보안상의 이유로 **파일을 자동으로 첨부할 수 없습니다.** 반면 Web Share Level 2(`navigator.canShare({ files })`)는 파일을 OS 공유 시트로 직접 넘길 수 있어, 사용자가 메일·메시지·클라우드 앱 중 원하는 곳으로 한 번에 보낼 수 있습니다.

### 지원 범위와 대체 동작

- **지원**: iOS Safari, Android Chrome 등 대부분의 모바일 브라우저
- **미지원**: 일부 데스크톱 브라우저 — 이 경우 앱이 자동으로 버튼을 숨기고 "파일로 저장 후 메일에 직접 첨부해달라"는 안내 문구를 보여줍니다(`Backup.isShareSupported()`로 사전 감지)
- 외부 이메일 발송 서비스(EmailJS 등)를 연동해 "자동으로 이메일 전송"까지 구현하는 방법도 있지만, 이는 별도의 제3자 서비스 계정과 API 키 발급이 필요해 현재 범위에서는 채택하지 않았습니다.

---

## 관련 문서

- [백엔드 & 인프라 기술 명세서](backend.md) — 현재 Docker 서빙 구조 및 로컬 우선 설계 원칙
- [데이터 모델 명세서](data-model.md) — 백업/복원 대상이 되는 Session·Marker 스키마
- [사용법 가이드](usage.md) — HTTPS가 필요한 이유와 로컬 실행 방법
