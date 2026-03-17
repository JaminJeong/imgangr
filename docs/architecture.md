# 아키텍처

## 전체 구성

```
┌─────────────────────────────────────────┐
│              브라우저 (PWA)              │
│                                         │
│  ┌──────────┐   ┌──────────────────┐   │
│  │ index.html│   │   CSS / JS 모듈  │   │
│  │  (뷰/모달)│◄──│  (빌드 없음,    │   │
│  └──────────┘   │   CDN Leaflet)   │   │
│                 └──────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │          app.js (컨트롤러)       │   │
│  │  showView() / bindEvents()      │   │
│  │  세션·마커 CRUD 로직             │   │
│  └──────┬──────────┬──────────┬───┘   │
│         │          │          │         │
│  ┌──────▼──┐ ┌────▼────┐ ┌──▼──────┐  │
│  │storage.js│ │tracker.js│ │mapMgr.js│  │
│  │IndexedDB │ │Geoloc.  │ │Leaflet  │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      브라우저 내장 API           │   │
│  │  IndexedDB · Geolocation        │   │
│  │  MediaDevices · FileReader      │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘

외부 의존: Leaflet.js (CDN) + OpenStreetMap 타일
```

## 레이어 구조

| 레이어 | 파일 | 책임 |
|--------|------|------|
| 뷰 (View) | `index.html` + `style.css` | 마크업, 스타일, DOM 구조 |
| 컨트롤러 (Controller) | `app.js` | 뷰 전환, 이벤트 바인딩, 비즈니스 로직 |
| 서비스 (Service) | `tracker.js`, `mapManager.js` | GPS 처리, 지도 렌더링 |
| 데이터 (Data) | `storage.js` | IndexedDB CRUD |

## 뷰 전환 방식

```
hash-less SPA: CSS display 토글 방식
  .view            → display: none
  .view.active     → display: block (또는 flex)

showView('home')   → #view-home.active 추가,
                     나머지 .view에서 .active 제거
```

하단 네비게이션(`#bottom-nav`)은 `track` / `detail` 뷰에서 자동으로 숨겨집니다.

## 데이터 흐름

### 임장 기록 시작

```
사용자 입력 (지역명 — 구)
  → startSession()
    → Tracker.getCurrentPosition()  [초기 위치 확보]
    → MapManager.initTrackMap()     [지도 초기화]
    → Tracker.start(callback)       [watchPosition 시작]
      → GPS 포인트 수신
        → 노이즈 필터링
        → State.activeSession.route 갱신
        → MapManager.updateTrackPosition()  [UI 갱신]
        → Storage.saveSession()             [로컬 저장]
```

### 마커 저장

```
사용자 탭 선택 + 데이터 입력
  → saveMarker()
    → 현재 GPS 좌표 첨부
    → Storage.saveMarker(marker)
    → MapManager.addTrackMarker()   [지도에 아이콘 추가]
    → State.activeSession.markerCount++
    → Storage.saveSession()         [세션 카운트 업데이트]
```

### 임장 완료

```
endSession()
  → Tracker.stop()                  [watchPosition 해제]
  → stopTimer()
  → 별점 + 메모 수집
  → Storage.saveSession(완성된 세션)
  → showView('home') + openDetailView()
```

## 오프라인 전략

모든 데이터는 `IndexedDB`에 즉시 저장되며 서버 동기화가 없습니다.
GPS 신호 소실 시에도 기존 수집된 경로는 유지됩니다.
Leaflet 타일 캐시는 브라우저 Service Worker 없이도 기본적으로 일부 캐싱됩니다.

## 미디어 처리

| 미디어 타입 | 처리 방식 | 저장 형태 |
|------------|----------|----------|
| 사진 | `FileReader.readAsDataURL()` | Base64 DataURL → IndexedDB |
| 음성 | `MediaRecorder` → `Blob` → `FileReader` | Base64 DataURL → IndexedDB |

> **주의**: 고화질 사진을 많이 첨부하면 IndexedDB 용량 한도에 근접할 수 있습니다.
> 브라우저별 한도는 통상 디스크 여유 공간의 60% 수준입니다.

## 지도 라이브러리

- **Leaflet.js 1.9.4** (CDN, MIT 라이선스)
- **타일**: OpenStreetMap (무료, 상업적 이용 가능, 귀속 표시 필요)
- 지도 컨테이너는 뷰 전환 시 `invalidateSize()`로 크기를 재계산합니다.
