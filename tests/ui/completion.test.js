import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCompletionSheet, archiveShowLocally, startNextSeasonLocally } from '../../src/ui/completion.js';

const show = {
  id: 's1', title: 'Slow Horses', section: 'watching', sortOrder: 0,
  currentSeason: 6, archivedAt: null, availableSeasonNumber: null,
  seasons: [{ seasonNumber: 6 }], episodes: [{ id: 'e1', watched: true }],
};

test('completion sheet offers three choices when another season exists', () => {
  const html = renderCompletionSheet(show, 7);
  assert.match(html, /Watch next season/);
  assert.match(html, /Queue next season/);
  assert.match(html, /Archive for now/);
});

test('completion sheet offers archive only when no next season exists', () => {
  const html = renderCompletionSheet(show, null);
  assert.doesNotMatch(html, /Watch next season/);
  assert.doesNotMatch(html, /Queue next season/);
  assert.match(html, />Archive</);
});

test('local archive stamps completion and changes section', () => {
  const next = archiveShowLocally(show, '2026-09-03T22:00:00Z');
  assert.equal(next.section, 'archived');
  assert.equal(next.archivedAt, '2026-09-03T22:00:00Z');
  assert.equal(next.seasons[0].completedAt, '2026-09-03T22:00:00Z');
});

test('starting next season resets episodes and moves to chosen section', () => {
  const next = startNextSeasonLocally(show, {
    season: { sourceSeasonId: 70, seasonNumber: 7 },
    episodes: [{ sourceEpisodeId: 700, episodeNumber: 1, title: 'One', runtimeMinutes: 51, airdate: null }],
    section: 'queued',
  });
  assert.equal(next.section, 'queued');
  assert.equal(next.currentSeason, 7);
  assert.equal(next.archivedAt, null);
  assert.equal(next.episodes[0].watched, false);
  assert.equal(next.episodes[0].runtimeMinutes, 51);
});

test('local unfinished archive preserves progress without marking season complete', () => {
  const unfinished = { ...show, episodes: [{ id: 'e1', watched: false }] };
  const next = archiveShowLocally(unfinished, '2026-09-03T22:00:00Z', { completed: false });
  assert.equal(next.section, 'archived');
  assert.equal(next.archivedAt, '2026-09-03T22:00:00Z');
  assert.equal(next.seasons[0].completedAt ?? null, null);
  assert.equal(next.episodes[0].watched, false);
});
