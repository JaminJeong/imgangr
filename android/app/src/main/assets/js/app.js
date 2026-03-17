/**
 * app.js
 * 임장기록 메인 앱 컨트롤러
 */

// ── 상태 ──────────────────────────────────────────────────────
const State = {
  currentView: 'home',
  activeSession: null,       // 진행 중인 세션
  trackingActive: false,
  trackingPaused: false,
  sessionStartTime: null,
  timerInterval: null,
  pendingMarkerLatLng: null, // 마커 추가 시 현재 좌표
  currentDetailSession: null,
  currentDetailMarkers: [],
  mediaRecorder: null,
  audioChunks: [],
  isRecordingAudio: false,
};

// ── 뷰 전환 ──────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

  const viewEl = document.getElementById(`view-${name}`);
  if (viewEl) viewEl.classList.add('active');

  const navBtn = document.querySelector(`[data-view="${name}"]`);
  if (navBtn) navBtn.classList.add('active');

  // 추적 뷰 진입 시 지도 크기 재계산
  if (name === 'track') {
    MapManager.invalidateTrackMap();
  }

  // 네비게이션 바 표시 여부
  const hideNav = ['track', 'detail'].includes(name);
  document.getElementById('bottom-nav').style.display = hideNav ? 'none' : 'flex';

  State.currentView = name;
}

// ── 홈 뷰 ────────────────────────────────────────────────────

