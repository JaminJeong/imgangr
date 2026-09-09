# 프론트엔드 기술 명세서 (Frontend Specification)

본 문서는 **임장기록(Imgangr)** 웹 애플리케이션의 프론트엔드 아키텍처, 핵심 기술 스택, Web API 활용법, 모듈 구조 및 최적화 전략을 상세히 기술합니다.

---

## 1. 프론트엔드 개요 및 설계 철학

### 1.1 설계 철학
- **빌드리스(No-Build) & 의존성 최소화**: 복잡한 번들러(Webpack, Vite 등)나 무거운 프레임워크(React, Vue 등) 없이 표준 웹 기술(HTML5, CSS3, Vanilla ES6+ JS)만으로 구동되어, 환경 제약 없이 언제 어디서나 가볍고 빠르게 배포 및 유지보수가 가능합니다.
- **오프라인 우선(Offline-First)**: 네트워크 연결이 불안정한 현장(지하, 신축 공사현장, 음영 지역)에서도 끊김 없이 위치를 추적하고 데이터를 기록할 수 있도록 모든 데이터를 클라이언트 브라우저 로컬 스토리지(IndexedDB)에 우선 영속화합니다.
- **모바일 퍼스트(Mobile-First) 현장 특화 UI**: 한 손으로 이동하면서도 조작이 용이하도록 하단 네비게이션, 바텀시트 모달, 큼직한 터치 타깃, 직관적인 제스처 및 즉각적인 인터랙션을 제공합니다.

---

## 2. 기술 스택 (Tech Stack)

| 구분 | 기술 / 라이브러리 | 버전 / 출처 | 도입 목적 |
|------|------------------|------------|-----------|
| **코어 언어** | HTML5, CSS3, JavaScript | ES2020+ (Vanilla) | 표준 웹 플랫폼 지원, 무빌드 가벼운 런타임 |
| **지도 엔진** | Leaflet.js | v1.9.4 (CDN) | 오픈소스 경량 웹 지도 렌더링, 모바일 터치 최적화 |
| **지도 타일** | OpenStreetMap (OSM) | Standard Tile Layer | 무료 오픈소스 지도 타일 서빙 |
| **로컬 데이터베이스**| IndexedDB API | Browser Native | 대용량 세션 경로, 마커 데이터, 미디어 Base64 저장 |
| **위치 추적** | Geolocation API | Browser Native | 실시간 GPS 이동 경로 트래킹 |
| **미디어 레코딩** | MediaDevices & MediaRecorder API | Browser Native | 현장 음성 녹음 (audio/webm) |
| **파일 입출력** | File & FileReader API | Browser Native | 현장 사진 업로드 및 DataURL 인코딩 |

---

## 3. 핵심 Web API 활용 상세

### 3.1 Geolocation API (`navigator.geolocation`)
현장 이동 동선을 실시간으로 수집하고 거리와 시간을 계산하는 핵심 엔진입니다.

- **`watchPosition(successCallback, errorCallback, options)`**:
  - `enableHighAccuracy: true`: GPS 센서를 활성화하여 최상의 위치 정확도를 확보합니다.
  - `maximumAge: 3000`: 최근 3초 이내에 캐시된 위치 정보를 허용하여 배터리 소모를 최적화합니다.
  - `timeout: 10000`: 10초 이내에 응답이 없을 경우 타임아웃 오류를 처리합니다.
- **노이즈 필터링 알고리즘**:
  - **정확도 필터**: `coords.accuracy > 50`인 경우(오차 50m 초과 수신값) 빌딩 숲 등에서의 GPS 튐 현상으로 간주하여 경로에서 제외합니다.
  - **최소 이동 거리 필터 (3m)**: 정지해 있을 때 미세한 GPS 오차로 인해 이동 거리가 누적되는 문제를 방지하기 위해 직전 좌표와의 거리가 3m 미만인 경우 기록하지 않습니다.
- **Haversine 공식 (거리 계산)**:
  - 구면 좌표계(위도/경도) 상에서 대원거리(Great-Circle Distance)를 구하는 공식을 구현하여 세션 이동 거리를 미터(m) 단위로 정확히 누적합니다.

$$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lng}}{2}\right)}\right)$$

### 3.2 IndexedDB API (`Storage`)
서버 통신 없이 브라우저 내부에 구조화된 트랜잭션 데이터를 안전하게 보관합니다.

- **데이터베이스 사양**:
  - DB Name: `imgangr_db`, Version: `1`
  - Object Stores:
    - `sessions`: 기본키 `id`, 인덱스 `date` (임장 세션 메타데이터 및 전체 경로 Point 배열 보관)
    - `markers`: 기본키 `id`, 인덱스 `sessionId` (각 세션에 종속된 5종의 현장 마커 데이터 보관)
