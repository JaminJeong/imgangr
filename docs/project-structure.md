# 프로젝트 구조 (Project Structure)

본 문서는 **임장기록 (Imgangr)** 저장소의 전체 디렉토리 및 파일 구성, 각 구성 요소의 역할과 책임을 기술합니다.

---

## 1. 전체 디렉토리 트리

```
imgangr/
├── docker/                     # Docker Compose 실행 환경
│   └── docker-compose.yml      # 웹 앱 컨테이너 서비스 정의 (포트, 헬스체크, 재시작)
│
├── web/                        # 웹 클라이언트 및 Nginx 정적 서빙
│   ├── index.html              # 단일 페이지 애플리케이션(SPA) 진입점 마크업
│   ├── Dockerfile              # 경량 Nginx 기반 컨테이너 빌드 정의
│   ├── nginx.conf              # Nginx 웹 서버 설정 (Gzip, 캐싱, SPA 라우팅)
│   ├── css/
│   │   └── style.css           # 모바일 퍼스트 반응형 스타일 & 디자인 시스템 토큰
│   └── js/
│       ├── storage.js          # IndexedDB 로컬 영속화 계층
│       ├── tracker.js          # Geolocation 기반 GPS 추적 및 거리 계산
│       ├── mapManager.js       # Leaflet.js 지도 엔진 인스턴스 관리
│       └── app.js              # 전역 상태, 뷰 전환, UI 이벤트 컨트롤러
│
├── docs/                       # 프로젝트 기술 및 기획 문서
│   ├── service-plan.md         # 서비스 기획서 및 로드맵
│   ├── usage.md                # 실행 및 사용법 가이드
│   ├── architecture.md         # 전체 시스템 아키텍처
│   ├── data-model.md           # 데이터 모델 및 스토리지 명세
│   ├── frontend.md             # 프론트엔드 기술 명세서
│   ├── backend.md              # 백엔드 & 인프라 기술 명세서
│   ├── glossary.md             # 비전공자를 위한 용어 설명서
│   └── project-structure.md    # 프로젝트 구조 (본 문서)
│
├── .gitignore                  # Git 버전 관리 제외 규칙
└── README.md                   # 프로젝트 개요 및 빠른 시작 안내
```

---

## 2. 디렉토리 및 파일별 세부 역할

### 2.1 루트 디렉토리 (`/`)
- **`README.md`**: 프로젝트 소개, 주요 기능 요약, 실행 명령어, 문서 인덱스를 제공하는 메인 안내서입니다.
- **`.gitignore`**: 빌드 산출물, 환경변수, OS 캐시 파일(`.DS_Store` 등)의 버전 관리 제외를 정의합니다.

### 2.2 Docker 디렉토리 (`docker/`)
- **`docker-compose.yml`**:
  - `web` 서비스를 컨테이너로 빌드 및 실행합니다.
  - 기본 포트 `8080` (환경변수 `${PORT}`로 가변 설정 지원)을 호스트와 매핑합니다.
  - 컨테이너 헬스체크(`wget`) 및 자동 재시작(`restart: unless-stopped`)을 보장합니다.

### 2.3 웹 애플리케이션 디렉토리 (`web/`)
순수 웹 표준 기술(HTML5, CSS3, Vanilla JavaScript)과 가벼운 Nginx 서버로 구성되어 있습니다.

| 파일 / 폴더 | 책임 및 역할 |
|------------|-------------|
| `Dockerfile` | Alpine Linux 기반 Nginx 1.27 이미지에 정적 파일을 복사하고 헬스체크를 설정하는 도커 명세 |
| `nginx.conf` | Gzip 압축, 에셋 캐시(7일), SPA 라우팅 폴백(`try_files`), 보안 파일 접근 차단 설정 |
| `index.html` | SPA 구조의 모든 뷰(홈, 추적, 기록 목록, 상세)와 바텀시트 모달을 포함하는 단일 마크업 |
| `css/style.css` | CSS Custom Properties 기반 디자인 토큰, Flex/Grid 레이아웃, 모바일 바텀시트 및 반응형 스타일 |
| `js/storage.js` | 브라우저 `IndexedDB`(`imgangr_db`)를 Promise 기반으로 래핑한 로컬 CRUD 데이터 계층 |
| `js/tracker.js` | `navigator.geolocation` 위치 수신, 50m 노이즈 필터, 3m 이동 필터, Haversine 거리 계산 |
| `js/mapManager.js` | `Leaflet.js` 기반 지도 생성, 실시간 경로 폴리라인 렌더링, 커스텀 마커 핀 제어 |
| `js/app.js` | 앱 전역 상태(`State`) 관리, 화면 전환, 녹음/사진 미디어 처리, 폼 검증, 이벤트 바인딩 |

### 2.4 문서 디렉토리 (`docs/`)

| 문서 파일 | 주요 내용 |
|----------|-----------|
| [`service-plan.md`](service-plan.md) | 서비스 기획 배경, 문제 정의, 사용자 페르소나, 핵심 가치 제안, MoSCoW 로드맵 |
| [`usage.md`](usage.md) | 로컬 및 모바일 접속 실행법, 화면별 상세 사용 매뉴얼, 권한 설정 및 팁 |
| [`architecture.md`](architecture.md) | 전체 소프트웨어 아키텍처 다이어그램, 레이어 분리 원칙, 데이터 흐름, 오프라인 전략 |
| [`data-model.md`](data-model.md) | IndexedDB 스토어 구조(Session, Marker, Point), 필드 정의 및 백엔드 스키마 매핑 |
| [`frontend.md`](frontend.md) | 프론트엔드 핵심 기술, Web API(GPS, IDB, Audio, File) 활용법, 모듈 인터페이스 |
| [`backend.md`](backend.md) | 현재의 Nginx/Docker 서빙 구조 분석, HTTPS 배포 가이드, v2 클라우드 백엔드 설계 |
| [`glossary.md`](glossary.md) | 비전공자/입문자를 위한 프론트엔드 & 백엔드 핵심 용어 설명 및 일상 비유 |
| [`project-structure.md`](project-structure.md) | 저장소 전체 파일/폴더 트리 및 구성 요소별 책임 명세 (본 문서) |
