import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAppMarkup } from '../../src/ui/app-shell.js';

const state = {
  shows: [
    {
      id: 'slow-horses', title: 'Slow Horses', section: 'watching', sortOrder: 0,
      withPriya: true, currentSeason: 6, totalSeasons: 7, expanded: false,
      episodes: [
        { id: 'sh-1', episodeNumber: 1, title: 'Episode One', runtimeMinutes: 44, watched: true },
        { id: 'sh-2', episodeNumber: 2, title: 'Episode Two', runtimeMinutes: 48, watched: false },
      ],
    },
    {
      id: 'lowdown', title: 'The Lowdown', section: 'queued', sortOrder: 0,
      withPriya: true, currentSeason: 1, totalSeasons: 1, expanded: false,
      episodes: [
        { id: 'ld-1', episodeNumber: 1, title: 'Pilot', runtimeMinutes: 52, watched: false },
      ],
    },
  ],
  preferences: {
    fontScale: 'medium', watchingCollapsed: false, queuedCollapsed: false, priyaFilter: false, themeMode: 'system',
  },
  menuOpen: false,
  sheet: null,
  view: 'main',
};

test('renders Watching main shell with only the agreed primary chrome', () => {
  const html = renderAppMarkup(state);
  assert.match(html, />Watching</);
  assert.match(html, /data-action="open-menu"/);
  assert.match(html, /data-icon="hamburger"/);
  assert.match(html, /NOW WATCHING/);
  assert.match(html, /QUEUED UP/);
  assert.match(html, /class="floating-pill"/);
  assert.match(html, /data-action="add-show"/);
  assert.match(html, /data-action="toggle-priya-filter"/);
  assert.doesNotMatch(html, /Ratings|Reviews|Streaming|Discover/);
});

test('Priya filter preserves section structure but hides non-Priya shows', () => {
  const filtered = {
    ...state,
    preferences: { ...state.preferences, priyaFilter: true },
    shows: [...state.shows, {
      id: 'solo', title: 'Solo Show', section: 'queued', sortOrder: 1,
      withPriya: false, currentSeason: 1, expanded: false, episodes: [],
    }],
  };
  const html = renderAppMarkup(filtered);
  assert.match(html, /Slow Horses/);
  assert.match(html, /The Lowdown/);
  assert.doesNotMatch(html, /Solo Show/);
  assert.match(html, /floating-button--active/);
});

test('menu contains archive font controls sign out and version but no sorting', () => {
  const html = renderAppMarkup({ ...state, menuOpen: true });
  assert.match(html, />Archive</);
  assert.match(html, /data-font-scale="small"/);
  assert.match(html, /data-font-scale="medium"/);
  assert.match(html, /data-font-scale="large"/);
  assert.match(html, />Sign out</);
  assert.match(html, /data-theme-mode="system"/);
  assert.match(html, /data-theme-mode="light"/);
  assert.match(html, /data-theme-mode="dark"/);
  assert.match(html, /v0\.2\.1/);
  assert.doesNotMatch(html, /Alphabetical|Sort/);
});

test('renders season completion sheet when requested', () => {
  const completionState = {
    ...state,
    completion: { showId: 'slow-horses', nextSeasonNumber: 7 },
  };
  const html = renderAppMarkup(completionState);
  assert.match(html, /Season complete/);
  assert.match(html, /Watch next season/);
  assert.match(html, /Queue next season/);
  assert.match(html, /Archive for now/);
});

test('each active show row exposes a three-dot show actions control', () => {
  const html = renderAppMarkup(state);
  assert.match(html, /data-action="open-show-menu" data-show-id="slow-horses"/);
  assert.match(html, /data-icon="ellipsis"/);
});

test('show actions menu exposes edit Priya move and archive actions', () => {
  const html = renderAppMarkup({ ...state, showMenuId: 'slow-horses' });
  assert.match(html, /data-action="edit-show"/);
  assert.match(html, /Remove Priya marker/);
  assert.match(html, /Move to Queued Up/);
  assert.match(html, /data-action="archive-show"/);
});

test('archive distinguishes unfinished archive from completed season', () => {
  const unfinished = {
    ...state.shows[0],
    id: 'unfinished',
    section: 'archived',
    archivedAt: '2026-09-03T20:00:00-04:00',
    seasons: [{ id: 'season-x', seasonNumber: 6, completedAt: null }],
  };
  const finished = {
    ...state.shows[1],
    id: 'finished',
    section: 'archived',
    archivedAt: '2026-09-02T20:00:00-04:00',
    seasons: [{ id: 'season-y', seasonNumber: 1, completedAt: '2026-09-02T20:00:00-04:00' }],
  };
  const html = renderAppMarkup({ ...state, view: 'archive', shows: [unfinished, finished] });
  assert.match(html, /Season 6 · Archived/);
  assert.match(html, /Season 1 · Finished/);
  assert.match(html, /data-action="resume-archived" data-show-id="unfinished"/);
});
