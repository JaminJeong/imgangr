# 백엔드 및 인프라 기술 명세서 (Backend & Infrastructure Specification)

본 문서는 **임장기록(Imgangr)** 서비스의 현재 서빙 인프라(Docker/Nginx), 오프라인 우선 아키텍처, 그리고 향후 클라우드 동기화 및 다중 기기 연동을 위한 차세대 백엔드(v2.0) 설계 명세를 기술합니다.

---

## 1. 현재 아키텍처: 오프라인 우선 & 로컬 상태 관리

현재 임장기록(v1.0)은 별도의 중앙 집중식 백엔드 API 서버를 두지 않는 **서버리스 로컬 퍼스트(Serverless Local-First)** 아키텍처를 채택하고 있습니다.

```
┌─────────────────────────────────────────────────────────────┐
│                      사용자 브라우저                        │
│                                                             │
│   ┌──────────────────────────┐    ┌─────────────────────┐   │
│   │   SPA UI (HTML/CSS/JS)   │◄───┤ Leaflet Map Engine  │   │
│   └────────────┬─────────────┘    └─────────────────────┘   │
│                │                                            │
│   ┌────────────▼─────────────┐    ┌─────────────────────┐   │
│   │    IndexedDB Storage     │    │   Web APIs (GPS,    │   │
│   │ (sessions, markers 객체) │    │  Camera, Recorder)  │   │
│   └──────────────────────────┘    └─────────────────────┘   │
└────────────────────────▲────────────────────────────────────┘
                         │ HTTP GET (정적 에셋 최초 1회 로드)
┌────────────────────────┴────────────────────────────────────┐
│              웹 서빙 인프라 (Docker Container)              │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                 Nginx 1.27-alpine                   │   │
│   │  - Gzip 압축, 정적 에셋 캐싱, SPA 폴백 라우팅       │   │
│   │  - 도커 헬스체크 (wget ping)                         │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 아키텍처 도입 장점
1. **극도의 네트워크 신뢰성**: 임장 현장의 지하 주차장, 재개발 철거 예정 구역, 전파 음영 지역에서도 네트워크 오류로 인한 데이터 유실 위험이 전혀 없습니다.
2. **비용 및 운영 오버헤드 제로**: 데이터베이스 서버, 인증 서버, API 게이트웨이 유지 비용이 들지 않으며, 단순 정적 웹 서버만으로 전 세계 수많은 사용자에게 서비스 가능합니다.
3. **개인정보 보호**: 사용자의 이동 동선, 임장 평가, 현장 사진 등이 외부 클라우드로 전송되지 않고 본인 기기에만 머무르므로 사생활 침해 우려가 없습니다.

---

## 2. 웹 서빙 인프라 (Web Serving Infrastructure)

현재 임장기록의 정적 웹 자원은 Docker 기반의 고성능 **Nginx 1.27-alpine** 컨테이너 환경에서 서빙됩니다.

### 2.1 Nginx 설정 상세 (`web/nginx.conf`)

```nginx
server {
    listen       80;
    server_name  localhost;
    root         /usr/share/nginx/html;
    index        index.html;

    # 문자 인코딩
    charset utf-8;

    # Gzip 압축
    gzip              on;
    gzip_vary         on;
    gzip_min_length   1024;
    gzip_types        text/plain text/css application/javascript
                      application/json text/xml application/xml
                      image/svg+xml;

    # 정적 에셋 캐시 (JS/CSS/이미지)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires    7d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA 라우팅 — 모든 요청을 index.html 로 폴백
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 불필요한 파일 접근 차단
    location ~ /\.(git|env|claude) {
        deny all;
        return 404;
    }

    location = /favicon.ico {
        log_not_found off;
        access_log    off;
    }

    # 에러 페이지
    error_page 404 /index.html;
}
```

#### 주요 설정 분석:
- **전송 최적화 (Gzip)**: 1KB 이상의 텍스트, CSS, JS, JSON, SVG 파일에 대해 Gzip 압축을 적용하여 모바일 네트워크 대역폭 소모를 최소화합니다.
- **클라이언트 캐싱 정책**: 정적 에셋(`.js`, `.css`, 이미지, 폰트 등)에 대해 `7일(7d)` 만료 및 `Cache-Control: "public, immutable"`을 지정하여 반복 방문 시 즉각적인 렌더링을 지원합니다.
- **SPA 폴백 라우팅**: `try_files $uri $uri/ /index.html;` 구문을 통해 새로고침 및 하위 경로 접근 시에도 `index.html`이 정상 서빙되도록 보장합니다.
- **보안 격리**: `.git`, `.env` 등 민감한 설정 파일 패턴에 대한 접근을 원천 차단(`deny all; return 404;`)합니다.

### 2.2 Docker 컨테이너 및 Compose 구성

#### Dockerfile (`web/Dockerfile`)
```dockerfile
FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html  /usr/share/nginx/html/
COPY css/        /usr/share/nginx/html/css/
COPY js/         /usr/share/nginx/html/js/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```
- **초경량 베이스 이미지**: Alpine Linux 기반 Nginx 이미지를 사용하여 이미지 용량이 ~25MB에 불과합니다.
- **컨테이너 헬스체크**: 30초 주기로 컨테이너 내부 로컬 호스트 응답을 검증하여 이상 발생 시 오케스트레이터(Docker Swarm, Kubernetes 등)가 재기동할 수 있도록 합니다.

#### Docker Compose (`docker/docker-compose.yml`)
```yaml
services:
  web:
    build:
      context: ../web
      dockerfile: Dockerfile
    image: imgangr:latest
    container_name: imgangr-web
    ports:
      - "${PORT:-8080}:80"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
