import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSearchResults, renderFetchedSetup, buildFetchedShow } from '../../src/ui/add-show.js';

test('renders normalized TVmaze matches as selectable rows', () => {
  const html = renderSearchResults([
    { sourceShowId: 12, title: 'Slow Horses', premieredYear: '2022', networkLabel: 'Apple TV+' },
  ]);
  assert.match(html, /data-action="select-search-result"/);
  assert.match(html, /Slow Horses/);
  assert.match(html, /2022/);
  assert.match(html, /Apple TV\+/);
});

test('renders season choice plus destination and Priya toggle', () => {
  const html = renderFetchedSetup(
    { sourceShowId: 12, title: 'Slow Horses' },
    [{ sourceSeasonId: 99, seasonNumber: 6 }],
  );
  assert.match(html, /Season 6/);
  assert.match(html, /Now Watching/);
  assert.match(html, /Queued Up/);
  assert.match(html, /With Priya/);
  assert.match(html, /data-action="save-fetched-show"/);
});

test('builds a fetched show preserving source ids and runtimes', () => {
  const show = buildFetchedShow({
    result: { sourceShowId: 12, title: 'Slow Horses' },
    season: { sourceSeasonId: 99, seasonNumber: 6 },
    totalSeasons: 7,
    episodes: [{ sourceEpisodeId: 5, episodeNumber: 1, title: 'One', runtimeMinutes: 44, airdate: '2026-09-01' }],
    section: 'queued',
    withPriya: true,
    sortOrder: 2,
    id: 'local-1',
  });
  assert.equal(show.source, 'tvmaze');
  assert.equal(show.sourceShowId, 12);
  assert.equal(show.currentSeason, 6);
  assert.equal(show.totalSeasons, 7);
  assert.equal(show.section, 'queued');
  assert.equal(show.withPriya, true);
  assert.equal(show.episodes[0].sourceEpisodeId, 5);
  assert.equal(show.episodes[0].runtimeMinutes, 44);
  assert.equal(show.episodes[0].watched, false);
});

test('builds a manual show with default episode titles and no source ids', async () => {
  const { buildManualShow } = await import('../../src/ui/add-show.js');
  const show = buildManualShow({ id: 'm1', title: 'Manual', seasonNumber: 2, episodeCount: 3, section: 'watching', withPriya: false, sortOrder: 0 });
  assert.equal(show.source, 'manual');
  assert.equal(show.sourceShowId, null);
  assert.equal(show.currentSeason, 2);
  assert.equal(show.totalSeasons, null);
  assert.deepEqual(show.episodes.map(ep => ep.title), ['Episode 1', 'Episode 2', 'Episode 3']);
  assert.equal(show.season.seasonNumber, 2);
});

test('renders edit sheet with destination and Priya controls', async () => {
  const { renderEditShowSheet } = await import('../../src/ui/add-show.js');
  const html = renderEditShowSheet({ id: 's1', title: 'Slow Horses', source: 'tvmaze', section: 'watching', withPriya: true });
  assert.match(html, /Edit show/);
  assert.match(html, /Now Watching/);
  assert.match(html, /Queued Up/);
  assert.match(html, /data-field="edit-priya"[^>]*checked/);
  assert.match(html, /data-action="save-edit-show"/);
});
