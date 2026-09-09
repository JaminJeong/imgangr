# 임장기록 🏘️

구(區) 단위 아파트 임장을 위한 위치 기반 트래킹 앱.

GPS로 이동 경로를 기록하고, 현장에서 메모·사진·매물정보·평가·음성을 지도 위에 남깁니다.

## 프로젝트 구조

```
imgangr/
├── web/        # 웹 앱 (Vanilla JS + Leaflet.js)
├── docker/     # Docker Compose 설정
└── docs/       # 문서
```

---

## 웹 앱 실행

### Docker Compose (권장)

```bash
git clone https://github.com/your-username/imgangr.git
cd imgangr/docker
docker compose up -d
# → http://localhost:8080
```

포트 변경:

```bash
PORT=3000 docker compose up -d
```

### 로컬 직접 실행

```bash
cd web
python3 -m http.server 8080
# → http://localhost:8080
```

> **HTTPS 필요**: GPS·카메라·마이크는 HTTPS 또는 localhost에서만 동작합니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 📍 경로 추적 | 구 단위 GPS 이동 경로 실시간 기록 |
| 📝 메모 | 위치에 텍스트 메모 첨부 |
| 📸 사진 | 카메라/갤러리 사진 + 위치 태깅 |
| 🏠 매물 | 단지명·동·층·평형·매매가·전세가·방향 기록 |
| ⭐ 평가 | 교통·학군·편의시설·소음·주차·일조량·조망 점수 |
| 🎙️ 음성 | 현장 음성 메모 녹음 |
| 📚 아카이브 | 과거 임장 검색 및 경로 재확인 |

---

## 기술 스택

### Web
- **지도**: [Leaflet.js](https://leafletjs.com/) + OpenStreetMap
- **저장소**: IndexedDB
- **서버**: nginx (Docker)

---

## 문서

- [서비스 기획서](docs/service-plan.md)
- [사용법 가이드](docs/usage.md)
- [프로젝트 구조](docs/project-structure.md)
- [아키텍처](docs/architecture.md)
- [프론트엔드 기술 명세서](docs/frontend.md)
- [백엔드 & 인프라 기술 명세서](docs/backend.md)
- [데이터 모델](docs/data-model.md)
- [배포 및 구글 클라우드 동기화 가이드](docs/cloud-sync.md)
- [비전공자를 위한 용어 설명서](docs/glossary.md)

---

## 라이선스

MIT
