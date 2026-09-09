/**
 * mapManager.js
 * Leaflet 지도 관리 (추적 지도 & 상세보기 지도)
 */
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_TILE_MAX_ZOOM = 19;
const ROUTE_LINE_STYLE = { color: '#3B82F6', weight: 4, opacity: 0.85 };

const MapManager = {
  trackMap: null,
  detailMap: null,
  trackPolyline: null,
  trackMarkers: [],
  userMarker: null,
  detailPolyline: null,
  detailMarkers: [],

  MARKER_ICONS: {
    note:  { emoji: '📝', color: '#F59E0B', label: '메모' },
    photo: { emoji: '📸', color: '#3B82F6', label: '사진' },
    apt:   { emoji: '🏠', color: '#10B981', label: '매물' },
    rate:  { emoji: '⭐', color: '#8B5CF6', label: '평가' },
    voice: { emoji: '🎙️', color: '#EF4444', label: '음성' },
  },

  // ── 추적 지도 ──────────────────────────────────────────────

  initTrackMap(containerId, center) {
    if (this.trackMap) {
      this.trackMap.remove();
      this.trackMap = null;
    }
    this.trackPolyline = null;
    this.trackMarkers = [];
    this.userMarker = null;

    this.trackMap = this._createMap(containerId);

    if (center) {
      this.trackMap.setView([center.lat, center.lng], 17);
    }

    this.trackPolyline = L.polyline([], ROUTE_LINE_STYLE).addTo(this.trackMap);

    return this.trackMap;
  },

  updateTrackPosition(point, route) {
    if (!this.trackMap) return;

    // 경로 업데이트
    this.trackPolyline.addLatLng([point.lat, point.lng]);

    // 사용자 위치 마커
    if (!this.userMarker) {
      const icon = this._createDivIcon('<div class="user-dot"></div>', 24);
      this.userMarker = L.marker([point.lat, point.lng], { icon }).addTo(this.trackMap);
    } else {
      this.userMarker.setLatLng([point.lat, point.lng]);
    }

    this.trackMap.panTo([point.lat, point.lng]);
  },

  addTrackMarker(marker, onClick) {
    if (!this.trackMap) return;
    const icon = this._makeMarkerIcon(marker.type);
    const m = L.marker([marker.lat, marker.lng], { icon })
      .addTo(this.trackMap)
      .on('click', () => onClick(marker));
    this.trackMarkers.push({ id: marker.id, leafletMarker: m });
  },

  removeTrackMarker(markerId) {
    const idx = this.trackMarkers.findIndex((m) => m.id === markerId);
    if (idx !== -1) {
      this.trackMap.removeLayer(this.trackMarkers[idx].leafletMarker);
      this.trackMarkers.splice(idx, 1);
    }
  },

  invalidateTrackMap() {
    if (this.trackMap) setTimeout(() => this.trackMap.invalidateSize(), 100);
  },

  // ── 상세보기 지도 ──────────────────────────────────────────

  initDetailMap(containerId, session, markers, onMarkerClick) {
    if (this.detailMap) {
      this.detailMap.remove();
      this.detailMap = null;
    }
    this.detailMarkers = [];

    this.detailMap = this._createMap(containerId);

    // 경로 그리기
    if (session.route && session.route.length > 0) {
      const latlngs = session.route.map((p) => [p.lat, p.lng]);
      this.detailPolyline = L.polyline(latlngs, { ...ROUTE_LINE_STYLE, opacity: 0.8 }).addTo(this.detailMap);

      L.marker(latlngs[0], { icon: this._createDivIcon('<div class="start-dot">S</div>', 28) })
        .addTo(this.detailMap);

      if (latlngs.length > 1) {
        L.marker(latlngs[latlngs.length - 1], { icon: this._createDivIcon('<div class="end-dot">E</div>', 28) })
          .addTo(this.detailMap);
      }

      this.detailMap.fitBounds(this.detailPolyline.getBounds(), { padding: [40, 40] });
    } else if (markers.length > 0) {
      this.detailMap.setView([markers[0].lat, markers[0].lng], 16);
    }

    // 마커 그리기
    markers.forEach((marker) => {
      const icon = this._makeMarkerIcon(marker.type);
      const m = L.marker([marker.lat, marker.lng], { icon })
        .addTo(this.detailMap)
        .on('click', () => onMarkerClick(marker));
      this.detailMarkers.push({ id: marker.id, leafletMarker: m });
    });

    setTimeout(() => this.detailMap.invalidateSize(), 200);
  },

  panDetailTo(lat, lng) {
    if (this.detailMap) this.detailMap.panTo([lat, lng]);
  },

  // ── 공통 유틸 ──────────────────────────────────────────────

  _createMap(containerId) {
    const map = L.map(containerId, { zoomControl: true, attributionControl: false });
    L.tileLayer(OSM_TILE_URL, { maxZoom: OSM_TILE_MAX_ZOOM }).addTo(map);
    return map;
  },

  _createDivIcon(html, size) {
    return L.divIcon({
      html,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  },

  _makeMarkerIcon(type) {
    const cfg = this.MARKER_ICONS[type] || this.MARKER_ICONS.note;
    return L.divIcon({
      html: `<div class="map-marker-pin" style="background:${cfg.color}">${cfg.emoji}</div>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    });
  },
};
