# 데이터 모델 명세서 (Data Model Specification)

본 문서는 **임장기록 (Imgangr)** 애플리케이션의 클라이언트 로컬 저장소(IndexedDB) 스키마와 향후 클라우드 동기화를 위한 백엔드 데이터베이스 매핑 구조를 기술합니다.

---

## 1. 클라이언트 스토리지: IndexedDB

모든 현장 데이터는 브라우저 내장 NoSQL 스토리지인 **IndexedDB** (`imgangr_db`, version 1)에 즉시 트랜잭션 단위로 영속화됩니다.

### 1.1 Object Stores 요약

| Object Store | Primary Key | Indexes | 설명 |
|--------------|-------------|---------|------|
| `sessions` | `id` (String) | `date` | 구 단위 임장 세션 마스터 및 GPS 동선 좌표 배열 |
| `markers` | `id` (String) | `sessionId` | 세션에 종속된 5종의 현장 기록 (메모/사진/매물/평가/음성) |

### 1.2 브라우저별 저장 용량(Storage Quota) 한도

사진·음성을 Base64로 저장하는 특성상 IndexedDB 용량 한도를 인지하고 있어야 합니다.

| 브라우저 | 초기 할당량 | 확장 정책 |
|----------|------------|-----------|
| Chrome / Edge | 기기 디스크 여유 공간의 최대 60% (persistent 기준) | 별도 사용자 승인 없이 자동 확장, 시크릿 모드는 약 5%로 제한 |
| Safari (macOS/iOS) | 오리진당 약 1GB | 초과 시 200MB 단위로 사용자에게 추가 승인 요청 |

> ⚠️ Safari는 최근 7일간 해당 오리진에 사용자 상호작용(클릭/탭)이 없으면 스크립트로 생성된 데이터(IndexedDB 포함)를 자동 삭제할 수 있습니다. 장기간 앱을 열지 않으면 로컬 기록이 소실될 수 있으므로, v1.1 리사이징 도입 전까지는 사용자에게 정기적 접속 또는 사진 캡션/메모 위주 기록을 안내하는 것이 안전합니다.

---

## 2. Session 엔터티 (임장 세션)

하나의 임장 세션은 특정 구(區)를 대상으로 진행된 이동 기록과 통계를 포함합니다.

```typescript
interface Session {
  id: string;             // 고유 식별자 ("session_<timestamp>", e.g. "session_1710650000000")
  regionName: string;     // 대상 구(區) 명칭 (e.g. "강남구", "마포구")
  date: string;           // 생성 일자 ("YYYY-MM-DD")
  startTime: number;      // 시작 시각 (Unix Timestamp, ms)
  endTime: number | null; // 종료 시각 (Unix Timestamp, ms, 진행 중인 경우 null)
  route: Point[];         // GPS 궤적 좌표 배열
  totalDistance: number;  // 누적 이동 거리 (단위: 미터)
  markerCount: number;    // 연결된 총 마커 수
  overallRating: number;  // 종합 별점 평가 (0 ~ 5 정수)
  memo: string;           // 최종 총평 메모
}
```

### 2.1 Point 구조체 (`route` 원소)

```typescript
interface Point {
  lat: number;            // 위도 (WGS84, e.g. 37.4979)
  lng: number;            // 경도 (WGS84, e.g. 127.0276)
  altitude: number | null;// 고도 (단위: 미터, 수신 불가 시 null)
  accuracy: number;       // 수신 시점의 GPS 수평 정확도 오차 (단위: 미터)
  timestamp: number;      // 수신 시각 (Unix Timestamp, ms)
}
```

---

## 3. Marker 엔터티 (현장 마커)

임장 도중 특정 좌표에서 남긴 개별 기록입니다. `type` 필드에 따라 하위 페이로드 구조가 분기됩니다.

### 3.1 공통 속성

```typescript
interface BaseMarker {
  id: string;             // 고유 식별자 ("marker_<timestamp>")
  sessionId: string;      // 소속 세션 ID (외래키, sessions.id 참조)
  type: 'note' | 'photo' | 'apt' | 'rate' | 'voice';
  lat: number;            // 기록 시점의 위도
  lng: number;            // 기록 시점의 경도
  timestamp: number;      // 기록 생성 시각 (Unix Timestamp, ms)
}
```

### 3.2 타입별 세부 스키마

#### 1) `note` (단순 메모)
```typescript
interface NoteMarker extends BaseMarker {
  type: 'note';
  text: string;           // 메모 본문
}
```

