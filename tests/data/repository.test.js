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
        { id: 'e2', source_episode_id: 202, episode_number: 2, title: 'Two', runtime_minutes: 51, airdate: null, watched: false },
        { id: 'e1', source_episode_id: 201, episode_number: 1, title: 'One', runtime_minutes: 48, airdate: '2026-09-01', watched: true },
      ],
    }],
  });
  assert.equal(result.withPriya, true);
  assert.equal(result.totalSeasons, 5);
  assert.equal(result.episodes[0].id, 'e1');
  assert.equal(result.episodes[0].runtimeMinutes, 48);
});

test('metadata episode updates never include watched', () => {
  const payload = toMetadataEpisodeUpdate({ title: 'Real title', runtimeMinutes: 52, airdate: '2026-09-10', watched: false });
  assert.deepEqual(payload, { title: 'Real title', runtime_minutes: 52, airdate: '2026-09-10', updated_at: payload.updated_at });
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
