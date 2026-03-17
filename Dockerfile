# ── 빌드 스테이지 없음 (순수 정적 파일) ──────────────────────
# nginx:alpine 이미지에 소스를 복사하여 서빙
FROM nginx:1.27-alpine

# 기본 설정 제거 후 커스텀 설정 적용
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 정적 파일 복사
COPY index.html  /usr/share/nginx/html/
COPY css/        /usr/share/nginx/html/css/
COPY js/         /usr/share/nginx/html/js/

# nginx가 사용할 포트
EXPOSE 80

# 헬스체크
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
