/**
 * storage.js
 * IndexedDB 기반 로컬 데이터 저장소
 */
const DB_NAME = 'imgangr_db';
const DB_VERSION = 1;

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const Storage = {
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }

        if (!db.objectStoreNames.contains('markers')) {
          const m = db.createObjectStore('markers', { keyPath: 'id' });
          m.createIndex('sessionId', 'sessionId', { unique: false });
        }
      };
    });
  },

  async saveSession(session) {
    const tx = this.db.transaction('sessions', 'readwrite');
    await promisifyRequest(tx.objectStore('sessions').put(session));
  },

  async getSessions() {
    const tx = this.db.transaction('sessions', 'readonly');
    const sessions = await promisifyRequest(tx.objectStore('sessions').getAll());
    return sessions.sort((a, b) => b.startTime - a.startTime);
  },

  async getSession(id) {
    const tx = this.db.transaction('sessions', 'readonly');
    return promisifyRequest(tx.objectStore('sessions').get(id));
  },

  async deleteSession(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['sessions', 'markers'], 'readwrite');
      tx.objectStore('sessions').delete(id);

      const markerStore = tx.objectStore('markers');
      const req = markerStore.index('sessionId').openCursor(IDBKeyRange.only(id));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async saveMarker(marker) {
    const tx = this.db.transaction('markers', 'readwrite');
    await promisifyRequest(tx.objectStore('markers').put(marker));
  },

  async getMarkersBySession(sessionId) {
    const tx = this.db.transaction('markers', 'readonly');
    const markers = await promisifyRequest(
      tx.objectStore('markers').index('sessionId').getAll(IDBKeyRange.only(sessionId))
    );
    return markers.sort((a, b) => a.timestamp - b.timestamp);
  },

  async deleteMarker(id) {
    const tx = this.db.transaction('markers', 'readwrite');
    await promisifyRequest(tx.objectStore('markers').delete(id));
  },
};
