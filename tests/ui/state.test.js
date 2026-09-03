import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceState } from '../../src/ui/state.js';

const base = {
  shows: [{ id: 'a', section: 'watching', sortOrder: 0, withPriya: true, expanded: false, episodes: [{ id: 'e1', watched: false }] }],
  preferences: { fontScale: 'medium', watchingCollapsed: false, queuedCollapsed: false, priyaFilter: false, themeMode: 'system' },
  menuOpen: false,
  sheet: null,
  view: 'main',
};

test('toggles a show expansion', () => {
  const next = reduceState(base, { type: 'toggle-show', showId: 'a' });
  assert.equal(next.shows[0].expanded, true);
  assert.equal(base.shows[0].expanded, false);
});

test('toggles episode watched state', () => {
  const next = reduceState(base, { type: 'toggle-episode', showId: 'a', episodeId: 'e1' });
  assert.equal(next.shows[0].episodes[0].watched, true);
});

test('toggles whole queued section and Priya filter', () => {
  const q = reduceState(base, { type: 'toggle-section', section: 'queued' });
  assert.equal(q.preferences.queuedCollapsed, true);
  const p = reduceState(q, { type: 'toggle-priya-filter' });
  assert.equal(p.preferences.priyaFilter, true);
});

test('opens and closes menu/add sheet/archive', () => {
  assert.equal(reduceState(base, { type: 'open-menu' }).menuOpen, true);
  assert.equal(reduceState({ ...base, menuOpen: true }, { type: 'close-menu' }).menuOpen, false);
  assert.equal(reduceState(base, { type: 'open-add' }).sheet, 'add');
  assert.equal(reduceState({ ...base, sheet: 'add' }, { type: 'close-sheet' }).sheet, null);
  assert.equal(reduceState(base, { type: 'open-archive' }).view, 'archive');
  assert.equal(reduceState({ ...base, view: 'archive' }, { type: 'close-archive' }).view, 'main');
});

test('sets one of the fixed font scales', () => {
  assert.equal(reduceState(base, { type: 'set-font-scale', fontScale: 'large' }).preferences.fontScale, 'large');
  assert.equal(reduceState(base, { type: 'set-font-scale', fontScale: 'huge' }).preferences.fontScale, 'medium');
});

test('sets and clears season completion state', () => {
  const opened = reduceState(base, { type: 'set-completion', completion: { showId: 'a', nextSeasonNumber: 2 } });
  assert.deepEqual(opened.completion, { showId: 'a', nextSeasonNumber: 2 });
  const closed = reduceState(opened, { type: 'clear-completion' });
  assert.equal(closed.completion, null);
});

test('opens and closes edit sheet for a show', () => {
  const editBase = { shows: [], preferences: base.preferences, menuOpen: false, sheet: null, view: 'main', completion: null, editingShowId: null };
  const opened = reduceState(editBase, { type: 'open-edit', showId: 's1' });
  assert.equal(opened.sheet, 'edit');
  assert.equal(opened.editingShowId, 's1');
  const closed = reduceState(opened, { type: 'close-sheet' });
  assert.equal(closed.sheet, null);
  assert.equal(closed.editingShowId, null);
});

test('sets one of the fixed theme modes', () => {
  assert.equal(reduceState(base, { type: 'set-theme-mode', themeMode: 'dark' }).preferences.themeMode, 'dark');
  assert.equal(reduceState(base, { type: 'set-theme-mode', themeMode: 'sepia' }).preferences.themeMode, 'system');
});

test('opens and closes one show actions menu', () => {
  const open = reduceState(base, { type: 'open-show-menu', showId: 'a' });
  assert.equal(open.showMenuId, 'a');
  const closed = reduceState(open, { type: 'close-show-menu' });
  assert.equal(closed.showMenuId, null);
});
