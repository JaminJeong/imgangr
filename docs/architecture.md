# 시스템 아키텍처 (System Architecture)

본 문서는 **임장기록 (Imgangr)** 서비스의 전체 소프트웨어 구조, 계층별 설계 원칙, 데이터 흐름 및 기술적 전략을 기술합니다.

---

## 1. 전체 시스템 구성도

현재 임장기록(v1.0)은 **정적 웹 서빙 인프라**와 브라우저 내에서 자급자족 구동되는 **오프라인 우선 클라이언트(Offline-First Client)**로 구성됩니다.

```
┌────────────────────────────────────────────────────────────────────────┐
│                         호스트 / 클라우드 인프라                       │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │               Docker Container (imgangr-web)                   │   │
│   │                                                                │   │
│   │   ┌────────────────────────────────────────────────────────┐   │   │
│   │   │                   Nginx 1.27-alpine                    │   │   │
│   │   │  - 정적 에셋 서빙 (Gzip 압축, 7일 캐싱)                 │   │   │
│   │   │  - SPA 라우팅 폴백 (/index.html)                       │   │   │
│   │   │  - 헬스체크 엔드포인트 지원 (wget)                     │   │   │
│   │   └────────────────────────────────────────────────────────┘   │   │
│   └───────────────────────────────▲────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ HTTP/HTTPS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        클라이언트 브라우저 (PWA)                       │
│                                                                        │
│  ┌─────────────────────── 뷰 & 프리젠테이션 계층 ────────────────────┐ │
│  │  index.html (시맨틱 SPA 마크업) + style.css (모바일 퍼스트 토큰)  │ │
│  └────────────────────────────────▲──────────────────────────────────┘ │
│                                   │ DOM 이벤트 / 렌더링 바인딩          │
│  ┌──────────────────────── 컨트롤러 계층 ───────────────────────────┐ │
│  │  app.js                                                           │ │
│  │  - 전역 상태 관리 (State)                                         │ │
│  │  - 무해시 뷰 라우팅 (showView)                                    │ │
│  │  - 세션 / 마커 라이프사이클 오케스트레이션                        │ │
│  └───────┬────────────────────────┼─────────────────────────┬────────┘ │
│          │                        │                         │          │
│  ┌───────▼───────┐        ┌───────▼────────┐        ┌───────▼────────┐ │
│  │  storage.js   │        │   tracker.js   │        │  mapManager.js │ │
│  │  (데이터 계층)│        │  (서비스 계층) │        │  (서비스 계층) │ │
│  └───────┬───────┘        └───────┬────────┘        └───────┬────────┘ │
│          │                        │                         │          │
│  ┌───────▼────────────────────────▼─────────────────────────▼────────┐ │
│  │                         브라우저 네이티브 Web APIs                │ │
│  │  - IndexedDB (로컬 DB)          - Geolocation API (GPS 추적)     │ │
│  │  - MediaDevices / MediaRecorder - File & FileReader API           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ OSM 타일 요청 (CDN)
┌───────────────────────────────────┴────────────────────────────────────┐
│                        외부 서드파티 서비스                            │
│  - Leaflet.js (unpkg.com CDN)                                          │
│  - OpenStreetMap (OSM 타일 서버: tile.openstreetmap.org)               │
└────────────────────────────────────────────────────────────────────────┘
```

자세한 프론트엔드 및 백엔드 구현 명세는 아래 문서를 참고하세요:
- [프론트엔드 기술 명세서](frontend.md)
- [백엔드 & 인프라 기술 명세서](backend.md)
- [비전공자를 위한 용어 설명서](glossary.md)

---

## 2. 계층별 책임과 분리 (Separation of Concerns)

| 계층 (Layer) | 파일 | 주요 책임 | 의존성 |
|--------------|------|-----------|--------|
| **인프라 계층** | `docker-compose.yml`, `Dockerfile`, `nginx.conf` | 정적 파일 서빙, Gzip 압축, HTTP 캐시, SPA 폴백, 컨테이너 라이프사이클 | Docker, Nginx Alpine |
| **뷰 (View)** | `web/index.html`, `web/css/style.css` | DOM 구조 정의, 모바일 바텀시트, 모달, 반응형 UI, CSS 변수 | 순수 HTML5/CSS3 |
| **컨트롤러 (Controller)** | `web/js/app.js` | 화면 전환, 폼 검증, 비즈니스 로직, 오디오 녹음 및 사진 변환 총괄 | Storage, Tracker, MapManager, Backup |
| **서비스 (Service)** | `web/js/tracker.js`, `web/js/mapManager.js` | GPS 수신 및 노이즈 필터링, 거리/시간 계산, Leaflet 지도 렌더링 | Geolocation API, Leaflet.js |
| **서비스 (Service)** | `web/js/backup.js` | 백업 파일 조립/복원, 로컬 폴더 저장, 공유 시트 전달 | Storage, File System Access API, Web Share API |
| **데이터 (Data)** | `web/js/storage.js` | IndexedDB 트랜잭션, 세션 및 마커 CRUD, 캐스케이딩 삭제 | IndexedDB API |

---

## 3. 화면 전환 메커니즘 (Hash-less SPA)

