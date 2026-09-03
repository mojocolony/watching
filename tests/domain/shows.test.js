import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSeasonProgress,
  isSeasonComplete,
  mergeEpisodeMetadata,
  toggleEpisodeWatched,
  getNextSeasonNumber,
} from '../../src/domain/shows.js';

const show = {
  id: 'show-1',
  currentSeason: 2,
  seasons: [{ seasonNumber: 3 }],
  episodes: [
    { id: 'e1', watched: true, title: 'One', runtimeMinutes: 44 },
    { id: 'e2', watched: false, title: 'Two', runtimeMinutes: null },
  ],
};

test('calculates season progress', () => {
  assert.deepEqual(getSeasonProgress(show), { watched: 1, total: 2 });
});

test('toggles watched state without mutating input', () => {
  const next = toggleEpisodeWatched(show, 'e2');
  assert.equal(next.episodes[1].watched, true);
  assert.equal(show.episodes[1].watched, false);
});

test('detects season completion', () => {
  assert.equal(isSeasonComplete(show), false);
  assert.equal(isSeasonComplete(toggleEpisodeWatched(show, 'e2')), true);
});

test('merges source metadata while preserving watched state', () => {
  const existing = { id: 'e2', watched: true, title: 'TBA', runtimeMinutes: null };
  const incoming = { id: 'e2', watched: false, title: 'Reckoning', runtimeMinutes: 52 };
  assert.deepEqual(mergeEpisodeMetadata(existing, incoming), {
    id: 'e2', watched: true, title: 'Reckoning', runtimeMinutes: 52,
  });
});

test('finds the next numbered season', () => {
  assert.equal(getNextSeasonNumber(show), 3);
  assert.equal(getNextSeasonNumber({ ...show, seasons: [{ seasonNumber: 5 }] }), null);
});
