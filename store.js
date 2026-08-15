/* ============================================================
   Store — IndexedDB persistence
   The only module that talks to the database. Everything else
   goes through these functions.
   ============================================================ */

'use strict';

const DB_NAME = 'cupping-qc';
const DB_VERSION = 2;

const STORE_KV = 'kv';              // working session, vault dir handle
const STORE_SESSIONS = 'sessions';  // archived sessions

let dbPromise = null;

function db() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE_KV)) d.createObjectStore(STORE_KV);
      if (!d.objectStoreNames.contains(STORE_SESSIONS)) d.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function tx(storeName, mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(storeName, mode);
    const req = fn(t.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

/* Storage failures must never take the app down mid-cupping — they degrade
   to in-memory operation, and the UI reports that saving stopped working. */
const warn = label => err => { console.warn(`[store] ${label} failed`, err); return null; };

const kvGet = key => tx(STORE_KV, 'readonly', s => s.get(key)).catch(warn('read'));
const kvSet = (key, value) => tx(STORE_KV, 'readwrite', s => s.put(value, key)).catch(warn('write'));

const sessionsAll    = () => tx(STORE_SESSIONS, 'readonly',  s => s.getAll()).catch(() => []);
const sessionPut     = rec => tx(STORE_SESSIONS, 'readwrite', s => s.put(rec)).catch(warn('archive'));
const sessionDelete  = id  => tx(STORE_SESSIONS, 'readwrite', s => s.delete(id)).catch(warn('delete'));

/** True when IndexedDB is usable at all. file:// origins sometimes block it. */
async function storageAvailable() {
  try {
    await kvSet('__probe', Date.now());
    return true;
  } catch {
    return false;
  }
}