임장기록은 URL 해시(#)나 외부 라우터 라이브러리 없이 순수 CSS 클래스 제어 방식으로 동작합니다.

```
모든 화면(.view) 기본 설정:
  .view { display: none; }
  .view.active { display: block; (또는 flex) }

동작 순서:
1. showView('track') 호출
2. 모든 .view 요소에서 .active 제거
3. #view-track 요소에 .active 부여
4. 화면 특성에 맞게 하단 네비게이션(#bottom-nav) 노출 여부 조정
   - 'home', 'records': 네비게이션 표시 (flex)
   - 'track', 'detail': 전체 화면 지도 몰입을 위해 숨김 (none)
5. Leaflet 지도 컨테이너 invalidateSize() 호출
```

---

## 4. 핵심 데이터 흐름 (Data Flow)

### 4.1 임장 시작 및 실시간 경로 추적

```
[사용자] "새 임장 시작" 모달에서 지역명(구) 입력 후 시작
   │
   ▼
[app.js] startSession()
   ├─► [tracker.js] Tracker.getCurrentPosition()  --> 초기 좌표 확보
   ├─► [storage.js] Storage.saveSession(newSession) --> IndexedDB 세션 생성
   ├─► [mapManager.js] MapManager.initTrackMap()   --> Leaflet 지도 생성
   └─► [tracker.js] Tracker.start(onUpdate, onError)
          │
          ▼ (위치 변경 시 이벤트 루프)
       navigator.geolocation.watchPosition
          │
          ▼
       노이즈 필터링 (accuracy > 50m 제외, dist < 3m 이동 제외)
          │
          ├─► [mapManager.js] updateTrackPosition() (마커 이동 & 폴리라인 연장)
          ├─► [app.js] 경과 시간 및 누적 이동 거리 헤더 UI 갱신
          └─► [storage.js] saveSession() 주기적 로컬 백업
```

### 4.2 현장 마커 등록 (메모·사진·매물·평가·음성)

```
[사용자] 지도 화면에서 "+ 기록 추가" 탭 선택 및 내용 입력
   │
   ▼
[app.js] saveMarker()
   ├─ 현재 GPS 좌표(pendingMarkerLatLng) 캡처
   ├─ 미디어 데이터(사진/음성) DataURL 인코딩
   ├─ Marker 객체 구성 (type별 특화 필드 포함)
   ├─► [storage.js] Storage.saveMarker(marker)
   ├─► [mapManager.js] MapManager.addTrackMarker(marker) (지도에 핀 생성)
   └─► 세션 마커 카운트(markerCount) 증가 및 Storage.saveSession()
```

### 4.3 임장 종료 및 복기

```
[사용자] "완료" 버튼 클릭 후 별점(0~5) 및 종합 메모 입력
   │
   ▼
[app.js] endSession()
   ├─► [tracker.js] Tracker.stop() (GPS 감시 해제)
   ├─► 최종 종료 시각(endTime) 및 총 이동 거리 계산
   ├─► [storage.js] Storage.saveSession(completedSession)
   └─► showView('home') 전환 및 상세 뷰 오픈
```

---

## 5. 오프라인 우선(Offline-First) 및 미디어 전략

### 5.1 오프라인 내구성
- 모든 핵심 비즈니스 로직과 데이터 입출력은 클라이언트 브라우저 로컬(IndexedDB)에서 완결됩니다.
- 통신이 끊어지더라도 GPS 하드웨어 센서가 작동하는 한 트래킹과 기록 저장은 정상 동작합니다.
- OpenStreetMap 타일은 브라우저 캐시 정책에 따라 기방문 영역을 오프라인에서도 일정 부분 표시할 수 있습니다.

### 5.2 미디어 저장 처리
- **사진**: `FileReader.readAsDataURL()`을 통해 JPEG/PNG 파일을 Base64 문자열로 변환하여 IndexedDB에 저장합니다.
- **음성**: `MediaRecorder` API로 캡처된 오디오 청크를 모아 `Blob` 생성 후 DataURL 형태로 영속화합니다.

### 5.3 백업/복원 (계정 없는 데이터 이동)

IndexedDB는 기기·브라우저에 종속된 저장소이므로, 기기 이전이나 브라우저 데이터 초기화에 대비해 `web/js/backup.js`가 계정 없이 데이터를 이동시키는 경로를 제공합니다.

```
[app.js] 설정(⚙️) 모달
   ├─► [backup.js] buildPayload() : Storage에서 전체 세션·마커를 조회해 JSON으로 조립
   ├─► exportToDownload()      : 파일 다운로드
   ├─► exportToLocalFolder()   : File System Access API로 로컬 폴더에 저장 (Chromium 전용)
   ├─► shareBackup()           : Web Share API로 OS 공유 시트(메일 등)에 전달
   └─► importFromFile()        : 선택한 백업 파일을 restorePayload()로 Storage에 병합
```

백업 파일의 JSON 스키마는 [데이터 모델 명세서 §6](data-model.md#6-백업-파일-포맷-json-export)에, 배포·공유 방식의 배경은 [배포 및 데이터 백업/공유 가이드](backup-and-deploy.md)에 정리되어 있습니다.

---

## 6. 향후 확장 아키텍처 (v2.0 로드맵)

향후 사용자 계정 관리, 클라우드 백업 및 타 사용자 간의 단지 비교 분석을 위해 중앙 집중형 백엔드 시스템과의 연동이 예정되어 있습니다.
자세한 스키마 및 RESTful API 명세는 [docs/backend.md](backend.md)를 참고하세요.
