/**
 * backup.js
 * 사용자 데이터를 로컬 기기에 저장/복원하고, 메일 등 원하는 앱으로 공유하는 기능.
 * 서버나 외부 계정 없이 각 사용자가 자기 데이터를 직접 보관하는 것이 목적이다.
 * 상세 배경: docs/backup-and-deploy.md
 */
const BACKUP_FILENAME_PREFIX = 'imgangr-backup';

const Backup = {
  // ── 백업 데이터 조립/복원 (공용) ─────────────────────────────

  async buildPayload() {
    const sessions = await Storage.getSessions();
    const markerLists = await Promise.all(sessions.map((s) => Storage.getMarkersBySession(s.id)));
    return { version: 1, exportedAt: Date.now(), sessions, markers: markerLists.flat() };
  },

  async restorePayload(backup) {
    if (!backup || !Array.isArray(backup.sessions)) {
      throw new Error('올바른 백업 파일이 아닙니다.');
    }
    for (const session of backup.sessions) await Storage.saveSession(session);
    for (const marker of backup.markers || []) await Storage.saveMarker(marker);
  },

  _filename() {
    return `${BACKUP_FILENAME_PREFIX}-${new Date().toISOString().slice(0, 10)}.json`;
  },

  async _buildBackupBlob() {
    const backup = await this.buildPayload();
    return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  },

  // ── 로컬 디스크에 저장 / 파일에서 복원 ────────────────────────

  async exportToDownload() {
    const blob = await this._buildBackupBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = this._filename();
    a.click();
    URL.revokeObjectURL(a.href);
  },

  async importFromFile(file) {
    const text = await file.text();
    const backup = JSON.parse(text);
    await this.restorePayload(backup);
    return backup;
  },

  // ── 로컬 동기화 폴더에 저장 (File System Access API, Chromium 전용) ──

  isFileSystemAccessSupported() {
    return typeof window.showDirectoryPicker === 'function';
  },

  async exportToLocalFolder() {
    if (!this.isFileSystemAccessSupported()) {
      throw new Error('이 브라우저는 로컬 폴더 저장을 지원하지 않습니다.');
    }
    const dirHandle = await window.showDirectoryPicker();
    const blob = await this._buildBackupBlob();
    const fileHandle = await dirHandle.getFileHandle(this._filename(), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  },

  // ── 메일 등으로 공유 (Web Share API) ──────────────────────────

  isShareSupported() {
    if (!navigator.canShare) return false;
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return navigator.canShare({ files: [probe] });
  },

  async shareBackup() {
    if (!this.isShareSupported()) {
      throw new Error('이 브라우저/기기는 공유하기를 지원하지 않습니다.');
    }
    const blob = await this._buildBackupBlob();
    const file = new File([blob], this._filename(), { type: 'application/json' });
    await navigator.share({
      files: [file],
      title: '임장기록 백업',
      text: '임장기록 백업 파일입니다. 임장기록 앱의 설정 > JSON 가져오기로 복원할 수 있습니다.',
    });
  },
};
