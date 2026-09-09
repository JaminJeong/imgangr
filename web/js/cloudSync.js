/**
 * cloudSync.js
 * 구글 로그인(Google Identity Services), 구글 드라이브 백업/복원,
 * 그리고 드라이브를 쓸 수 없을 때의 대체 저장 방식(JSON 내보내기/가져오기,
 * File System Access API)을 제공한다.
 * 상세 배경 및 제약: docs/cloud-sync.md
 */
const DRIVE_BACKUP_FILENAME = 'imgangr-backup.json';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const CloudSync = {
  currentUser: null,
  accessToken: null,
  tokenClient: null,

  isGoogleConfigured() {
    return Boolean(CONFIG.GOOGLE_CLIENT_ID) && typeof google !== 'undefined';
  },

  // ── 구글 로그인 (Google Identity Services) ──────────────────

  initGoogleSignIn(buttonEl) {
    if (!this.isGoogleConfigured()) return;

    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: (response) => this._handleCredential(response),
    });
    if (buttonEl) {
      google.accounts.id.renderButton(buttonEl, { type: 'standard', theme: 'outline', size: 'large', width: 260 });
    }

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: () => {}, // requestDriveAccess()가 호출 시점에 교체
    });
  },

  _handleCredential(response) {
    const payload = JSON.parse(atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    this.currentUser = { email: payload.email, name: payload.name, picture: payload.picture };
    if (typeof onCloudSyncUserChanged === 'function') onCloudSyncUserChanged();
  },

  signOut() {
    this.currentUser = null;
    this.accessToken = null;
    if (typeof google !== 'undefined') google.accounts.id.disableAutoSelect();
    if (typeof onCloudSyncUserChanged === 'function') onCloudSyncUserChanged();
  },

  // ── 드라이브 액세스 토큰 ──────────────────────────────────────

  requestDriveAccess() {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) { reject(new Error('구글 로그인이 필요합니다.')); return; }
      this.tokenClient.callback = (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        this.accessToken = resp.access_token;
        resolve(resp.access_token);
      };
      this.tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
    });
  },

  // ── 백업 데이터 조립/복원 (공용) ─────────────────────────────

  async _buildBackupPayload() {
    const sessions = await Storage.getSessions();
    const markerLists = await Promise.all(sessions.map((s) => Storage.getMarkersBySession(s.id)));
    return { version: 1, exportedAt: Date.now(), sessions, markers: markerLists.flat() };
  },

  async _restoreBackupPayload(backup) {
    if (!backup || !Array.isArray(backup.sessions)) {
      throw new Error('올바른 백업 파일이 아닙니다.');
    }
    for (const session of backup.sessions) await Storage.saveSession(session);
    for (const marker of backup.markers || []) await Storage.saveMarker(marker);
  },

  // ── 구글 드라이브 백업/복원 (drive.appdata) ──────────────────

  async _findDriveBackupFileId(accessToken) {
    const url = `${DRIVE_FILES_URL}?spaces=appDataFolder&q=${encodeURIComponent(`name='${DRIVE_BACKUP_FILENAME}'`)}&fields=files(id)`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Drive 조회 실패 (${res.status})`);
    const data = await res.json();
    return data.files && data.files[0] ? data.files[0].id : null;
  },

  async backupToDrive() {
    const accessToken = await this.requestDriveAccess();
    const backup = await this._buildBackupPayload();
    const existingId = await this._findDriveBackupFileId(accessToken);

    const metadata = existingId ? {} : { name: DRIVE_BACKUP_FILENAME, parents: ['appDataFolder'] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(backup)], { type: 'application/json' }));

    const url = existingId
      ? `${DRIVE_UPLOAD_URL}/${existingId}?uploadType=multipart`
      : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;

    const res = await fetch(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Drive 업로드 실패 (${res.status})`);
    return backup;
  },

  async restoreFromDrive() {
    const accessToken = await this.requestDriveAccess();
    const fileId = await this._findDriveBackupFileId(accessToken);
    if (!fileId) throw new Error('구글 드라이브에서 백업 파일을 찾을 수 없습니다.');

    const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Drive 다운로드 실패 (${res.status})`);
    const backup = await res.json();
    await this._restoreBackupPayload(backup);
    return backup;
  },

  // ── 대체 수단 1: 로컬 JSON 내보내기/가져오기 ─────────────────

  async exportJson() {
    const backup = await this._buildBackupPayload();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `imgangr-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  async importJsonFile(file) {
    const text = await file.text();
    const backup = JSON.parse(text);
    await this._restoreBackupPayload(backup);
    return backup;
  },

  // ── 대체 수단 2: File System Access API (Chromium 전용) ──────

  isFileSystemAccessSupported() {
    return typeof window.showDirectoryPicker === 'function';
  },

  async exportToLocalFolder() {
    if (!this.isFileSystemAccessSupported()) {
      throw new Error('이 브라우저는 로컬 폴더 저장을 지원하지 않습니다.');
    }
    const dirHandle = await window.showDirectoryPicker();
    const backup = await this._buildBackupPayload();
    const fileHandle = await dirHandle.getFileHandle(DRIVE_BACKUP_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(backup, null, 2));
    await writable.close();
  },
};
