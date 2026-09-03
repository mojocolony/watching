import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEpisodeRow, renderShowRow, renderSection } from '../../src/ui/markup.js';

const show = {
  id: 'show-1', title: 'Slow Horses', currentSeason: 6, section: 'watching', sortOrder: 0,
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
  assert.match(html, /Season 6 · 1\/2/);
});

test('queued untouched show summarizes episode count', () => {
  const html = renderShowRow({ ...show, section: 'queued', episodes: show.episodes.map(e => ({ ...e, watched: false })) });
  assert.match(html, /Season 6 · 2 episodes/);
});

test('section heading uses exact copy and can collapse as a whole', () => {
  const html = renderSection('queued', [show], { queuedCollapsed: true, watchingCollapsed: false });
  assert.match(html, /QUEUED UP/);
  assert.doesNotMatch(html, /Slow Horses/);
});

test('expanded show exposes a quiet edit action without permanent row chrome', () => {
  const show = { id: 's-edit', title: 'Edit Me', section: 'watching', currentSeason: 1, sortOrder: 0, withPriya: false, expanded: true, episodes: [] };
  const html = renderShowRow(show);
  assert.match(html, /data-action="edit-show"/);
  assert.match(html, />Edit</);
  const collapsed = renderShowRow({ ...show, expanded: false });
  assert.doesNotMatch(collapsed, /data-action="edit-show"/);
});
