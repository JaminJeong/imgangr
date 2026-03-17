# 임장기록 🏘️

아파트 임장을 위한 위치 기반 트래킹 웹 앱.

GPS로 이동 경로를 기록하고, 현장에서 메모·사진·매물정보·평가·음성을 지도 위에 남깁니다.
빌드 없이 브라우저에서 바로 실행되며, 모든 데이터는 기기 로컬(IndexedDB)에 저장됩니다.

## 빠른 시작

### Docker Compose (권장)

```bash
git clone https://github.com/your-username/imgangr.git
cd imgangr
docker compose up -d
# 브라우저에서 http://localhost:8080 접속
```

포트를 변경하려면:

```bash
PORT=3000 docker compose up -d
```

### 로컬 직접 실행

```bash
python3 -m http.server 8080
# 브라우저에서 http://localhost:8080 접속
```

> **HTTPS 필요**: GPS·카메라·마이크 기능은 HTTPS 또는 localhost 환경에서만 동작합니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| 📍 경로 추적 | GPS로 실시간 이동 경로 기록 및 지도 표시 |
| 📝 메모 | 위치에 텍스트 메모 첨부 |
| 📸 사진 | 카메라/갤러리에서 사진 촬영 및 위치 태깅 |
| 🏠 매물 | 동·층·평형·매매가·전세가·방향 기록 |
| ⭐ 평가 | 교통·학군·편의시설·소음·주차·일조량·조망 점수 |
| 🎙️ 음성 | 현장 음성 메모 녹음 |
| 📚 아카이브 | 과거 임장 검색 및 지도 경로 재확인 |

## 문서

- [서비스 기획서](docs/service-plan.md)
- [사용법 가이드](docs/usage.md)
- [프로젝트 구조](docs/project-structure.md)
- [아키텍처](docs/architecture.md)
- [데이터 모델](docs/data-model.md)

## 기술 스택

- **지도**: [Leaflet.js](https://leafletjs.com/) + OpenStreetMap (무료, API 키 불필요)
- **저장소**: IndexedDB (브라우저 내장)
- **위치**: Geolocation API
- **미디어**: MediaDevices API (카메라·마이크)
- **빌드 도구**: 없음 (Vanilla HTML/CSS/JS)

## 라이선스

MIT