async function renderHome() {
  const sessions = await Storage.getSessions();
  const totalEl = document.getElementById('stat-total');
  const distEl  = document.getElementById('stat-dist');
  const listEl  = document.getElementById('recent-list');


  totalEl.textContent = sessions.length;

  const totalDist = sessions.reduce((sum, s) => sum + (s.totalDistance || 0), 0);
  distEl.textContent = Tracker.formatDistance(totalDist);

  if (sessions.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏘️</div>
        <p>아직 임장 기록이 없어요.<br>첫 번째 임장을 시작해보세요!</p>
      </div>`;
    return;
  }

  listEl.innerHTML = sessions.slice(0, 5).map((s) => buildSessionCard(s)).join('');
  attachSessionCardListeners(listEl);
}

function buildSessionCard(s) {
  const date = new Date(s.startTime);
  const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
  const duration = s.endTime ? Tracker.formatDuration(s.endTime - s.startTime) : '-';
  const dist     = s.totalDistance ? Tracker.formatDistance(s.totalDistance) : '-';
  const stars    = s.overallRating ? '⭐'.repeat(s.overallRating) : '';

  return `
    <div class="session-card" data-id="${s.id}">
      <div class="session-card-header">
        <div>
          <div class="session-name">${escapeHtml(s.regionName || s.complexName || '-')}</div>
          <div class="session-date">${dateStr}</div>
        </div>
        <div class="session-rating">${stars}</div>
      </div>
      <div class="session-stats">
        <span>🚶 ${dist}</span>
        <span>⏱ ${duration}</span>
        <span>📍 ${s.markerCount || 0}개 기록</span>
      </div>
      ${s.memo ? `<div class="session-memo">"${escapeHtml(s.memo.slice(0,60))}${s.memo.length>60?'…':''}"</div>` : ''}
    </div>`;
}

function attachSessionCardListeners(container) {
  container.querySelectorAll('.session-card').forEach((card) => {
    card.addEventListener('click', () => openDetailView(card.dataset.id));
  });
}

// ── 새 임장 시작 ──────────────────────────────────────────────

function openNewSessionModal() {
  document.getElementById('modal-new-session').classList.add('active');
  document.getElementById('input-region-name').focus();
}

function closeNewSessionModal() {
  document.getElementById('modal-new-session').classList.remove('active');
}

async function startSession() {
  const regionName = document.getElementById('input-region-name').value.trim();
  if (!regionName) {
    showToast('지역명을 입력해주세요.', 'warning');
    return;
  }

  // 위치 권한 확인
  try {
    const pos = await Tracker.getCurrentPosition();
    initTrackingSession(regionName, pos);
  } catch (e) {
    // 위치 없이도 시작 가능 (나중에 GPS 잡힐 때 추적 시작)
    showToast('위치를 가져오는 중입니다…', 'info');
    initTrackingSession(regionName, null);
  }
}

function initTrackingSession(regionName, initialPos) {
  const session = {
    id: `session_${Date.now()}`,
    regionName,
    startTime: Date.now(),
    endTime: null,
    route: [],
    totalDistance: 0,
    markerCount: 0,
    overallRating: 0,
    memo: '',
    date: new Date().toISOString().split('T')[0],
  };

  State.activeSession = session;
  State.sessionStartTime = Date.now();
  State.trackingActive = true;
  State.trackingPaused = false;

  closeNewSessionModal();
  document.getElementById('input-region-name').value = '';

  showView('track');

  // 지도 초기화
  MapManager.initTrackMap('track-map', initialPos || { lat: 37.5665, lng: 126.9780 });

  // 헤더 업데이트
  document.getElementById('track-region-name').textContent = regionName;

  // 타이머 시작
  startTimer();

  // GPS 추적 시작
  Tracker.start(
    (point, route) => {
      State.activeSession.route = route;
      MapManager.updateTrackPosition(point, route);
      State.activeSession.totalDistance = Tracker.calcTotalDistance(route);
      document.getElementById('track-distance').textContent =
        Tracker.formatDistance(State.activeSession.totalDistance);
    },
    (err) => showToast(err, 'error')
  );

  // 일시정지 버튼
  document.getElementById('btn-pause').textContent = '일시정지';
  document.getElementById('btn-pause').classList.remove('paused');
}

// ── 타이머 ────────────────────────────────────────────────────

function startTimer() {
  clearInterval(State.timerInterval);
  State.timerInterval = setInterval(() => {
    if (!State.trackingPaused) {
      const elapsed = Date.now() - State.sessionStartTime;
      document.getElementById('track-duration').textContent =
        Tracker.formatDuration(elapsed);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(State.timerInterval);
  State.timerInterval = null;
}

// ── 일시정지 / 재개 ──────────────────────────────────────────

function togglePause() {
  const btn = document.getElementById('btn-pause');
  if (State.trackingPaused) {
    State.trackingPaused = false;
    btn.textContent = '일시정지';
    btn.classList.remove('paused');
    Tracker.resume(
      (point, route) => {
        State.activeSession.route = route;
        MapManager.updateTrackPosition(point, route);
        State.activeSession.totalDistance = Tracker.calcTotalDistance(route);
        document.getElementById('track-distance').textContent =
          Tracker.formatDistance(State.activeSession.totalDistance);
      },
      (err) => showToast(err, 'error')
    );
  } else {
    State.trackingPaused = true;
    btn.textContent = '재개';
    btn.classList.add('paused');
    Tracker.pause();
  }
}

// ── 임장 종료 ────────────────────────────────────────────────

function confirmEndSession() {
  if (!State.activeSession) return;
  document.getElementById('modal-end-session').classList.add('active');
}

function cancelEndSession() {
  document.getElementById('modal-end-session').classList.remove('active');
}

async function endSession() {
  if (!State.activeSession) return;

  Tracker.stop();
  stopTimer();

  const rating = parseInt(document.getElementById('overall-rating').value) || 0;
  const memo   = document.getElementById('end-memo').value.trim();

  State.activeSession.endTime      = Date.now();
  State.activeSession.totalDistance = Tracker.calcTotalDistance(State.activeSession.route);
  State.activeSession.overallRating = rating;
  State.activeSession.memo          = memo;

  await Storage.saveSession(State.activeSession);

  document.getElementById('modal-end-session').classList.remove('active');
  document.getElementById('end-memo').value = '';
  document.getElementById('overall-rating').value = 0;
  updateStarDisplay(0);

  const finishedSession = State.activeSession;
  State.activeSession   = null;
  State.trackingActive  = false;

  showToast('임장 기록이 저장되었습니다! 🎉', 'success');
  await renderHome();
  showView('home');

  // 바로 상세 보기
  setTimeout(() => openDetailView(finishedSession.id), 300);
}

// ── 마커 추가 모달 ───────────────────────────────────────────

async function openMarkerModal() {
  if (!State.activeSession) return;

  // 현재 GPS 좌표
  let pos = null;
  if (State.activeSession.route.length > 0) {
    const last = State.activeSession.route[State.activeSession.route.length - 1];
    pos = { lat: last.lat, lng: last.lng };
  } else {
    try { pos = await Tracker.getCurrentPosition(); } catch (_) {}
  }
  State.pendingMarkerLatLng = pos;

  // 초기화
  switchMarkerTab('note');
  document.getElementById('marker-note-text').value = '';
  document.getElementById('marker-photo-preview').innerHTML = '';
  document.getElementById('marker-apt-complex').value = '';
  document.getElementById('marker-apt-dong').value = '';
  document.getElementById('marker-apt-floor').value = '';
  document.getElementById('marker-apt-size').value = '';
  document.getElementById('marker-apt-price').value = '';
  document.getElementById('marker-apt-jeonse').value = '';
  document.getElementById('marker-apt-direction').value = '';
  document.getElementById('marker-apt-notes').value = '';
  document.querySelectorAll('.rating-slider').forEach((s) => {
    s.value = 3;
    s.nextElementSibling.textContent = '3';
  });
  State.photoDataUrls = [];

  document.getElementById('modal-marker').classList.add('active');
}

function closeMarkerModal() {
  document.getElementById('modal-marker').classList.remove('active');
  stopAudioRecording();
}

function switchMarkerTab(type) {
  document.querySelectorAll('.marker-tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.type === type)
  );
  document.querySelectorAll('.marker-tab-content').forEach((c) =>
    c.classList.toggle('active', c.dataset.type === type)
  );
  State.activeMarkerType = type;
}

async function saveMarker() {
  if (!State.activeSession) return;

  const type = State.activeMarkerType || 'note';
  const pos  = State.pendingMarkerLatLng;

  if (!pos) {
    showToast('위치 정보가 없습니다. 잠시 후 다시 시도해주세요.', 'warning');
    return;
  }

  const marker = {
    id: `marker_${Date.now()}`,
    sessionId: State.activeSession.id,
    type,
    lat: pos.lat,
    lng: pos.lng,
    timestamp: Date.now(),
  };

  // 타입별 데이터 수집
  if (type === 'note') {
    marker.text = document.getElementById('marker-note-text').value.trim();
    if (!marker.text) { showToast('메모를 입력해주세요.', 'warning'); return; }

  } else if (type === 'photo') {
    marker.photos = State.photoDataUrls || [];
    marker.caption = document.getElementById('marker-photo-caption').value.trim();
    if (marker.photos.length === 0) { showToast('사진을 추가해주세요.', 'warning'); return; }

  } else if (type === 'apt') {
    marker.aptData = {
      complexName: document.getElementById('marker-apt-complex').value.trim(),
      dong:        document.getElementById('marker-apt-dong').value.trim(),
      floor:       document.getElementById('marker-apt-floor').value.trim(),
      size:        document.getElementById('marker-apt-size').value.trim(),
      price:       document.getElementById('marker-apt-price').value.trim(),
      jeonse:      document.getElementById('marker-apt-jeonse').value.trim(),
      direction:   document.getElementById('marker-apt-direction').value,
      notes:       document.getElementById('marker-apt-notes').value.trim(),
    };

  } else if (type === 'rate') {
    marker.ratings = {};
    document.querySelectorAll('.rating-slider').forEach((s) => {
      marker.ratings[s.dataset.key] = parseInt(s.value);
    });
    marker.rateNote = document.getElementById('marker-rate-note').value.trim();

  } else if (type === 'voice') {
    if (!State.savedAudioBlob) { showToast('음성을 녹음해주세요.', 'warning'); return; }
    marker.audioDataUrl = await blobToDataUrl(State.savedAudioBlob);
    State.savedAudioBlob = null;
  }

  await Storage.saveMarker(marker);
  State.activeSession.markerCount = (State.activeSession.markerCount || 0) + 1;
  await Storage.saveSession(State.activeSession);

  MapManager.addTrackMarker(marker, (m) => showTrackMarkerDetail(m));

  closeMarkerModal();
  showToast('기록이 추가되었습니다.', 'success');
}

// ── 사진 처리 ────────────────────────────────────────────────

State.photoDataUrls = [];

function handlePhotoSelect(files) {
  const preview = document.getElementById('marker-photo-preview');
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      State.photoDataUrls.push(e.target.result);
      const img = document.createElement('img');
      img.src = e.target.result;
      img.className = 'photo-thumb';
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

// ── 음성 녹음 ────────────────────────────────────────────────

async function toggleAudioRecording() {
  const btn = document.getElementById('btn-record-audio');
  if (State.isRecordingAudio) {
    stopAudioRecording();
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      State.mediaRecorder = new MediaRecorder(stream);
      State.audioChunks = [];
      State.mediaRecorder.ondataavailable = (e) => State.audioChunks.push(e.data);
      State.mediaRecorder.onstop = () => {
        State.savedAudioBlob = new Blob(State.audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        const url = URL.createObjectURL(State.savedAudioBlob);
        document.getElementById('audio-playback').src = url;
        document.getElementById('audio-playback').style.display = 'block';
        btn.textContent = '🎙️ 다시 녹음';
        btn.classList.remove('recording');
      };
      State.mediaRecorder.start();
      State.isRecordingAudio = true;
      btn.textContent = '⏹ 녹음 중지';
      btn.classList.add('recording');
      document.getElementById('recording-status').textContent = '녹음 중…';
    } catch (e) {
      showToast('마이크 접근 권한이 필요합니다.', 'error');
    }
  }
}

function stopAudioRecording() {
  if (State.mediaRecorder && State.isRecordingAudio) {
    State.mediaRecorder.stop();
    State.isRecordingAudio = false;
    document.getElementById('recording-status').textContent = '';
  }
}

// ── 기록 뷰 ──────────────────────────────────────────────────

async function renderRecords(query = '') {
  let sessions = await Storage.getSessions();
  if (query) {
    const q = query.toLowerCase();
    sessions = sessions.filter((s) => (s.regionName || s.complexName || '').toLowerCase().includes(q));
  }

  const listEl = document.getElementById('records-list');
  if (sessions.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>${query ? '검색 결과가 없습니다.' : '기록이 없습니다.'}</p>
      </div>`;
    return;
  }

  listEl.innerHTML = sessions.map((s) => `
    <div class="session-card record-card" data-id="${s.id}">
      <div class="session-card-header">
        <div>
          <div class="session-name">${escapeHtml(s.regionName || s.complexName || '-')}</div>
          <div class="session-date">${formatDate(s.startTime)}</div>
        </div>
        <button class="btn-delete-session" data-id="${s.id}" title="삭제">🗑️</button>
      </div>
      <div class="session-stats">
        <span>🚶 ${s.totalDistance ? Tracker.formatDistance(s.totalDistance) : '-'}</span>
        <span>⏱ ${s.endTime ? Tracker.formatDuration(s.endTime - s.startTime) : '-'}</span>
        <span>📍 ${s.markerCount || 0}개</span>
        ${s.overallRating ? `<span>${'⭐'.repeat(s.overallRating)}</span>` : ''}
      </div>
      ${s.memo ? `<div class="session-memo">"${escapeHtml(s.memo.slice(0,80))}"</div>` : ''}
    </div>
  `).join('');

  listEl.querySelectorAll('.record-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-session')) return;
      openDetailView(card.dataset.id);
    });
  });

  listEl.querySelectorAll('.btn-delete-session').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('이 임장 기록을 삭제할까요?')) {
        await Storage.deleteSession(btn.dataset.id);
        showToast('삭제되었습니다.', 'info');
        renderRecords(query);
      }
    });
  });
}