```
- 환경변수 `${PORT:-8080}`를 통해 호스트 포트를 자유롭게 지정할 수 있습니다.
- `restart: unless-stopped` 정책으로 서버 재부팅 시 자동 복구됩니다.

---

## 3. HTTPS 배포 가이드 (보안 컨텍스트)

임장기록 서비스가 사용하는 브라우저의 강력한 Web API는 W3C 표준에 의해 **보안 컨텍스트(Secure Context)**에서만 동작합니다:
- **`navigator.geolocation`** (GPS 위치 정보)
- **`navigator.mediaDevices.getUserMedia`** (음성 녹음)

로컬 개발 환경에서는 `localhost`가 보안 컨텍스트로 인정되지만, 실제 모바일 기기에서 원격 접속하려면 **반드시 HTTPS(SSL/TLS)**가 적용되어야 합니다.

### 권장 배포 패턴

```
[클라이언트 모바일] ──── HTTPS (443) ────► [역방향 프록시 (Nginx/Caddy)]
                                                    │
                                               HTTP (8080)
                                                    ▼
                                           [imgangr-web 컨테이너]
```

#### 배포 옵션 1: Let's Encrypt + Caddy (가장 단순함)
Caddy를 앞단에 두면 자동으로 SSL 인증서를 발급 및 갱신합니다.
```caddyfile
imgangr.yourdomain.com {
    reverse_proxy localhost:8080
}
```

#### 배포 옵션 2: Cloudflare Tunnel (공인 IP / 포트포워딩 불필요)
Cloudflare Zero Trust를 통해 홈 서버나 로컬 PC의 포트를 노출하지 않고 안전한 HTTPS 도메인을 연결할 수 있습니다.

---

## 4. 차세대 백엔드 아키텍처 로드맵 (v2.0 설계)

클라우드 동기화, 사용자 계정, 단지 간 비교 분석, 기기간 데이터 공유를 지원하기 위한 미래 확장 백엔드 설계안입니다.

```
┌─────────────────────────────────────────────────────────────┐
│                     클라이언트 계층                         │
│   [모바일 웹 / PWA] ── IndexedDB (로컬 캐시 & 오프라인)      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON (REST or GraphQL)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     API 게이트웨이                          │
│   - JWT / OAuth2 인증 (카카오, 구글 간편로그인)             │
│   - Rate Limiting & SSL Termination                         │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
│       Core API 서버         │ │     미디어 전처리 서버      │
│   (Go / Node.js / FastAPI)  │ │  (이미지 리사이징, 압축)    │
└──────────────┬──────────────┘ └──────────────┬──────────────┘
               │                               │
       ┌───────┴───────┐                       │
       ▼               ▼                       ▼
