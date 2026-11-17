// Tiny IndexedDB key-value cache (falls back to memory when IndexedDB is unavailable).
const mem = new Map(); let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    try { const r = indexedDB.open('chronos', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }
    catch { res(null); }
  });
  return dbp;
}
export async function cacheGet(key) {
  if (mem.has(key)) return mem.get(key);
  const d = await db(); if (!d) return undefined;
  return new Promise(res => { try { const q = d.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => { if (q.result !== undefined) mem.set(key, q.result); res(q.result); }; q.onerror = () => res(undefined); } catch { res(undefined); } });
}
export async function cacheSet(key, val) {
  mem.set(key, val); const d = await db(); if (!d) return;
  try { d.transaction('kv', 'readwrite').objectStore('kv').put(val, key); } catch { /* quota or private mode: memory only */ }
}
export const prefs = {
  get(k, def) { try { const v = localStorage.getItem('chronos.' + k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem('chronos.' + k, JSON.stringify(v)); } catch { /* ignore */ } }
};