// ── 상세 뷰 ──────────────────────────────────────────────────

async function openDetailView(sessionId) {
  const session = await Storage.getSession(sessionId);
  const markers = await Storage.getMarkersBySession(sessionId);

  State.currentDetailSession = session;
  State.currentDetailMarkers = markers;

  // 헤더
  document.getElementById('detail-title').textContent = session.regionName || session.complexName || '-';
  document.getElementById('detail-date').textContent  = formatDate(session.startTime);

  // 통계
  const duration = session.endTime ? Tracker.formatDuration(session.endTime - session.startTime) : '-';
  document.getElementById('detail-stat-dist').textContent     = session.totalDistance ? Tracker.formatDistance(session.totalDistance) : '-';
  document.getElementById('detail-stat-duration').textContent = duration;
  document.getElementById('detail-stat-markers').textContent  = markers.length;
  document.getElementById('detail-stat-rating').textContent   = session.overallRating ? '⭐'.repeat(session.overallRating) : '-';

  // 종합 메모
  const memoEl = document.getElementById('detail-memo');
  memoEl.textContent = session.memo || '종합 메모 없음';
  memoEl.style.color = session.memo ? '#374151' : '#9CA3AF';

  // 마커 타임라인
  renderDetailTimeline(markers);

  showView('detail');

  // 지도 초기화 (뷰 전환 후)
  setTimeout(() => {
    MapManager.initDetailMap('detail-map', session, markers, (m) => showDetailMarkerPopup(m));
  }, 150);
}