┌─────────────┐ ┌─────────────┐         ┌─────────────┐
│ PostgreSQL  │ │ Redis Cache │         │ S3 / R2     │
│  + PostGIS  │ │ (세션/토큰) │         │ (사진, 음성)│
└─────────────┘ └─────────────┘         └─────────────┘
```

### 4.1 핵심 백엔드 기술 스택 추천
- **API 서버 프레임워크**:
  - **Go (Gin/Fiber)** 또는 **Node.js (NestJS)**: 높은 동시성 처리, 빠른 입출력 및 가벼운 컨테이너 풋프린트
  - **Python (FastAPI)**: 데이터 분석 및 부동산 통계 파이프라인 연동에 유리
- **데이터베이스 (RDBMS + Spatial)**:
  - **PostgreSQL + PostGIS**: 임장 동선(LineString), 마커 위치(Point)에 대한 지리 공간 쿼리 및 단지 경계(Polygon) 포함 관계 연산 최적화
- **미디어 스토리지**:
  - **Cloudflare R2** 또는 **AWS S3**: 송신 비용(Egress)이 없거나 저렴한 오브젝트 스토리지 활용
  - **Presigned URL 방식**: 클라이언트가 서버를 거치지 않고 S3/R2에 직접 사진/오디오를 업로드하여 API 서버의 대역폭 부하 분산

### 4.2 데이터 동기화 전략 (Sync Protocol)
오프라인 우선 경험을 유지하면서 서버와 동기화하기 위한 2단계 전략:
1. **타임스탬프 기반 Last-Write-Wins (LWW)**:
   - 각 레코드에 `updated_at` 및 `is_deleted` 필드를 부여
   - 클라이언트는 마지막 동기화 시간(`last_synced_at`) 이후 변경된 데이터를 서버에 전송하고, 서버의 최신 데이터를 수신하여 병합
2. **미디어 업로드 파이프라인**:
   - 로컬에서는 DataURL로 즉시 표시 및 임시 저장
   - 네트워크 연결 시 백그라운드에서 Presigned URL을 요청하여 미디어를 업로드하고, 완료 후 CDN URL로 교체

### 4.3 RESTful API 명세 (초안)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/v1/auth/login` | 소셜 로그인 및 JWT 토큰 발급 |
| `GET`  | `/api/v1/sessions` | 사용자의 세션 목록 조회 (페이지네이션, 날짜/구 필터) |
| `POST` | `/api/v1/sessions` | 새 세션 생성 및 동기화 |
| `GET`  | `/api/v1/sessions/:id` | 세션 상세 (경로 좌표 포함) 조회 |
| `PUT`  | `/api/v1/sessions/:id` | 세션 수정 (평가, 메모, 종료 처리) |
| `DELETE`| `/api/v1/sessions/:id` | 세션 및 연관 마커 삭제 |
| `GET`  | `/api/v1/sessions/:id/markers` | 특정 세션의 마커 목록 조회 |
| `POST` | `/api/v1/sessions/:id/markers` | 새 마커 추가 |
| `POST` | `/api/v1/media/presigned-url` | 사진/음성 업로드용 Presigned URL 발급 |
| `GET`  | `/api/v1/analytics/compare` | 여러 단지/구 간 평가 점수 비교 데이터 조회 |

### 4.4 데이터베이스 스키마 설계 (PostgreSQL + PostGIS)

```sql
-- 임장 세션 테이블
CREATE TABLE sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL,
    region_name VARCHAR(100) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    route_geom GEOMETRY(LineString, 4326),  -- WGS84 GPS 이동 동선
    total_distance DOUBLE PRECISION DEFAULT 0,
    overall_rating INTEGER CHECK (overall_rating BETWEEN 0 AND 5),
    memo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 현장 마커 테이블
CREATE TABLE markers (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'note', 'photo', 'apt', 'rate', 'voice'
    location GEOMETRY(Point, 4326) NOT NULL, -- WGS84 포인트
    timestamp TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL, -- 타입별 상세 데이터 (사진URL, 매물정보, 7대 평가점수 등)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 공간 인덱스 생성
CREATE INDEX idx_sessions_route ON sessions USING GIST(route_geom);
CREATE INDEX idx_markers_location ON markers USING GIST(location);
```
