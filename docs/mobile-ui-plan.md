# 모바일 UI 개선 기획서 (Mobile UI Redesign Plan)

본 문서는 **임장기록(Imgangr)**의 현재 UI를 분석하고, 데스크톱 브라우저에서도 "모바일 앱처럼" 보이도록, 그리고 실제 스마트폰에서 노치·홈 인디케이터 등을 제대로 피해가도록 개선한 내용을 정리합니다.

---

## 1. 문제 진단

### 1.1 데스크톱에서 "웹페이지처럼" 보이는 원인

[프론트엔드 명세서](frontend.md)는 이 앱을 "모바일 퍼스트, 최대 너비 480px"로 설명하지만, 실제 CSS(`web/css/style.css`)를 확인한 결과 **그 폭 제한이 모달(팝업)에만 적용되어 있었습니다.**

```css
/* 기존 코드: .view, .bottom-nav는 폭 제한이 전혀 없음 */
.view       { position: fixed; inset: 0; ... }   /* 뷰포트 전체에 고정 */
.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; ... }

/* 모달만 480px로 제한됨 */
@media (min-width: 480px) {
  .modal-sheet { max-width: 480px; margin: 0 auto; }
}
```

즉 실제 폰 화면(대개 CSS 기준 480px 이하)에서는 문제가 없지만, **데스크톱처럼 넓은 브라우저 창에서는 홈 화면·카드·하단 네비게이션이 창 전체 너비로 늘어나** "앱"이 아니라 "늘어난 웹페이지"처럼 보였습니다. 그 상태에서 모달을 열면 화면 중앙에 좁은 카드 하나만 뜨는 부조화도 함께 발생했습니다.

### 1.2 Safe Area(노치/홈 인디케이터) 미대응

문서상으로는 "SafeArea 대응"이 되어 있다고 적혀 있었지만, 실제 코드에는 `env(safe-area-inset-*)`가 전혀 사용되지 않았고 `viewport-fit=cover` meta도 없었습니다. 아이폰 등 노치/다이나믹 아일랜드 기기에서는:
- 홈 화면 상단 헤더 텍스트가 상태 바/노치에 가려질 수 있음
- 추적 화면 하단 컨트롤 버튼, 바텀시트 모달의 하단 버튼이 홈 인디케이터 제스처 바에 가려질 수 있음

---

## 2. 개선 방향

### 2.1 데스크톱 = "폰 프레임" 컨테이너

새 창을 만들지 않고 **`<body>` 자체를 폰 프레임으로** 만들었습니다.

```css
html { background: #0B1220; }              /* 프레임 바깥 배경 (데스크톱에서만 보임) */
body {
  max-width: 480px;
  margin: 0 auto;
  position: relative;
  transform: translateZ(0);                 /* 핵심: 아래 position:fixed 자식들을
                                                뷰포트가 아닌 이 body 기준으로 고정시킴 */
}
@media (min-width: 481px) {
  body { max-height: 900px; margin-top: ...; border-radius: 28px; box-shadow: ...; }
}
```

`transform`이 있는 요소는 CSS 스펙상 자손의 `position: fixed`에 대한 새로운 컨테이닝 블록이 됩니다. 즉 **기존 `.view`, `.bottom-nav`, `.modal`, `#toast-container`의 `position: fixed` 코드는 한 줄도 건들지 않고**, `body`에 이 속성 하나만 추가하는 것으로 모든 고정 요소가 "뷰포트 전체"가 아니라 "body 프레임 내부"로 자동으로 다시 계산됩니다.

- **모바일 실기기(≤480px)**: `body`가 곧 화면 전체 너비이므로 기존과 동일하게 100% 동작
- **데스크톱(>480px)**: `body`가 480px 폭의 카드 형태로 중앙에 떠 있고, 모달도 그 카드 안에서만 열림 → 실제 폰 화면을 보는 것과 같은 느낌

### 2.2 Safe Area 대응 실제 구현

`index.html`의 viewport meta에 `viewport-fit=cover`를 추가하고, 화면 상/하단에 붙는 요소에 `env(safe-area-inset-*)`를 반영했습니다.

| 요소 | 적용 위치 | 목적 |
|------|-----------|------|
| `.home-header` | 상단 패딩 | 노치 아래로 제목이 밀리도록 |
| `.track-header`, `.detail-header` | 상단 패딩 | `#view-track`/`#view-detail`은 화면 최상단까지 차지하므로 노치 보호 필요 |
| `.bottom-nav` | 높이 + 하단 패딩 | 홈 인디케이터 위로 탭이 뜨도록 |
| `.track-controls` | 하단 패딩 | 추적 화면은 하단 네비 없이 화면 끝까지 차므로 별도 보호 필요 |
| `#view-detail` | 하단 패딩 | 상세 화면도 화면 끝까지 차므로 스크롤 영역 끝에 여백 확보 |
| `.modal-actions` (바텀시트) | 하단 패딩 | 시트 하단 버튼이 홈 인디케이터에 가려지지 않도록 |

실기기가 아닌 브라우저(데스크톱 포함)에서는 `env(safe-area-inset-*)`가 `0`으로 계산되므로 기존 레이아웃에 영향이 없습니다.

---

## 3. 적용 결과

- **코드 변경 범위**: `web/index.html`(meta 태그 1줄), `web/css/style.css`(약 10곳의 패딩/새 규칙 추가) — 기존 `position: fixed` 구조나 JS 로직은 변경 없음
- **모바일 실기기 동작**: 기존과 동일 + 노치/홈 인디케이터 겹침 해소
- **데스크톱 브라우저 동작**: 중앙 정렬된 480px 폭 "폰 카드" 형태로 렌더링되어, 넓은 창에서도 실제 스마트폰 앱을 보는 느낌을 줌

## 관련 문서

- [프론트엔드 기술 명세서](frontend.md) — UI/UX 설계 섹션에 이 프레임 방식이 반영되어 있음
- [사용법 가이드](usage.md) — 실제 사용자 화면 설명
