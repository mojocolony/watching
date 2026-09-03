const CACHE_KEY = 'watching:snapshot:v1';

function safeStorage(storage) {
  return storage ?? globalThis.localStorage;
}

export function readCachedSnapshot(storage) {
  const target = safeStorage(storage);
  try {
    const raw = target?.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.shows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedSnapshot(snapshot, storage) {
  const target = safeStorage(storage);
  target?.setItem(CACHE_KEY, JSON.stringify(snapshot));
}

export function clearCachedSnapshot(storage) {
  safeStorage(storage)?.removeItem(CACHE_KEY);
}