#### 2) `photo` (현장 사진)
```typescript
interface PhotoMarker extends BaseMarker {
  type: 'photo';
  photos: string[];       // Base64 DataURL 문자열 배열 (data:image/jpeg;base64,...)
  caption: string;        // 사진 설명 및 상황 요약
}
```

#### 3) `apt` (매물 정보)
```typescript
interface AptMarker extends BaseMarker {
  type: 'apt';
  aptData: {
    complexName: string;  // 아파트 단지명 (e.g. "래미안원베일리", "마포래미안푸르지오")
    dong: string;         // 동 (e.g. "101")
    floor: string;        // 층 (e.g. "15")
    size: string;         // 전용면적 또는 평형 (e.g. "84")
    price: string;        // 호가 / 매매가 (e.g. "15억 5,000")
    jeonse: string;       // 전세가 (e.g. "8억")
    direction: string;    // 주 거실 기준 방향 (e.g. "남향", "남동향")
    notes: string;        // 특이사항 및 중개사 코멘트
  };
}
```

#### 4) `rate` (현장 평가)
```typescript
interface RateMarker extends BaseMarker {
  type: 'rate';
  ratings: {
    transport: number;    // 교통 편의성 (1 ~ 5)
    school: number;       // 학군 및 교육 환경 (1 ~ 5)
    amenities: number;    // 상권 및 생활 편의시설 (1 ~ 5)
    noise: number;        // 주변 소음 쾌적도 (1 ~ 5)
    parking: number;      // 주차 공간 여유도 (1 ~ 5)
    sunlight: number;     // 일조량 및 채광 (1 ~ 5)
    view: number;         // 단지 배치 및 조망 (1 ~ 5)
  };
  rateNote: string;       // 채점 이유 및 현장 메모
}
```

#### 5) `voice` (음성 메모)
```typescript
interface VoiceMarker extends BaseMarker {
  type: 'voice';
  audioDataUrl: string;   // Base64 DataURL 문자열 (data:audio/webm;base64,...)
}
```

---

## 4. 엔터티 관계 다이어그램 (ERD)

```
┌─────────────────────────────────────────────────────────────┐
│                      Session (세션)                         │
│  - id (PK)                                                  │
│  - regionName: "강남구"                                      │
│  - route: Point[]                                           │
│  - totalDistance, overallRating, memo                       │
└──────────────────────────────┬──────────────────────────────┘
                               │ 1
                               │
                               │ N (Cascade Delete)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Marker (마커)                         │
│  - id (PK)                                                  │
│  - sessionId (FK -> Session.id)                             │
│  - type: 'note' | 'photo' | 'apt' | 'rate' | 'voice'        │
│  - lat, lng, timestamp                                      │
│  - [type-specific payload]:                                 │
│      ├── text (note)                                        │
│      ├── photos[], caption (photo)                          │
│      ├── aptData { complexName, dong, price... } (apt)      │
│      ├── ratings { transport, school... }, rateNote (rate)  │
│      └── audioDataUrl (voice)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 차세대 백엔드(PostgreSQL + PostGIS) 매핑 구조

향후 클라우드 동기화(v2.0) 도입 시 로컬 IndexedDB의 비정규화 객체는 공간 지리 쿼리를 위해 아래와 같은 RDBMS 테이블 구조로 정규화되어 저장됩니다.

```sql
-- 세션 테이블 (WGS84 LineString 지리공간 타입 활용)
CREATE TABLE sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL,
    region_name VARCHAR(100) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    route_geom GEOMETRY(LineString, 4326),  -- Point[] 배열을 PostGIS LineString으로 변환
    total_distance DOUBLE PRECISION DEFAULT 0,
    overall_rating INTEGER CHECK (overall_rating BETWEEN 0 AND 5),
    memo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 마커 테이블 (WGS84 Point 지리공간 타입 + JSONB 페이로드)
CREATE TABLE markers (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL, -- lat, lng를 PostGIS Point로 변환
    timestamp TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,                  -- 세부 필드는 JSONB로 보관하여 유연성 확보
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 변환 시 주요 변경점:
1. **GPS 경로(`Point[]`)**: 점들의 단순 배열에서 PostGIS `LineString` 지리 객체로 변환되어 공간 길이 계산(`ST_Length`) 및 경로 교차 분석이 가능해집니다.
2. **미디어 저장 방식**: 대용량 Base64 DataURL 문자열 대신 S3/R2 오브젝트 스토리지의 CDN URL 문자열만 JSONB에 보관하여 DB 부하를 절감합니다.

관련 상세 백엔드 아키텍처는 [docs/backend.md](backend.md)를 참고하세요.