- **트랜잭션 및 비동기 처리**:
  - `Promise` 래퍼 패턴을 적용하여 비동기 `IDBRequest` 콜백을 모던 async/await 구문으로 편리하게 제어합니다.
  - **세션 삭제 시 캐스케이딩(Cascading) 처리**: `IDBKeyRange.only(id)` 기반 인덱스 커서를 열어 세션에 속한 모든 마커를 트랜잭션 내에서 일괄 삭제합니다.

### 3.3 MediaDevices & MediaRecorder API
현장의 분위기, 소음, 실시간 생각을 음성으로 신속하게 남기기 위한 오디오 인터페이스입니다.

- **마이크 권한 획득**: `navigator.mediaDevices.getUserMedia({ audio: true })`
- **스트림 인코딩**: `mimeType`을 지정하지 않고 브라우저 기본 지원 코덱으로 청크를 수집합니다. iOS Safari는 14.5부터 `MediaRecorder`를 지원하지만, 18.4(2025-03) 이전 버전은 `audio/webm`을 생성하지 못하고 MP4/AAC 컨테이너만 지원하므로 재생 호환성이 필요하면 `MediaRecorder.isTypeSupported()`로 사전 분기하는 것이 안전합니다.
- **DataURL 변환**: 녹음 완료 후 `Blob` 데이터를 `FileReader.readAsDataURL()`을 통해 Base64 문자열로 인코딩하여 IndexedDB에 영구 보관합니다.

### 3.4 File & FileReader API
사진 촬영 및 갤러리 업로드를 처리합니다.

- `<input type="file" accept="image/*" capture="environment">`: 모바일 환경에서 후면 카메라 즉시 구동 및 갤러리 선택을 지원합니다.
- `FileReader.readAsDataURL()`을 통해 이미지 파일을 Base64 문자열로 변환하고 프리뷰와 함께 저장합니다.

---

## 4. 프론트엔드 아키텍처 및 모듈 구조

```
web/
├── index.html          # 진입점 (단일 페이지 뷰 및 모달 템플릿 마크업)
├── css/
│   └── style.css       # 디자인 토큰, 레이아웃, 모달/바텀시트, 지도 커스텀 스타일
└── js/
    ├── config.js       # 배포 환경 설정값 (GOOGLE_CLIENT_ID 등)
    ├── storage.js      # [Data Layer] IndexedDB Promise 래퍼 인터페이스
    ├── tracker.js      # [Service Layer] GPS 트래커, 필터링, Haversine 거리 계산
    ├── mapManager.js   # [Service Layer] Leaflet.js 지도 인스턴스 라이프사이클 관리
    ├── cloudSync.js    # [Service Layer] 구글 로그인/드라이브 백업, 로컬 백업 대체 수단
    └── app.js          # [Controller Layer] 전역 상태, 라우팅, UI 렌더링, 이벤트 바인딩
```

### 4.1 모듈별 책임과 인터페이스

#### 1) `storage.js` (`Storage` 객체)
- **책임**: IndexedDB 연결 수립, 스키마 마이그레이션, CRUD 트랜잭션 보장
- **주요 메서드**:
  - `init()`: DB 오픈 및 오브젝트 스토어/인덱스 생성
  - `saveSession(session)`, `getSessions()`, `getSession(id)`, `deleteSession(id)`
  - `saveMarker(marker)`, `getMarkersBySession(sessionId)`, `deleteMarker(id)`

#### 2) `tracker.js` (`Tracker` 객체)
- **책임**: Geolocation API 관리, 좌표 필터링, 거리/시간 포맷팅
- **주요 메서드**:
  - `start(onPositionUpdate, onError)`: 연속 위치 추적 개시
  - `stop()`, `pause()`, `resume(onPositionUpdate, onError)`: 추적 라이프사이클 제어
  - `haversine(lat1, lng1, lat2, lng2)`: 두 지점 간 거리 계산
  - `calcTotalDistance(route)`: 전체 경로 포인트 배열 누적 거리 계산
  - `formatDistance(meters)`, `formatDuration(ms)`: 사람 친화적 텍스트 변환

#### 3) `mapManager.js` (`MapManager` 객체)
- **책임**: Leaflet 지도 인스턴스 생성, 마커 렌더링, 폴리라인 갱신
- **주요 메서드**:
  - `initTrackMap(containerId, center)`: 실시간 추적용 지도 생성 및 OpenStreetMap 타일 세팅
  - `updateTrackPosition(point, route)`: 사용자 현재 위치 마커 이동, 실시간 폴리라인 연장, 뷰 이동(`panTo`)
  - `addTrackMarker(marker, onClick)`, `removeTrackMarker(markerId)`: 현장 마커 아이콘 생성 및 지도 추가
  - `initDetailMap(containerId, session, markers, onMarkerClick)`: 완료된 세션 지도 렌더링, 시작(S)/종료(E) 마커, 경로 바운드 피팅(`fitBounds`)
  - `invalidateTrackMap()`: 컨테이너 크기 재계산 (뷰 전환 시 타일 깨짐 방지)

