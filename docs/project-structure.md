# 프로젝트 구조

```
imgangr/
├── index.html              # 진입점 - 모든 뷰와 모달 마크업
├── css/
│   └── style.css           # 전체 스타일 (모바일 퍼스트)
├── js/
│   ├── storage.js          # IndexedDB 데이터 계층
│   ├── tracker.js          # GPS 추적 및 거리 계산
│   ├── mapManager.js       # Leaflet 지도 관리
│   └── app.js              # 앱 컨트롤러 (뷰 전환, 이벤트, 비즈니스 로직)
├── docs/                   # 프로젝트 문서
│   ├── project-structure.md
│   ├── architecture.md
│   ├── usage.md
│   └── data-model.md
├── .gitignore
└── README.md
```

## 파일별 역할

### `index.html`

SPA(Single Page Application) 구조로 모든 화면을 하나의 HTML 파일에 정의합니다.

| ID | 역할 |
|----|------|
| `#view-home` | 홈 대시보드 (통계 + 최근 기록) |
| `#view-track` | 임장 진행 화면 (지도 + 컨트롤) |
| `#view-records` | 전체 임장 기록 목록 |
| `#view-detail` | 임장 상세 (지도 재현 + 타임라인) |
| `#modal-new-session` | 새 임장 시작 모달 |
| `#modal-end-session` | 임장 완료 + 별점/메모 입력 모달 |
| `#modal-marker` | 현장 기록 추가 모달 (5개 탭) |
| `#modal-marker-popup` | 마커 상세 팝업 |

### `css/style.css`

CSS 커스텀 프로퍼티(변수)로 디자인 토큰을 관리합니다.
모바일 우선(Mobile-first)으로 작성되었으며, `@media (min-width: 480px)`에서 데스크탑 레이아웃을 보완합니다.

### `js/storage.js`

IndexedDB를 Promise 기반으로 추상화한 데이터 계층입니다.
두 개의 Object Store를 관리합니다.

- `sessions` — 임장 세션 (경로 포함)
- `markers` — 개별 현장 기록 (세션 ID로 연결)

### `js/tracker.js`

`navigator.geolocation.watchPosition`으로 연속 위치를 수집합니다.

- 노이즈 필터: 정확도 50 m 초과 데이터 제거
- 이동 필터: 3 m 미만 이동 무시 (정지 시 불필요한 포인트 방지)
- Haversine 공식으로 두 좌표 간 거리(m) 계산

### `js/mapManager.js`

Leaflet.js 지도 인스턴스를 관리합니다.

- `initTrackMap` — 추적용 지도 초기화 (실시간 경로 갱신)
- `initDetailMap` — 상세 뷰용 지도 초기화 (전체 경로 + 마커 일괄 렌더)
- `updateTrackPosition` — 사용자 위치 마커 이동 + 폴리라인 연장
- `addTrackMarker` / `removeTrackMarker` — 마커 추가·제거

### `js/app.js`

뷰 전환, 모달 제어, 사용자 이벤트, 비즈니스 로직 전체를 담당합니다.

```
State (전역 상태)
  ├── activeSession     현재 진행 중인 세션 객체
  ├── trackingActive    추적 활성 여부
  ├── trackingPaused    일시정지 여부
  ├── pendingMarkerLatLng  마커 추가 시 좌표
  └── currentDetailMarkers 상세 뷰의 마커 목록
```
