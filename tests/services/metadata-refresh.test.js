import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTrackedShowMetadata, refreshTrackedMetadata, selectUpdateWindow } from '../../src/services/metadata-refresh.js';

const active = {
  id: 's1', source: 'tvmaze', sourceShowId: 12, sourceUpdatedAt: 10,
  title: 'Show', section: 'watching', sortOrder: 2, withPriya: true, currentSeason: 1,
  episodes: [
    { id: 'local-e1', sourceEpisodeId: 101, episodeNumber: 1, title: 'TBA', runtimeMinutes: null, watched: true, airdate: null },
  ],
  seasons: [{ sourceSeasonId: 500, seasonNumber: 1 }],
};

test('selects TVmaze update windows by elapsed time', () => {
  const now = new Date('2026-09-03T12:00:00Z');
  assert.equal(selectUpdateWindow(new Date('2026-09-03T00:00:00Z'), now), 'day');
  assert.equal(selectUpdateWindow(new Date('2026-08-30T00:00:00Z'), now), 'week');
  assert.equal(selectUpdateWindow(new Date('2026-08-10T00:00:00Z'), now), 'month');
  assert.equal(selectUpdateWindow(new Date('2026-07-01T00:00:00Z'), now), null);
  assert.equal(selectUpdateWindow(null, now), null);
});

test('merges newly announced episode and metadata without changing user state', () => {
  const merged = mergeTrackedShowMetadata(active,
    [{ sourceSeasonId: 500, seasonNumber: 1 }],
    [
      { sourceEpisodeId: 101, episodeNumber: 1, title: 'The Real Title', runtimeMinutes: 52, airdate: '2026-09-01' },
      { sourceEpisodeId: 102, episodeNumber: 2, title: 'Two', runtimeMinutes: 48, airdate: '2026-09-08' },
    ]);
  assert.equal(merged.section, 'watching');
  assert.equal(merged.sortOrder, 2);
  assert.equal(merged.withPriya, true);
  assert.equal(merged.episodes[0].watched, true);
  assert.equal(merged.episodes[0].title, 'The Real Title');
  assert.equal(merged.episodes[0].runtimeMinutes, 52);
  assert.equal(merged.episodes[1].watched, false);
});

test('archived show gets a new-season marker without moving sections', () => {
  const archived = { ...active, section: 'archived', currentSeason: 1, episodes: [] };
  const merged = mergeTrackedShowMetadata(archived, [
    { sourceSeasonId: 500, seasonNumber: 1 },
    { sourceSeasonId: 600, seasonNumber: 2 },
  ], []);
  assert.equal(merged.section, 'archived');
  assert.equal(merged.availableSeasonNumber, 2);
});

test('manual shows are not sent to TVmaze', async () => {
  let seasonsCalls = 0;
  const result = await refreshTrackedMetadata({
    shows: [{ ...active, id: 'm1', source: 'manual', sourceShowId: null }],
    lastCheckedAt: null,
    now: new Date('2026-09-03T12:00:00Z'),
    tvmaze: {
      getShowSeasons: async () => { seasonsCalls += 1; return []; },
      getSeasonEpisodes: async () => [],
      getRecentShowUpdates: async () => ({}),
    },
  });
  assert.equal(seasonsCalls, 0);
  assert.equal(result.shows[0].source, 'manual');
});

test('refresh failure preserves old data', async () => {
  const result = await refreshTrackedMetadata({
    shows: [active], lastCheckedAt: null, now: new Date('2026-09-03T12:00:00Z'),
    tvmaze: {
      getShowSeasons: async () => { throw new Error('down'); },
      getSeasonEpisodes: async () => [],
      getRecentShowUpdates: async () => ({}),
    },
  });
  assert.deepEqual(result.shows[0], active);
});

test('metadata merge preserves database season identity and completion history', () => {
  const show = {
    ...active,
    seasons: [{ id: 'db-season-1', sourceSeasonId: 500, seasonNumber: 1, completedAt: '2026-08-01T12:00:00Z' }],
  };
  const merged = mergeTrackedShowMetadata(show,
    [{ sourceSeasonId: 500, seasonNumber: 1, premiereDate: '2026-07-01', endDate: '2026-08-01' }],
    show.episodes);
  assert.equal(merged.seasons[0].id, 'db-season-1');
  assert.equal(merged.seasons[0].completedAt, '2026-08-01T12:00:00Z');
  assert.equal(merged.seasons[0].premiereDate, '2026-07-01');
});

test('refresh uses repository-persisted ids for newly discovered episodes', async () => {
  const result = await refreshTrackedMetadata({
    shows: [active],
    lastCheckedAt: null,
    now: new Date('2026-09-03T12:00:00Z'),
    tvmaze: {
      getShowSeasons: async () => [{ sourceSeasonId: 500, seasonNumber: 1 }],
      getSeasonEpisodes: async () => [
        { sourceEpisodeId: 101, episodeNumber: 1, title: 'One', runtimeMinutes: 52, airdate: null },
        { sourceEpisodeId: 102, episodeNumber: 2, title: 'Two', runtimeMinutes: 48, airdate: null },
      ],
      getRecentShowUpdates: async () => ({}),
    },
    repository: {
      mergeFetchedMetadata: async (_showId, next) => ({
        ...next,
        episodes: next.episodes.map(ep => ep.sourceEpisodeId === 102 ? { ...ep, id: 'db-e2' } : ep),
      }),
    },
  });
  const newEpisode = result.shows[0].episodes.find(ep => ep.sourceEpisodeId === 102);
  assert.equal(newEpisode.id, 'db-e2');
});