#### 4) `app.js` (`State` & UI 컨트롤러)
- **책임**: 전역 상태 관리, 뷰 라우팅, 폼 유효성 검사, 모달 제어, DOM 렌더링
- **전역 상태 (`State`)**:
  ```javascript
  const State = {
    currentView: 'home',           // 현재 활성 뷰 ('home' | 'track' | 'records' | 'detail')
    activeSession: null,          // 현재 진행 중인 세션 데이터
    trackingActive: false,        // 트래킹 동작 여부
    trackingPaused: false,        // 일시정지 여부
    sessionStartTime: null,       // 세션 시작 타임스탬프
    timerInterval: null,          // 경과 시간 타이머 인터벌
    pendingMarkerLatLng: null,    // 모달을 띄운 시점의 캡처 좌표
    currentDetailSession: null,   // 상세 뷰 대상 세션
    currentDetailMarkers: [],     // 상세 뷰 대상 마커 목록
    mediaRecorder: null,          // 오디오 레코더 인스턴스
    audioChunks: [],              // 오디오 데이터 청크
    isRecordingAudio: false,      // 녹음 진행 여부
  };
  ```

---

## 5. UI / UX 설계 및 구현

### 5.1 무해시(Hash-less) SPA 뷰 전환 메커니즘
브라우저의 URL 해시나 페이지 새로고침 없이 CSS 클래스 토글만으로 뷰를 전환합니다.
- `.view`: 기본적으로 `display: none`
- `.view.active`: `display: block` 또는 `flex`
- 네비게이션 동기화: 하단 바텀 네비게이션(`#bottom-nav`)은 지도 중심 집중 모드인 `track`(추적 중) 및 `detail`(상세보기) 화면에서는 자동으로 숨겨집니다.

### 5.2 반응형 및 모바일 인터랙션 최적화
- **SafeArea 대응**: 모바일 노치 및 홈 바를 고려한 뷰포트 패딩과 최대 너비(`480px`) 모바일 레이아웃 제약.
- **바텀시트 모달 (Bottom Sheet Modal)**:
  - 현장에서 한 손으로 쉽게 여닫을 수 있도록 하단에서 슬라이드 업되는 바텀시트 UI 적용 (`.modal-sheet`).
  - 드래그 핸들 디자인(`.modal-handle`)과 스크롤 영역 격리.
- **토스트 알림 (Toast System)**: 비동기 작업 결과나 사용자 경고를 상단 오버레이 토스트 형태로 노출 (`showToast(msg, type)`).

### 5.3 5가지 현장 마커 탭 인터페이스
1. **📝 메모 (`note`)**: 텍스트 빠른 입력
2. **📸 사진 (`photo`)**: 다중 이미지 파일 프리뷰 및 DataURL 변환
3. **🏠 매물 (`apt`)**: 단지명, 동, 층, 평형, 매매가, 전세가, 방향, 특이사항 입력 폼
4. **⭐ 평가 (`rate`)**: 교통, 학군, 편의시설, 소음, 주차, 일조량, 조망 7대 항목 5점 척도 슬라이더
5. **🎙️ 음성 (`voice`)**: 원터치 녹음 시작/중지 및 녹음 시간 카운터, 오디오 재생 프리뷰

---

## 6. 성능 및 브라우저 호환성

### 6.1 성능 최적화 기법
1. **지도 컨테이너 레이아웃 재계산 (`invalidateSize`)**:
   - CSS `display: none` 상태였던 지도가 활성화될 때 타일 깨짐 현상을 방지하기 위해 `MapManager.invalidateTrackMap()`을 100~200ms 지연 호출하여 올바른 픽셀 크기를 인식하도록 처리.
2. **GPS 포인트 쓰로틀링 & 배터리 절약**:
   - `maximumAge` 옵션과 3m 이동 필터를 적용하여 불필요한 위치 수신 및 DOM 리페인팅을 차단.
3. **HTML 이스케이프 (`escapeHtml`)**:
   - 사용자 입력 텍스트(메모, 단지명, 특이사항 등)를 innerHTML에 바인딩할 때 XSS(Cross-Site Scripting) 취약점을 완벽 차단.

### 6.2 브라우저 호환성 및 보안 컨텍스트
- **보안 컨텍스트(HTTPS) 필수**:
  - `navigator.geolocation` 및 `navigator.mediaDevices.getUserMedia`는 W3C 보안 규격에 따라 **HTTPS** 또는 **localhost** 환경에서만 권한 팝업이 허용됩니다.
  - 사설 IP(예: `http://192.168.x.x:8080`)로 모바일에서 접속할 경우 브라우저 보안 정책상 위치와 마이크가 동작하지 않으므로, 개발/테스트 시 ngrok 또는 로컬 HTTPS 인증서 구성이 필요합니다.
