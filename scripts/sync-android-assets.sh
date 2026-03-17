#!/bin/bash
# ─────────────────────────────────────────────────────────────
# sync-android-assets.sh
# web/ 소스를 android/app/src/main/assets/ 로 동기화
#
# 사용법:
#   ./scripts/sync-android-assets.sh
#
# web/index.html, web/css/, web/js/ 파일을 수정한 후
# 이 스크립트를 실행하면 Android 앱 에셋이 자동으로 갱신됩니다.
# ─────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

SRC="$ROOT_DIR/web"
DST="$ROOT_DIR/android/app/src/main/assets"

echo "▶ 웹 에셋 동기화 시작"
echo "  src: $SRC"
echo "  dst: $DST"

# index.html
cp "$SRC/index.html" "$DST/index.html"
echo "  ✓ index.html"

# css/
rsync -a --delete "$SRC/css/" "$DST/css/"
echo "  ✓ css/"

# js/
rsync -a --delete "$SRC/js/"  "$DST/js/"
echo "  ✓ js/"

echo "▶ 동기화 완료"
