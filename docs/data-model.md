# 데이터 모델

모든 데이터는 브라우저의 **IndexedDB** (`imgangr_db`, version 1)에 저장됩니다.

## Object Stores

| Store | Key | Index | 설명 |
|-------|-----|-------|------|
| `sessions` | `id` | `date` | 임장 세션 (경로 포함) |
| `markers` | `id` | `sessionId` | 현장 기록 마커 |

---

## Session

임장 한 번의 전체 기록을 담는 객체입니다.

```js
{
  id:            String,   // "session_<timestamp>"  PK
  regionName:    String,   // 지역명(구). 예) "강남구", "마포구"
  date:          String,   // "YYYY-MM-DD"
  startTime:     Number,   // Unix timestamp (ms)
  endTime:       Number,   // Unix timestamp (ms) | null (진행 중)
  route:         Point[],  // GPS 경로 포인트 배열 (아래 참조)
  totalDistance: Number,   // 총 이동 거리 (m)
  markerCount:   Number,   // 연결된 마커 수
  overallRating: Number,   // 별점 0~5
  memo:          String,   // 종합 메모
}
```

### Point (route 배열 원소)

```js
{
  lat:       Number,   // 위도
  lng:       Number,   // 경도
  altitude:  Number,   // 고도 (m) | null
  accuracy:  Number,   // GPS 정확도 (m)
  timestamp: Number,   // Unix timestamp (ms)
}
```

---

## Marker

세션에 속하는 개별 현장 기록입니다. `type`에 따라 추가 필드가 달라집니다.

### 공통 필드

```js
{
  id:        String,   // "marker_<timestamp>"  PK
  sessionId: String,   // 소속 세션 ID  FK → sessions.id
  type:      String,   // "note" | "photo" | "apt" | "rate" | "voice"
  lat:       Number,   // 기록 시점 위도
  lng:       Number,   // 기록 시점 경도
  timestamp: Number,   // 기록 시각 (Unix ms)
}
```

### type = `"note"` (메모)

```js
{
  ...공통,
  text: String,   // 메모 본문
}
```

### type = `"photo"` (사진)

```js
{
  ...공통,
  photos:  String[],  // Base64 DataURL 배열
  caption: String,    // 사진 설명
}
```

### type = `"apt"` (매물 정보)

```js
{
  ...공통,
  aptData: {
    complexName: String,   // 단지명. 예) "래미안원베일리"  ← 구 단위 임장에서 필수
    dong:        String,   // 동. 예) "101"
    floor:       String,   // 층. 예) "15"
    size:        String,   // 평형/㎡. 예) "84"
    price:       String,   // 매매가. 예) "15억 5,000"
    jeonse:      String,   // 전세가. 예) "8억"
    direction:   String,   // 방향. 예) "남향"
    notes:       String,   // 특이사항
  },
}
```

### type = `"rate"` (현장 평가)

```js
{
  ...공통,
  ratings: {
    transport:  Number,  // 교통   1~5
    school:     Number,  // 학군   1~5
    amenities:  Number,  // 편의시설 1~5
    noise:      Number,  // 소음   1~5
    parking:    Number,  // 주차   1~5
    sunlight:   Number,  // 일조량 1~5
    view:       Number,  // 조망   1~5
  },
  rateNote: String,      // 평가 메모
}
```

### type = `"voice"` (음성 메모)

```js
{
  ...공통,
  audioDataUrl: String,  // Base64 DataURL (audio/webm)
}
```

---

## 관계 다이어그램

```
sessions (구 단위 임장 1회)
   │  regionName: "강남구"
   │  1 ──── N markers
   │                 │
   │ id ─────────── sessionId
   │
   └─ route: Point[]        (세션 내 배열로 내장)

markers (apt 타입)
   └─ aptData.complexName   (방문한 개별 단지명 — 1 세션에 N개 단지 기록 가능)
```

---

## 저장 용량 참고

| 데이터 | 예상 크기 |
|--------|----------|
| GPS 포인트 1개 | ~150 Bytes |
| 1시간 임장 경로 (600포인트) | ~90 KB |
| JPEG 사진 1장 (리사이즈 없음) | 500 KB ~ 3 MB |
| 음성 메모 1분 (webm) | ~100 KB |

브라우저별 IndexedDB 용량 한도는 일반적으로 디스크 여유 공간의 60% 수준이나,
사진을 원본 크기로 다수 첨부할 경우 한도에 도달할 수 있습니다.