function renderDetailTimeline(markers) {
  const listEl = document.getElementById('detail-timeline');
  if (markers.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><p>추가된 기록이 없습니다.</p></div>';
    return;
  }

  listEl.innerHTML = markers.map((m) => {
    const cfg = MapManager.MARKER_ICONS[m.type] || MapManager.MARKER_ICONS.note;
    const time = new Date(m.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const preview = buildMarkerPreview(m);
    return `
      <div class="timeline-item" data-id="${m.id}">
        <div class="timeline-icon" style="background:${cfg.color}">${cfg.emoji}</div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-type">${cfg.label}</span>
            <span class="timeline-time">${time}</span>
          </div>
          <div class="timeline-preview">${preview}</div>
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.timeline-item').forEach((item) => {
    item.addEventListener('click', () => {
      const m = State.currentDetailMarkers.find((mk) => mk.id === item.dataset.id);
      if (m) {
        MapManager.panDetailTo(m.lat, m.lng);
        showDetailMarkerPopup(m);
      }
    });
  });
}

function buildMarkerPreview(m) {
  if (m.type === 'note')  return escapeHtml((m.text || '').slice(0, 80));
  if (m.type === 'photo') return `📷 사진 ${(m.photos || []).length}장${m.caption ? ` · ${escapeHtml(m.caption.slice(0,40))}` : ''}`;
  if (m.type === 'voice') return '🎙️ 음성 메모';
  if (m.type === 'apt') {
    const a = m.aptData || {};
    const parts = [];
    if (a.complexName) parts.push(a.complexName);
    if (a.dong)        parts.push(`${a.dong}동`);
    if (a.floor)       parts.push(`${a.floor}층`);
    if (a.size)        parts.push(`${a.size}평`);
    if (a.price)       parts.push(`매매 ${a.price}`);
    return parts.join(' · ') || '매물 정보';
  }
  if (m.type === 'rate') {
    const r = m.ratings || {};
    const avg = Object.values(r).length
      ? (Object.values(r).reduce((a, b) => a + b, 0) / Object.values(r).length).toFixed(1)
      : '-';
    return `평균 평점 ${avg}점`;
  }
  return '';
}

// ── 마커 팝업 (상세 뷰) ──────────────────────────────────────

function showDetailMarkerPopup(marker) {
  const cfg  = MapManager.MARKER_ICONS[marker.type] || MapManager.MARKER_ICONS.note;
  const time = new Date(marker.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  let bodyHtml = '';

  if (marker.type === 'note') {
    bodyHtml = `<p class="popup-text">${escapeHtml(marker.text || '')}</p>`;
  } else if (marker.type === 'photo') {
    const imgs = (marker.photos || []).map((url) =>
      `<img src="${url}" class="popup-photo" />`
    ).join('');
    bodyHtml = `
      <div class="popup-photos">${imgs}</div>
      ${marker.caption ? `<p class="popup-caption">${escapeHtml(marker.caption)}</p>` : ''}`;
  } else if (marker.type === 'apt') {
    const a = marker.aptData || {};
    bodyHtml = `
      <table class="popup-table">
        ${a.complexName ? row('단지명', a.complexName) : ''}
        ${row('동/호', a.dong ? `${a.dong}동` : '-')}
        ${row('층수', a.floor ? `${a.floor}층` : '-')}
        ${row('평형', a.size ? `${a.size}평` : '-')}
        ${row('매매가', a.price || '-')}
        ${row('전세가', a.jeonse || '-')}
        ${row('방향', a.direction || '-')}
      </table>
      ${a.notes ? `<p class="popup-text">${escapeHtml(a.notes)}</p>` : ''}`;
  } else if (marker.type === 'rate') {
    const r = marker.ratings || {};
    const labels = {
      transport: '교통', school: '학군', amenities: '편의시설',
      noise: '소음', parking: '주차', sunlight: '일조량', view: '조망'
    };
    bodyHtml = `
      <div class="popup-ratings">
        ${Object.entries(r).map(([k, v]) =>
          `<div class="rating-row">
            <span class="rating-label">${labels[k] || k}</span>
            <div class="rating-bar-wrap"><div class="rating-bar" style="width:${v*20}%"></div></div>
            <span class="rating-val">${v}</span>
          </div>`
        ).join('')}
      </div>
      ${marker.rateNote ? `<p class="popup-text">${escapeHtml(marker.rateNote)}</p>` : ''}`;
  } else if (marker.type === 'voice') {
    bodyHtml = marker.audioDataUrl
      ? `<audio controls src="${marker.audioDataUrl}" class="popup-audio"></audio>`
      : '<p>음성 파일을 불러올 수 없습니다.</p>';
  }

  document.getElementById('popup-icon').textContent  = cfg.emoji;
  document.getElementById('popup-type').textContent  = cfg.label;
  document.getElementById('popup-time').textContent  = time;
  document.getElementById('popup-body').innerHTML    = bodyHtml;
  document.getElementById('popup-marker-id').value  = marker.id;
  document.getElementById('modal-marker-popup').classList.add('active');
}

function closeDetailMarkerPopup() {
  document.getElementById('modal-marker-popup').classList.remove('active');
}

async function deleteCurrentMarker() {
  const id = document.getElementById('popup-marker-id').value;
  if (!id) return;
  if (!confirm('이 기록을 삭제할까요?')) return;

  await Storage.deleteMarker(id);
  State.currentDetailMarkers = State.currentDetailMarkers.filter((m) => m.id !== id);

  // 세션 마커 수 업데이트
  if (State.currentDetailSession) {
    State.currentDetailSession.markerCount = State.currentDetailMarkers.length;
    await Storage.saveSession(State.currentDetailSession);
  }

  closeDetailMarkerPopup();
  renderDetailTimeline(State.currentDetailMarkers);
  showToast('삭제되었습니다.', 'info');
}

// ── 추적 중 마커 팝업 (간단) ─────────────────────────────────

function showTrackMarkerDetail(marker) {
  const cfg = MapManager.MARKER_ICONS[marker.type] || MapManager.MARKER_ICONS.note;
  showToast(`${cfg.emoji} ${cfg.label} 기록`, 'info');
}

// ── 별점 표시 ────────────────────────────────────────────────

function updateStarDisplay(val) {
  document.getElementById('star-display').textContent = val > 0 ? '⭐'.repeat(val) : '미평가';
}

// ── 유틸 ─────────────────────────────────────────────────────

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2800);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
}

function row(label, value) {
  return `<tr><td class="td-label">${label}</td><td class="td-val">${escapeHtml(value)}</td></tr>`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(blob);
  });
}

// ── 이벤트 리스너 등록 ───────────────────────────────────────

function bindEvents() {
  // 네비게이션
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const view = btn.dataset.view;
      if (view === 'records') await renderRecords();
      showView(view);
    });
  });

  // 홈
  document.getElementById('btn-new-session').addEventListener('click', openNewSessionModal);
  document.getElementById('btn-cancel-session').addEventListener('click', closeNewSessionModal);
  document.getElementById('btn-start-session').addEventListener('click', startSession);
  document.getElementById('input-region-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startSession();
  });

  // 추적 컨트롤
  document.getElementById('btn-add-marker').addEventListener('click', openMarkerModal);
  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-end-session').addEventListener('click', confirmEndSession);

  // 임장 종료 모달
  document.getElementById('btn-cancel-end').addEventListener('click', cancelEndSession);
  document.getElementById('btn-confirm-end').addEventListener('click', endSession);
  document.getElementById('overall-rating').addEventListener('input', (e) => {
    updateStarDisplay(parseInt(e.target.value));
  });

  // 마커 모달
  document.getElementById('btn-close-marker').addEventListener('click', closeMarkerModal);
  document.getElementById('btn-save-marker').addEventListener('click', saveMarker);
  document.querySelectorAll('.marker-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchMarkerTab(tab.dataset.type));
  });

  // 사진 입력
  document.getElementById('input-photo').addEventListener('change', (e) => {
    handlePhotoSelect(e.target.files);
  });

  // 음성 녹음
  document.getElementById('btn-record-audio').addEventListener('click', toggleAudioRecording);

  // 평가 슬라이더
  document.querySelectorAll('.rating-slider').forEach((slider) => {
    slider.addEventListener('input', () => {
      slider.nextElementSibling.textContent = slider.value;
    });
  });

  // 마커 팝업 닫기
  document.getElementById('btn-close-popup').addEventListener('click', closeDetailMarkerPopup);
  document.getElementById('btn-delete-marker').addEventListener('click', deleteCurrentMarker);

  // 상세 뷰 뒤로가기
  document.getElementById('btn-detail-back').addEventListener('click', async () => {
    await renderRecords();
    showView('records');
  });

  // 기록 검색
  document.getElementById('records-search').addEventListener('input', (e) => {
    renderRecords(e.target.value);
  });

  // 모달 외부 클릭으로 닫기
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal && modal.id !== 'modal-marker' && modal.id !== 'modal-end-session') {
        modal.classList.remove('active');
      }
    });
  });
}

// ── 앱 초기화 ────────────────────────────────────────────────

async function init() {
  try {
    await Storage.init();
    bindEvents();
    await renderHome();
    showView('home');
  } catch (e) {
    console.error('초기화 실패:', e);
    document.body.innerHTML = `<div style="padding:2rem;text-align:center;color:#EF4444">
      <h2>앱 초기화에 실패했습니다.</h2>
      <p>${e.message}</p>
    </div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
