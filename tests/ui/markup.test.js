import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEpisodeRow, renderShowRow, renderSection } from '../../src/ui/markup.js';

const show = {
  id: 'show-1', title: 'Slow Horses', currentSeason: 6, totalSeasons: 7, section: 'watching', sortOrder: 0,
  withPriya: true, expanded: true,
  episodes: [
    { id: 'e1', episodeNumber: 1, title: 'Pilot', runtimeMinutes: 48, watched: true },
    { id: 'e2', episodeNumber: 2, title: 'Second', runtimeMinutes: null, watched: false },
  ],
};

test('episode row shows number title runtime and dim class only when watched', () => {
  const watched = renderEpisodeRow(show.episodes[0], show.id);
  assert.match(watched, /episode-row--watched/);
  assert.match(watched, /1\. Pilot/);
  assert.match(watched, /48m/);
  const unknownRuntime = renderEpisodeRow(show.episodes[1], show.id);
  assert.doesNotMatch(unknownRuntime, /null|undefined|\?m/);
});

test('show row includes Priya users marker and season progress', () => {
  const html = renderShowRow(show);
  assert.match(html, /data-icon="users"/);
  assert.match(html, /Season 6\/7 · Episode 1\/2/);
});

test('queued untouched show uses the same season and episode progress format', () => {
  const html = renderShowRow({ ...show, section: 'queued', episodes: show.episodes.map(e => ({ ...e, watched: false })) });
  assert.match(html, /Season 6\/7 · Episode 0\/2/);
});

test('section heading uses exact copy and can collapse as a whole', () => {
  const html = renderSection('queued', [show], { queuedCollapsed: true, watchingCollapsed: false });
  assert.match(html, /QUEUED UP/);
  assert.doesNotMatch(html, /Slow Horses/);
});

test('show row uses the always-available three-dot control instead of an inline Edit link', () => {
  const item = { id: 's-edit', title: 'Edit Me', section: 'watching', currentSeason: 1, totalSeasons: 1, sortOrder: 0, withPriya: false, expanded: true, episodes: [] };
  const html = renderShowRow(item);
  assert.match(html, /data-action="open-show-menu"/);
  assert.match(html, /data-icon="ellipsis"/);
  assert.doesNotMatch(html, /class="show-edit-button"/);
});

test('show progress marks unknown total seasons without inventing a count', () => {
  const html = renderShowRow({ ...show, source: 'manual', totalSeasons: null });
  assert.match(html, /Season 6\/\? · Episode 1\/2/);
});

test('future season with no episodes says episodes are not announced instead of 0/0', () => {
  const html = renderShowRow({
    ...show,
    id: 'future',
    title: 'Future Season',
    currentSeason: 2,
    totalSeasons: 2,
    expanded: true,
    episodes: [],
  });
  assert.match(html, /Season 2\/2 · Episodes not announced/);
  assert.match(html, /No episode information yet/);
  assert.doesNotMatch(html, /Episode 0\/0/);
});
