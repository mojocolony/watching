import test from 'node:test';
import assert from 'node:assert/strict';
import { mapDbShow, toMetadataEpisodeUpdate, toPlacementUpdate } from '../../src/data/repository.js';

test('maps nested database show to UI shape ordered by episode number', () => {
  const result = mapDbShow({
    id: 's1', source: 'tvmaze', source_show_id: 12, source_updated_at: 100,
    title: 'Slow Horses', section: 'watching', sort_order: 1, with_priya: true,
    current_season: 3, total_seasons: 5, available_season_number: null, archived_at: null,
    watching_seasons: [{
      id: 'season', source_season_id: 50, season_number: 3, completed_at: null,
      watching_episodes: [
        { id: 'e2', source_episode_id: 202, episode_number: 2, title: 'Two', runtime_minutes: 51, airdate: null, summary: 'A synopsis', watched: false },
        { id: 'e1', source_episode_id: 201, episode_number: 1, title: 'One', runtime_minutes: 48, airdate: '2026-09-01', watched: true },
      ],
    }],
  });
  assert.equal(result.withPriya, true);
  assert.equal(result.totalSeasons, 5);
  assert.equal(result.episodes[0].id, 'e1');
  assert.equal(result.episodes[0].runtimeMinutes, 48);
  assert.equal(result.episodes[1].summary, 'A synopsis');
});

test('metadata episode updates never include watched', () => {
  const payload = toMetadataEpisodeUpdate({ title: 'Real title', runtimeMinutes: 52, airdate: '2026-09-10', summary: 'A synopsis', watched: false });
  assert.deepEqual(payload, { title: 'Real title', runtime_minutes: 52, airdate: '2026-09-10', summary: 'A synopsis', updated_at: payload.updated_at });
  assert.equal('watched' in payload, false);
});

test('placement update writes only placement fields plus timestamp', () => {
  const payload = toPlacementUpdate({ id: 'a', section: 'queued', sortOrder: 4, title: 'Ignored' });
  assert.equal(payload.id, 'a');
  assert.equal(payload.section, 'queued');
  assert.equal(payload.sort_order, 4);
  assert.equal('title' in payload, false);
});

test('show insert/update mapping carries total season count', () => {
  const result = mapDbShow({
    id: 's1', source: 'tvmaze', source_show_id: 12, source_updated_at: null,
    title: 'Show', section: 'queued', sort_order: 0, with_priya: false,
    current_season: 1, total_seasons: 4, available_season_number: null, archived_at: null,
    watching_seasons: [],
  });
  assert.equal(result.totalSeasons, 4);
});

test('season episode upserts preserve an existing watched value by omitting watched from conflict updates', async () => {
  const { toSeasonEpisodeUpsert } = await import('../../src/data/repository.js');
  const row = toSeasonEpisodeUpsert('season-1', {
    sourceEpisodeId: 77,
    episodeNumber: 2,
    title: 'Two',
    runtimeMinutes: 51,
    airdate: '2026-09-03',
    watched: true,
  });
  assert.deepEqual(row, {
    season_id: 'season-1',
    source_episode_id: 77,
    episode_number: 2,
    title: 'Two',
    runtime_minutes: 51,
    airdate: '2026-09-03',
    summary: null,
  });
  assert.equal('watched' in row, false);
});

test('season upsert does not clear an existing completion date when switching back to a season', async () => {
  const { toSeasonUpsert } = await import('../../src/data/repository.js');
  const row = toSeasonUpsert('show-1', { sourceSeasonId: 101, seasonNumber: 1 });
  assert.deepEqual(row, {
    show_id: 'show-1',
    source_season_id: 101,
    season_number: 1,
  });
  assert.equal('completed_at' in row, false);
});

test('maps Set Aside timestamp without modifying episode watched state', () => {
  const show = mapDbShow({
    id: 's2', title: 'Paused', section: 'set_aside', sort_order: 1,
    current_season: 1, set_aside_at: '2026-10-22T12:00:00Z',
    watching_seasons: [{ id: 'season2', season_number: 1, watching_episodes: [{ id: 'e3', episode_number: 1, title: 'Pilot', watched: true, summary: 'Plot' }] }],
  });
  assert.equal(show.setAsideAt, '2026-10-22T12:00:00Z');
  assert.equal(show.episodes[0].watched, true);
  assert.equal(show.episodes[0].summary, 'Plot');
});


test('metadata persistence batches six newly announced episodes without resetting watched progress', async () => {
  const { createRepository } = await import('../../src/data/repository.js');
  const existingId = 'd520ae17-1e87-4264-8f88-74a4122deaaa';
  const existingEpisode = {
    id: existingId, episodeNumber: 1, sourceEpisodeId: 3713680,
    title: 'First', runtimeMinutes: 60, airdate: '2026-11-01', summary: 'Known', watched: true,
  };
  const previous = { episodes: [existingEpisode] };
  const next = {
    id: 'show', section: 'watching', currentSeason: 4,
    totalSeasons: 4, sourceUpdatedAt: 123, availableSeasonNumber: null,
    seasons: [{ seasonNumber: 4, sourceSeasonId: 189204 }],
    episodes: [
      { ...existingEpisode },
      ...Array.from({ length: 6 }, (_, i) => ({
        id: 'temporary-' + i, episodeNumber: i + 2, sourceEpisodeId: 3800000 + i,
        title: 'New ' + (i + 2), runtimeMinutes: 60,
        airdate: null, summary: null, watched: false,
      })),
    ],
  };
  let batch = null;
  let updateCalls = 0;
  const client = {
    from(table) {
      if (table === 'watching_shows') return {
        update: () => ({ eq: async () => ({ error: null }) }),
      };
      if (table === 'watching_seasons') return {
        upsert: () => ({
          select: () => ({ single: async () => ({ data: { id: 'season-db' }, error: null }) }),
        }),
      };
      if (table === 'watching_episodes') return {
        update: () => ({
          eq: async () => { updateCalls += 1; return { error: null }; },
        }),
        upsert: (rows, options) => {
          batch = { rows, options };
          return { select: async () => ({
            data: rows.map((row, i) => ({ id: 'persisted-' + i, episode_number: row.episode_number })),
            error: null,
          }) };
        },
      };
      throw new Error('Unexpected table: ' + table);
    },
  };
  const persisted = await createRepository(client).mergeFetchedMetadata('show', next, previous);
  assert.equal(updateCalls, 0, 'unchanged watched episode must not be updated');
  assert.equal(batch.rows.length, 6, 'new episodes should be inserted together');
  assert.equal(batch.options.onConflict, 'season_id,episode_number');
  assert.equal(batch.options.ignoreDuplicates, true);
  assert.equal(batch.options.defaultToNull, false);
  assert.equal(batch.rows.some(row => 'watched' in row), false);
  assert.equal(persisted.episodes.length, 7);
  assert.equal(persisted.episodes[0].id, existingId);
  assert.equal(persisted.episodes[0].watched, true);
  assert.equal(persisted.episodes[6].id, 'persisted-5');
});
