/**
 * tracker.js
 * GPS 위치 추적 및 거리 계산
 */
const GEO_WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 };
const MAX_ACCURACY_M = 50; // 노이즈 필터: 정확도가 이 값(m) 이상이면 무시
const MIN_MOVE_M = 3;      // 최소 이동 거리 필터: 이 값(m) 미만 이동은 무시
const EARTH_RADIUS_M = 6371000;

const Tracker = {
  watchId: null,
  route: [],
  onPositionUpdate: null,
  onError: null,

  start(onPositionUpdate, onError) {
    this.route = [];
    this.onPositionUpdate = onPositionUpdate;
    this.onError = onError;

    if (!navigator.geolocation) {
      onError('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      return false;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._handlePosition(pos),
      (err) => this._handleError(err),
      GEO_WATCH_OPTIONS
    );
    return true;
  },

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    return [...this.route];
  },

  pause() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  },

  resume(onPositionUpdate, onError) {
    this.onPositionUpdate = onPositionUpdate;
    this.onError = onError;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._handlePosition(pos),
      (err) => this._handleError(err),
      GEO_WATCH_OPTIONS
    );
  },

  _handlePosition(pos) {
    const point = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      altitude: pos.coords.altitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    };

    if (point.accuracy > MAX_ACCURACY_M) return;

    if (this.route.length > 0) {
      const last = this.route[this.route.length - 1];
      const dist = this.haversine(last.lat, last.lng, point.lat, point.lng);
      if (dist < MIN_MOVE_M) return;
    }

    this.route.push(point);
    if (this.onPositionUpdate) this.onPositionUpdate(point, this.route);
  },

  _handleError(err) {
    const messages = {
      1: '위치 접근 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.',
      2: '위치 정보를 가져올 수 없습니다.',
      3: '위치 정보 요청 시간이 초과되었습니다.',
    };
    if (this.onError) this.onError(messages[err.code] || '알 수 없는 오류');
  },

  // Haversine 공식: 두 좌표 사이의 거리(m)
  haversine(lat1, lng1, lat2, lng2) {
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  // 경로 배열에서 총 이동 거리(m) 계산
  calcTotalDistance(route) {
    let total = 0;
    for (let i = 1; i < route.length; i++) {
      total += this.haversine(
        route[i - 1].lat, route[i - 1].lng,
        route[i].lat, route[i].lng
      );
    }
    return total;
  },

  formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  },

  formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분 ${sec}초`;
    return `${sec}초`;
  },

  // 현재 위치 1회 가져오기
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  },
};
