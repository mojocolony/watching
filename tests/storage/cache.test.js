import test from 'node:test';
import assert from 'node:assert/strict';
import { readCachedSnapshot, writeCachedSnapshot } from '../../src/storage/cache.js';
import { readPreferences, writePreferences } from '../../src/storage/preferences.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}

test('round-trips a cached snapshot', () => {
  const storage = memoryStorage();
  const snapshot = { shows: [{ id: 'a' }], cachedAt: '2026-09-03T12:00:00Z' };
  writeCachedSnapshot(snapshot, storage);
  assert.deepEqual(readCachedSnapshot(storage), snapshot);
});

test('returns null for invalid cached JSON', () => {
  const storage = memoryStorage();
  storage.setItem('watching:snapshot:v1', '{broken');
  assert.equal(readCachedSnapshot(storage), null);
});

test('preferences use the agreed defaults', () => {
  assert.deepEqual(readPreferences(memoryStorage()), {
    fontScale: 'medium',
    watchingCollapsed: false,
    queuedCollapsed: false,
    priyaFilter: false,
  });
});

test('preferences reject invalid scale and preserve booleans', () => {
  const storage = memoryStorage();
  writePreferences({ fontScale: 'huge', watchingCollapsed: true, queuedCollapsed: true, priyaFilter: true }, storage);
  assert.deepEqual(readPreferences(storage), {
    fontScale: 'medium',
    watchingCollapsed: true,
    queuedCollapsed: true,
    priyaFilter: true,
  });
});
