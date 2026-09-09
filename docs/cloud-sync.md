# 배포 및 구글 계정 클라우드 동기화 가이드 (Deployment & Google Cloud Sync)

본 문서는 **임장기록(Imgangr)**을 일반 사용자가 접속할 수 있도록 배포하는 방법과, 구글 계정 로그인 및 구글 드라이브를 활용한 사용자 데이터 저장 방안(및 그 대안)을 다룹니다. 현재 v1.0은 [백엔드 서버가 없는 정적 웹 앱](backend.md)이므로, 여기서 다루는 로그인·클라우드 저장 기능은 모두 **브라우저에서 직접 호출하는 클라이언트 전용(client-only) 구현**을 전제로 합니다.

> 📌 **구현 현황**: 아래 내용은 `web/js/config.js`(설정), `web/js/cloudSync.js`(로그인·드라이브·대체 백업), `web/index.html`의 설정 모달, `.github/workflows/deploy-pages.yml`로 이미 코드에 반영되어 있습니다. 실제로 동작시키기 위해 남은 수동 설정(Google Cloud Console 클라이언트 ID 발급, GitHub Pages 활성화 등)은 [TASK.md](../TASK.md)에 체크리스트로 정리되어 있습니다.

---

## 목차

1. [일반 사용자를 위한 배포 방법](#1-일반-사용자를-위한-배포-방법)
2. [구글 계정으로 로그인하기](#2-구글-계정으로-로그인하기)
3. [구글 드라이브를 이용한 사용자 데이터 저장](#3-구글-드라이브를-이용한-사용자-데이터-저장)
4. [구글 드라이브를 사용할 수 없을 때의 대안](#4-구글-드라이브를-사용할-수-없을-때의-대안)

---

## 1. 일반 사용자를 위한 배포 방법

현재 [Docker Compose 자체 호스팅](backend.md)은 개발자 본인이 서버를 운영할 때는 적합하지만, 일반 사용자에게 "링크 하나로" 서비스를 제공하려면 **무료 정적 사이트 호스팅**에 올리는 편이 훨씬 간단합니다. `web/` 디렉터리는 빌드 과정이 없는 순수 정적 파일이므로 아래 플랫폼 어디에든 그대로 배포할 수 있습니다.

> ⚠️ **필수 조건**: [GPS·마이크 권한은 HTTPS(보안 컨텍스트)에서만 동작](usage.md#스마트폰에서-접속하기-https-필수)합니다. 아래 4개 플랫폼은 모두 커스텀 도메인에도 **자동으로 무료 SSL 인증서**를 발급하므로 이 조건을 자연스럽게 만족합니다.

### 플랫폼 비교 (2026년 기준)

| 플랫폼 | 무료 제공량 | 특징 | 추천 대상 |
|--------|------------|------|----------|
| **Cloudflare Pages** | 무제한 사이트/요청/대역폭, 월 500회 빌드 | 트래픽 제한이 사실상 없음, 커스텀 도메인 최대 100개 | 방문자가 많아질 가능성이 있는 경우 |
| **GitHub Pages** | 저장소 1GB, 월 100GB 대역폭(소프트 리밋) | 이미 GitHub에 있는 저장소라면 설정이 가장 단순 | 가장 간단하게 시작하고 싶을 때 (본 프로젝트 추천) |
| **Netlify** | 월 100GB 대역폭, 월 300분 빌드 | 드래그 앤 드롭 배포, PR별 프리뷰 배포 | 배포 UX를 중시할 때 |
| **Vercel** | 월 100GB 대역폭, 무제한 개인 배포 | PR마다 자동 프리뷰 URL 생성 | Next.js 등 프레임워크 확장을 고려할 때 |

### GitHub Pages로 배포하기 (가장 간단한 방법)

`web/` 폴더만 정적으로 서빙하면 되므로, GitHub Actions로 해당 폴더만 배포합니다.

```yaml
# .github/workflows/deploy-pages.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
    paths: ['web/**']

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web
      - uses: actions/deploy-pages@v4
```

이후 저장소 **Settings → Pages**에서 소스를 "GitHub Actions"로 지정하면 `https://<사용자명>.github.io/imgangr/`로 자동 배포되며, 커스텀 도메인을 연결하면 자동으로 HTTPS 인증서가 발급됩니다.

### Cloudflare Pages로 배포하기 (트래픽이 많을 경우)

1. Cloudflare 대시보드 → Workers & Pages → **프로젝트 만들기** → GitHub 저장소 연결
2. 빌드 설정: 빌드 명령어 없음(정적 파일), **빌드 출력 디렉터리: `web`**
3. 배포 완료 후 `*.pages.dev` 서브도메인이 즉시 발급되며, 커스텀 도메인도 무료로 연결 가능

> 💡 자체 서버(Docker)와 정적 호스팅(Pages)은 배타적이지 않습니다. 사내/개인 서버는 [backend.md](backend.md)의 Docker 방식을, 불특정 다수 사용자 대상 공개 배포는 본 절의 정적 호스팅을 사용하는 식으로 병행할 수 있습니다.

---

## 2. 구글 계정으로 로그인하기

### 2.1 반드시 최신 라이브러리를 사용해야 하는 이유

과거의 `gapi.auth2`(Google Sign-In JavaScript 라이브러리)는 **완전히 종료(discontinued)**되었습니다. 현재는 **Google Identity Services(GIS)** 라이브러리 하나로 통합되었으며, GIS는 다음 두 가지를 명확히 분리합니다:

- **ID 토큰(ID Token)**: "이 사람이 누구인지"를 증명하는 로그인/인증(Authentication) 용도
- **액세스 토큰(Access Token)**: "이 사람의 어떤 데이터에 접근 가능한지"를 나타내는 인가(Authorization) 용도 — 3절의 Drive 연동에 필요

로그인만 구현할 때는 ID 토큰만 있으면 되고, Drive 저장까지 구현하려면 액세스 토큰을 별도로 요청해야 합니다.

### 2.2 사전 준비: Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트 생성
2. **API 및 서비스 → OAuth 동의 화면**에서 앱 이름, 지원 이메일 등록
3. **사용자 인증 정보 → OAuth 클라이언트 ID 생성** (애플리케이션 유형: 웹 애플리케이션)
   - **승인된 자바스크립트 출처**에 배포 도메인 등록 (예: `https://imgangr.pages.dev`, 로컬 개발 시 `http://localhost:8080`)

### 2.3 로그인 버튼 구현 (ID 토큰)

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
<div id="g_id_onload"
     data-client_id="YOUR_CLIENT_ID.apps.googleusercontent.com"
     data-callback="handleGoogleLogin">
</div>
<div class="g_id_signin" data-type="standard"></div>
```

```javascript
function handleGoogleLogin(response) {
  // response.credential 은 서명된 JWT(ID 토큰)
  const payload = JSON.parse(atob(response.credential.split('.')[1]));
  const user = { email: payload.email, name: payload.name, picture: payload.picture };
  // 이후 State.currentUser = user 형태로 앱 상태에 반영
}
```

### 2.4 배포·운영 시 주의할 제약

| 제약 | 내용 | 대응 |
|------|------|------|
| **테스트 사용자 100명 제한** | OAuth 동의 화면이 "테스트" 상태이면 등록된 테스트 사용자 최대 100명까지만 로그인 가능 | 100명을 넘길 계획이면 "프로덕션"으로 전환 신청 필요 |
| **미인증 앱(Unverified App) 경고 화면** | `drive.file`처럼 민감하지 않은(non-sensitive) 스코프도 프로덕션 전환 전에는 사용자에게 경고 화면이 표시됨 | 개인/소규모 프로젝트는 감수하거나, 정식 서비스는 Google 인증 심사(보통 2~6주) 제출 |
| **테스트 모드 리프레시 토큰 7일 만료** | "테스트" 상태 앱은 7일마다 재로그인 필요 | 프로덕션 전환 시 해소됨 |

---

## 3. 구글 드라이브를 이용한 사용자 데이터 저장

### 3.1 전제: 서버 없이 브라우저에서 직접 호출

임장기록은 백엔드 서버가 없으므로, [OAuth 인가 코드 흐름](https://developers.google.com/identity/oauth2/web/guides/overview) 대신 **브라우저에서 액세스 토큰을 직접 발급받아 Drive REST API를 호출**하는 방식을 사용합니다. GIS의 토큰 클라이언트(Token Client)로 구현합니다.

```javascript
const tokenClient = google.accounts.oauth2.initTokenClient({
  client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  scope: 'https://www.googleapis.com/auth/drive.appdata',
  callback: (tokenResponse) => {
    // tokenResponse.access_token 을 1시간 동안 사용 가능
    syncToGoogleDrive(tokenResponse.access_token);
  },
});

function requestDriveAccess() {
  tokenClient.requestAccessToken();
}
```

### 3.2 스코프 선택: `drive.appdata` vs `drive.file`

| 스코프 | 특징 | 임장기록에 적합한 경우 |
|--------|------|----------------------|
| **`drive.appdata`** | 사용자의 일반 드라이브 화면에는 보이지 않는 숨겨진 앱 전용 폴더(`appDataFolder`)에 저장 | 사용자가 신경 쓸 필요 없는 **자동 백업**용 (임장기록의 "도시락 방식" 철학과 일치) |
| **`drive.file`** | 앱이 생성한 파일만 사용자의 일반 드라이브에 표시되어 직접 열람/공유 가능 | 사용자가 백업 파일을 직접 찾아 다른 사람과 **공유**하게 하고 싶은 경우 |

두 스코프 모두 "민감하지 않은(non-sensitive) 스코프"로 분류되어 있어 상대적으로 심사 부담이 적습니다. **자동 백업이 목적이라면 `drive.appdata`를 우선 권장**합니다.

### 3.3 세션/마커 데이터 업로드 예시

[데이터 모델](data-model.md)의 `Session`·`Marker` 객체를 하나의 JSON 스냅샷으로 묶어 앱 데이터 폴더에 저장합니다.

```javascript
async function syncToGoogleDrive(accessToken) {
  const sessions = await Storage.getSessions();
  const allMarkers = await Promise.all(sessions.map((s) => Storage.getMarkersBySession(s.id)));
  const backup = { version: 1, exportedAt: Date.now(), sessions, markers: allMarkers.flat() };

  const metadata = { name: 'imgangr-backup.json', parents: ['appDataFolder'] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify(backup)], { type: 'application/json' }));

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
}
```

두 번째 백업부터는 새 파일을 또 만들지 않도록, `files.list(spaces: 'appDataFolder')`로 기존 파일 ID를 조회한 뒤 `PATCH .../files/{fileId}?uploadType=multipart`로 덮어씁니다.

### 3.4 실무에서 반드시 고려해야 할 사항

1. **토큰 만료(1시간)**: 액세스 토큰은 짧게 유지되므로, 만료 시 `tokenClient.requestAccessToken({ prompt: '' })`로 조용히 재발급받아야 합니다(이미 동의한 사용자에게는 팝업 없이 발급됨).
2. **용량 인플레이션**: 사진·음성을 [Base64 DataURL로 저장](data-model.md)하면 원본 대비 약 33% 용량이 커집니다. 구글 계정 기본 무료 용량(Gmail·포토·드라이브 통합 15GB)을 빠르게 소진할 수 있으므로, 사진 리사이징(로드맵 F13) 없이 대량 백업하는 것은 권장하지 않습니다.
3. **appDataFolder는 사용자가 직접 지울 수 없음**: 앱 연결 해제(구글 계정 설정 → 보안 → 타사 앱 액세스) 시에만 함께 삭제됩니다. 사용자에게 이 점을 안내해야 합니다.

---

## 4. 구글 드라이브를 사용할 수 없을 때의 대안

교육기관 구글 워크스페이스 계정의 API 접근 제한, 미성년자 계정, 혹은 정책상 구글 API를 쓰지 못하는 환경 등 **구글 드라이브 연동이 불가능한 경우**를 대비한 대안입니다.

### 4.1 수동 내보내기/가져오기 (가장 간단, 즉시 적용 가능)

추가 인증이나 외부 API 없이, 로컬 IndexedDB 데이터를 JSON 파일로 저장/복원합니다. 사용자가 그 파일을 아무 클라우드(구글 드라이브 포함)나 USB에 직접 옮기는 방식입니다.

```javascript
async function exportBackup() {
  const sessions = await Storage.getSessions();
  const allMarkers = await Promise.all(sessions.map((s) => Storage.getMarkersBySession(s.id)));
  const backup = { version: 1, sessions, markers: allMarkers.flat() };

  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `imgangr-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}
```

가져오기는 `<input type="file" accept="application/json">`으로 파일을 선택받아 `Storage.saveSession()` / `Storage.saveMarker()`로 복원하면 됩니다.

### 4.2 File System Access API (브라우저가 지원하는 로컬 폴더에 자동 저장)

Chrome/Edge/Opera 데스크톱에서는 사용자가 지정한 로컬 폴더에 앱이 직접 파일을 읽고 쓸 수 있습니다. 그 폴더로 **사용자 PC의 구글 드라이브 데스크톱 동기화 폴더나 Dropbox 폴더**를 지정하면, Drive API 없이도 사실상 클라우드 백업 효과를 낼 수 있습니다.

```javascript
const dirHandle = await window.showDirectoryPicker(); // 사용자가 동기화 폴더 선택
const fileHandle = await dirHandle.getFileHandle('imgangr-backup.json', { create: true });
const writable = await fileHandle.createWritable();
await writable.write(JSON.stringify(backup));
await writable.close();
```

> ⚠️ **브라우저 지원 한계**: Firefox와 Safari는 로컬 디스크 선택 기능을 지원하지 않고 격리된 저장 공간(Origin Private File System)만 제공합니다. 즉, 이 방식은 **Chromium 계열 데스크톱 브라우저 전용**입니다. [`browser-fs-access`](https://github.com/GoogleChromeLabs/browser-fs-access) 같은 라이브러리를 쓰면 미지원 브라우저에서 4.1의 다운로드/업로드 방식으로 자동 폴백시킬 수 있습니다.

### 4.3 다른 클라우드 스토리지 API로 대체

동일한 패턴(OAuth 액세스 토큰 + REST 업로드)을 다른 제공자로 그대로 옮길 수 있습니다.

| 제공자 | API | 비고 |
|--------|-----|------|
| Dropbox | Dropbox API v2 | 앱 전용 폴더(`App folder`) 개념이 Drive의 `appDataFolder`와 유사 |
| Microsoft OneDrive | Microsoft Graph API | 학교·회사에서 구글 대신 Microsoft 365 계정을 쓰는 경우에 적합 |
| Nextcloud (자체 호스팅) | WebDAV | 조직이 이미 자체 클라우드를 운영 중이라면 완전한 데이터 주권 확보 가능 |

### 4.4 BaaS(Backend-as-a-Service)로 전환

"내 계정 → 내 클라우드 저장"이 아니라 **서비스 차원의 계정/DB 시스템**이 필요해지면(예: 여러 기기 동기화, 배우자와 실시간 공유), [backend.md의 자체 백엔드 로드맵](backend.md#4-차세대-백엔드-아키텍처-로드맵-v20-설계)처럼 PostgreSQL을 직접 구축하는 대신 관리형 서비스를 쓰는 편이 초기 개발 부담이 적습니다.

| | Firebase | Supabase |
|---|----------|----------|
| 데이터베이스 | Firestore (NoSQL) | PostgreSQL (관계형, PostGIS로 [기존 로드맵](backend.md)의 공간 쿼리 요구사항과 직접 호환) |
| 무료 티어 | Firestore 1GB, 스토리지 5GB, 일 20,000 쓰기 | DB 500MB, 스토리지 1GB, MAU 50,000 |
| 강점 | 모바일 오프라인 동기화, 구글 로그인과 통합이 가장 매끄러움 | SQL 친화적, 대규모 트래픽에서 상대적으로 저렴 |
| 임장기록에 적합한 경우 | 구글 로그인을 이미 붙였고 빠르게 실시간 동기화를 원할 때 | PostGIS 기반 공간 쿼리(경로·단지 비교)를 정식으로 구현하려 할 때 |

---

## 관련 문서

- [백엔드 & 인프라 기술 명세서](backend.md) — 현재 Docker 서빙 구조 및 자체 백엔드 로드맵
- [데이터 모델 명세서](data-model.md) — 백업/동기화 대상이 되는 Session·Marker 스키마
- [사용법 가이드](usage.md) — HTTPS가 필요한 이유와 로컬 실행 방법
- [비전공자를 위한 용어 설명서](glossary.md) — OAuth, API 등 관련 용어 설명
