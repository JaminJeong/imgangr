/**
 * storage.js
 * IndexedDB 기반 로컬 데이터 저장소
 */
const DB_NAME = 'imgangr_db';
const DB_VERSION = 1;

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
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('sessions', 'readwrite');
      const req = tx.objectStore('sessions').put(session);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getSessions() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('sessions', 'readonly');
      const req = tx.objectStore('sessions').getAll();
      req.onsuccess = () =>
        resolve(req.result.sort((a, b) => b.startTime - a.startTime));
      req.onerror = () => reject(req.error);
    });
  },

  async getSession(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('sessions', 'readonly');
      const req = tx.objectStore('sessions').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
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
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('markers', 'readwrite');
      const req = tx.objectStore('markers').put(marker);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getMarkersBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('markers', 'readonly');
      const req = tx.objectStore('markers')
        .index('sessionId')
        .getAll(IDBKeyRange.only(sessionId));
      req.onsuccess = () =>
        resolve(req.result.sort((a, b) => a.timestamp - b.timestamp));
      req.onerror = () => reject(req.error);
    });
  },

  async deleteMarker(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('markers', 'readwrite');
      const req = tx.objectStore('markers').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};
