import { getPublicConfig, isCloudConfigured } from './config.js';
import { DEMO_SHOWS } from './demo-data.js';
import { moveShow } from './domain/ordering.js';
import { isSeasonComplete } from './domain/shows.js';
import { tvmaze } from './services/tvmaze.js';
import { getCurrentUser, signIn, signOut } from './services/auth.js';
import { getSupabaseClient } from './services/supabase.js';
import { refreshTrackedMetadata } from './services/metadata-refresh.js';
import { createRepository } from './data/repository.js';
import { clearCachedSnapshot, readCachedSnapshot, writeCachedSnapshot } from './storage/cache.js';
import { readPreferences, writePreferences } from './storage/preferences.js';
import { renderAppMarkup } from './ui/app-shell.js';
import { buildFetchedShow, buildManualShow, renderFetchedSetup, renderSearchResults } from './ui/add-show.js';
import { attachDragController } from './ui/drag-controller.js';
import { archiveShowLocally, startNextSeasonLocally } from './ui/completion.js';
import { reduceState } from './ui/state.js';
import { renderAuthView } from './ui/auth-view.js';
import { canMutate } from './ui/write-guard.js';

const root = document.querySelector('#app');
const config = getPublicConfig();
const demoRequested = new URLSearchParams(location.search).get('demo') === '1';
const demoMode = demoRequested || !isCloudConfigured(config) || config.demoMode;

let searchTimer = null;
let searchRequest = 0;
let searchResults = [];
let selectedSearchResult = null;
let selectedSeasons = [];
let currentUser = null;
let repository = null;
let offlineReadOnly = false;
let lastMetadataCheckedAt = globalThis.localStorage?.getItem('watching:metadata-checked-at') || null;

let state = {
  shows: initialShows(),
  preferences: readPreferences(),
  menuOpen: false,
  sheet: null,
  view: 'main',
  completion: null,
  editingShowId: null,
};

function initialShows() {
  const cached = readCachedSnapshot();
  if (cached?.shows?.length) return cached.shows;
  return demoMode ? structuredClone(DEMO_SHOWS) : [];
}

function render() {
  root.innerHTML = renderAppMarkup(state);
  document.documentElement.dataset.fontScale = state.preferences.fontScale;
}

function commit(next, { cacheShows = false, savePrefs = false } = {}) {
  state = next;
  if (savePrefs) writePreferences(state.preferences);
  if (cacheShows) writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
}

function dispatch(action, options) {
  commit(reduceState(state, action), options);
}

function ensureWritable() {
  if (canMutate({ demoMode, repository, offlineReadOnly })) return true;
  showToast('Offline — changes are disabled until sync is available.');
  return false;
}

root.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (root.dataset.suppressShowClick === '1' && action === 'toggle-show') return;

  switch (action) {
    case 'toggle-show':
      dispatch({ type: 'toggle-show', showId: target.dataset.showId });
      break;
    case 'toggle-episode':
      handleEpisodeToggle(target.dataset.showId, target.dataset.episodeId);
      break;
    case 'toggle-section':
      dispatch({ type: 'toggle-section', section: target.dataset.section }, { savePrefs: true });
      break;
    case 'toggle-priya-filter':
      dispatch({ type: 'toggle-priya-filter' }, { savePrefs: true });
      break;
    case 'open-menu':
      dispatch({ type: 'open-menu' });
      break;
    case 'close-menu':
      dispatch({ type: 'close-menu' });
      break;
    case 'add-show':
      if (!ensureWritable()) break;
      dispatch({ type: 'open-add' });
      queueMicrotask(() => document.querySelector('#show-search')?.focus());
      break;
    case 'close-sheet':
      dispatch({ type: 'close-sheet' });
      break;
    case 'edit-show':
      if (!ensureWritable()) break;
      dispatch({ type: 'open-edit', showId: target.dataset.showId });
      break;
    case 'save-edit-show':
      saveEditShow();
      break;
    case 'open-archive':
      dispatch({ type: 'open-archive' });
      break;
    case 'close-archive':
      dispatch({ type: 'close-archive' });
      break;
    case 'set-font-scale':
      dispatch({ type: 'set-font-scale', fontScale: target.dataset.fontScale }, { savePrefs: true });
      break;
    case 'sign-in':
      handleSignIn();
      break;
    case 'sign-out':
      handleSignOut();
      break;
    case 'start-manual-add':
      showManualAddForm();
      break;
    case 'select-search-result':
      selectSearchResult(Number(target.dataset.resultIndex));
      break;
    case 'save-fetched-show':
      saveFetchedShow();
      break;
    case 'save-manual-show':
      saveManualShow();
      break;
    case 'restore-archived':
      restoreArchivedShow(target.dataset.showId);
      break;
    case 'close-completion':
      dispatch({ type: 'clear-completion' });
      break;
    case 'completion-archive':
      archiveCompletedShow();
      break;
    case 'completion-next':
      startCompletionNextSeason(target.dataset.section);
      break;
  }
});



async function handleEpisodeToggle(showId, episodeId) {
  if (!ensureWritable()) return;
  const beforeState = state;
  const before = state.shows.find(show => show.id === showId);
  if (!before) return;
  const wasComplete = isSeasonComplete(before);
  const nextState = reduceState(state, { type: 'toggle-episode', showId, episodeId });
  const after = nextState.shows.find(show => show.id === showId);
  const episode = after?.episodes?.find(item => item.id === episodeId);
  commit(nextState, { cacheShows: true });
  if (repository && episode) {
    try {
      await repository.saveEpisodeWatched(episode.id, episode.watched);
    } catch {
      state = beforeState;
      writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
      render();
      showToast('Could not sync that change.');
      return;
    }
  }
  if (!wasComplete && after && isSeasonComplete(after)) {
    await prepareCompletion(after);
  }
}

async function prepareCompletion(show) {
  let nextSeason = null;
  if (show.source === 'tvmaze' && show.sourceShowId) {
    try {
      const seasons = await tvmaze.getShowSeasons(show.sourceShowId);
      nextSeason = seasons.find(season => season.seasonNumber === Number(show.currentSeason) + 1) ?? null;
    } catch {
      nextSeason = null;
    }
  }
  dispatch({
    type: 'set-completion',
    completion: {
      showId: show.id,
      nextSeasonNumber: nextSeason?.seasonNumber ?? null,
      nextSeason,
    },
  });
}

async function archiveCompletedShow() {
  if (!ensureWritable()) return;
  const showId = state.completion?.showId;
  const show = state.shows.find(item => item.id === showId);
  if (!show) return;
  const completedAt = new Date().toISOString();
  try {
    if (repository) await repository.archiveShow(show, completedAt);
  } catch {
    showToast('Could not archive that show.');
    return;
  }
  const archived = archiveShowLocally(show, completedAt);
  state = {
    ...state,
    shows: state.shows.map(item => item.id === show.id ? archived : item),
    completion: null,
  };
  writeCachedSnapshot({ shows: state.shows, cachedAt: completedAt });
  render();
  showToast(`${show.title} archived.`);
}

async function startCompletionNextSeason(section) {
  if (!ensureWritable()) return;
  const completion = state.completion;
  const show = state.shows.find(item => item.id === completion?.showId);
  const season = completion?.nextSeason;
  if (!show || !season || !['watching', 'queued'].includes(section)) return;
  try {
    const episodes = await tvmaze.getSeasonEpisodes(season.sourceSeasonId);
    const sortOrder = state.shows.filter(item => item.section === section && item.id !== show.id).length;
    if (repository) await repository.addSeason(show, season, episodes, section);
    const nextShow = { ...startNextSeasonLocally(show, { season, episodes, section }), sortOrder };
    state = {
      ...state,
      shows: state.shows.map(item => item.id === show.id ? nextShow : item),
      completion: null,
    };
    writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
    render();
    showToast(`Season ${season.seasonNumber} added.`);
  } catch {
    showToast('Could not load the next season.');
  }
}

async function restoreArchivedShow(showId) {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show?.availableSeasonNumber || show.source !== 'tvmaze' || !show.sourceShowId) {
    showToast('No linked season information is available.');
    return;
  }
  try {
    const seasons = await tvmaze.getShowSeasons(show.sourceShowId);
    const season = seasons.find(item => item.seasonNumber === show.availableSeasonNumber);
    if (!season) throw new Error('Season missing');
    state = {
      ...state,
      completion: { showId, nextSeasonNumber: season.seasonNumber, nextSeason: season },
      view: 'main',
    };
    render();
  } catch {
    showToast('Could not load that season.');
  }
}

root.addEventListener('input', event => {
  if (event.target.dataset.field !== 'show-search') return;
  const query = event.target.value.trim();
  clearTimeout(searchTimer);
  const region = root.querySelector('[data-region="search-results"]');
  if (query.length < 2) {
    searchResults = [];
    if (region) region.innerHTML = '';
    return;
  }
  const requestId = ++searchRequest;
  if (region) region.innerHTML = '<p class="search-empty">Searching…</p>';
  searchTimer = setTimeout(async () => {
    try {
      const results = await tvmaze.searchShows(query);
      if (requestId !== searchRequest) return;
      searchResults = results;
      const current = root.querySelector('[data-region="search-results"]');
      if (current) current.innerHTML = renderSearchResults(results);
    } catch {
      const current = root.querySelector('[data-region="search-results"]');
      if (current) current.innerHTML = '<p class="search-empty">Lookup unavailable. You can still add manually.</p>';
    }
  }, 250);
});

async function selectSearchResult(index) {
  selectedSearchResult = searchResults[index] ?? null;
  if (!selectedSearchResult) return;
  const sheet = root.querySelector('.sheet');
  if (!sheet) return;
  sheet.innerHTML = '<p class="search-empty">Loading seasons…</p>';
  try {
    selectedSeasons = await tvmaze.getShowSeasons(selectedSearchResult.sourceShowId);
    if (!selectedSeasons.length) throw new Error('No seasons');
    sheet.innerHTML = renderFetchedSetup(selectedSearchResult, selectedSeasons);
  } catch {
    sheet.innerHTML = `<div class="sheet-header"><h2>${selectedSearchResult.title}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">×</button></div><p class="search-empty">Season information is unavailable. Add this show manually instead.</p><button class="manual-link" type="button" data-action="start-manual-add">Add manually</button>`;
  }
}

async function saveFetchedShow() {
  if (!ensureWritable()) return;
  if (!selectedSearchResult) return;
  const seasonId = Number(root.querySelector('[data-field="fetched-season"]')?.value);
  const season = selectedSeasons.find(item => item.sourceSeasonId === seasonId);
  if (!season) return;
  const section = root.querySelector('input[name="fetched-section"]:checked')?.value || 'watching';
  const withPriya = Boolean(root.querySelector('[data-field="fetched-priya"]')?.checked);
  const button = root.querySelector('[data-action="save-fetched-show"]');
  if (button) { button.disabled = true; button.textContent = 'Adding…'; }
  try {
    const episodes = await tvmaze.getSeasonEpisodes(season.sourceSeasonId);
    const sortOrder = state.shows.filter(show => show.section === section).length;
    const id = globalThis.crypto?.randomUUID?.() ?? `show-${Date.now()}`;
    const draft = buildFetchedShow({ result: selectedSearchResult, season, episodes, section, withPriya, sortOrder, id });
    const newShow = repository
      ? await repository.createShow(currentUser.id, { ...draft, season: draft.seasons[0] })
      : draft;
    state = { ...state, shows: [...state.shows, newShow], sheet: null };
    writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
    render();
    showToast(`${newShow.title} added.`);
  } catch {
    if (button) { button.disabled = false; button.textContent = 'Add show'; }
    showToast('Could not load that season.');
  }
}

attachDragController(root, async ({ showId, targetSection, targetIndex }) => {
  if (!ensureWritable()) return;
  if (state.preferences.priyaFilter) {
    showToast('Show all shows before reordering.');
    return;
  }
  const beforeShows = state.shows;
  const nextShows = moveShow(state.shows, showId, targetSection, targetIndex);
  state = { ...state, shows: nextShows };
  writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
  if (repository) {
    try {
      await repository.saveShowPlacement(nextShows.filter(show => show.section !== 'archived'));
    } catch {
      state = { ...state, shows: beforeShows };
      writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
      render();
      showToast('Could not sync that order.');
    }
  }
});

root.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (state.completion) dispatch({ type: 'clear-completion' });
  else if (state.sheet) dispatch({ type: 'close-sheet' });
  else if (state.menuOpen) dispatch({ type: 'close-menu' });
  else if (state.view === 'archive') dispatch({ type: 'close-archive' });
});

function showManualAddForm() {
  const sheet = root.querySelector('.sheet');
  if (!sheet) return;
  sheet.innerHTML = `
    <div class="sheet-header">
      <h2>Add manually</h2>
      <button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">×</button>
    </div>
    <label class="field-label" for="manual-title">Title</label>
    <input id="manual-title" class="text-field" data-field="manual-title" autocomplete="off">
    <div class="field-grid">
      <label><span class="field-label">Season</span><input class="text-field compact-field" data-field="manual-season" type="number" min="1" value="1"></label>
      <label><span class="field-label">Episodes</span><input class="text-field compact-field" data-field="manual-episodes" type="number" min="1" value="8"></label>
    </div>
    <fieldset class="choice-group">
      <legend>Put it in</legend>
      <label><input type="radio" name="manual-section" value="watching" checked> Now Watching</label>
      <label><input type="radio" name="manual-section" value="queued"> Queued Up</label>
    </fieldset>
    <label class="check-row"><input type="checkbox" data-field="manual-priya"> <span>With Priya</span></label>
    <button class="primary-button" type="button" data-action="save-manual-show">Add show</button>`;
  sheet.querySelector('[data-field="manual-title"]')?.focus();
}

async function saveManualShow() {
  if (!ensureWritable()) return;
  const title = root.querySelector('[data-field="manual-title"]')?.value.trim();
  const season = Math.max(1, Number(root.querySelector('[data-field="manual-season"]')?.value || 1));
  const count = Math.max(1, Math.min(100, Number(root.querySelector('[data-field="manual-episodes"]')?.value || 1)));
  const section = root.querySelector('input[name="manual-section"]:checked')?.value || 'watching';
  const withPriya = Boolean(root.querySelector('[data-field="manual-priya"]')?.checked);
  if (!title) {
    showToast('Enter a show title.');
    return;
  }
  const sortOrder = state.shows.filter(show => show.section === section).length;
  const id = globalThis.crypto?.randomUUID?.() ?? `show-${Date.now()}`;
  const draft = buildManualShow({ id, title, seasonNumber: season, episodeCount: count, section, withPriya, sortOrder });
  try {
    const newShow = repository
      ? await repository.createShow(currentUser.id, draft)
      : draft;
    state = { ...state, shows: [...state.shows, newShow], sheet: null };
    writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
    render();
    showToast(`${title} added.`);
  } catch {
    showToast('Could not add that show.');
  }
}

async function saveEditShow() {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === state.editingShowId);
  if (!show) return;
  const section = root.querySelector('input[name="edit-section"]:checked')?.value || show.section;
  const withPriya = Boolean(root.querySelector('[data-field="edit-priya"]')?.checked);
  const title = show.source === 'manual'
    ? (root.querySelector('[data-field="edit-title"]')?.value.trim() || show.title)
    : show.title;

  let nextShows = state.shows;
  if (section !== show.section) {
    const targetIndex = state.shows.filter(item => item.section === section && item.id !== show.id).length;
    nextShows = moveShow(nextShows, show.id, section, targetIndex);
  }
  nextShows = nextShows.map(item => item.id === show.id ? { ...item, title, withPriya } : item);

  try {
    if (repository) {
      if (section !== show.section) {
        await repository.saveShowPlacement(nextShows.filter(item => item.section !== 'archived'));
      }
      await repository.updateShow(show.id, { title, withPriya });
    }
  } catch {
    showToast('Could not save those changes.');
    return;
  }

  state = { ...state, shows: nextShows, sheet: null, editingShowId: null };
  writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
  showToast('Show updated.');
}
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('toast--visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('toast--visible'), 2200);
}

async function boot() {
  document.documentElement.dataset.fontScale = state.preferences.fontScale;
  if (demoMode) {
    render();
    return;
  }
  root.innerHTML = '<div class="boot-message">Loading Watching…</div>';
  const cached = readCachedSnapshot();
  if (navigator.onLine === false && cached?.shows) {
    offlineReadOnly = true;
    state = { ...state, shows: cached.shows };
    render();
    queueMicrotask(() => showToast('Offline — showing last synced data.'));
    return;
  }
  try {
    const user = await getCurrentUser();
    if (!user) {
      root.innerHTML = renderAuthView();
      return;
    }
    await loadCloudUser(user);
  } catch {
    root.innerHTML = renderAuthView('Could not connect. Try again.');
  }
}

async function loadCloudUser(user) {
  offlineReadOnly = false;
  currentUser = user;
  const client = await getSupabaseClient();
  if (!client) throw new Error('Cloud sync is not configured.');
  repository = createRepository(client);
  const cached = readCachedSnapshot();
  if (cached?.shows) {
    state = { ...state, shows: cached.shows };
    render();
  }
  try {
    const shows = await repository.loadShows(user.id);
    state = { ...state, shows };
    writeCachedSnapshot({ shows, cachedAt: new Date().toISOString() });
    render();
    refreshCloudMetadata();
  } catch {
    if (!cached?.shows) {
      state = { ...state, shows: [] };
      render();
      showToast('Cloud data is temporarily unavailable.');
    }
  }
}

async function handleSignIn() {
  const email = root.querySelector('[data-field="auth-email"]')?.value.trim();
  const password = root.querySelector('[data-field="auth-password"]')?.value || '';
  const button = root.querySelector('[data-action="sign-in"]');
  if (!email || !password) return;
  if (button) { button.disabled = true; button.textContent = 'Signing in…'; }
  try {
    const data = await signIn(email, password);
    await loadCloudUser(data.user);
  } catch {
    root.innerHTML = renderAuthView('Email or password was not accepted.');
  }
}

async function handleSignOut() {
  if (demoMode) {
    dispatch({ type: 'close-menu' });
    showToast('Demo mode — no account is signed in.');
    return;
  }
  try { await signOut(); } catch {}
  currentUser = null;
  repository = null;
  offlineReadOnly = false;
  clearCachedSnapshot();
  state = { ...state, shows: [], menuOpen: false, sheet: null, editingShowId: null, completion: null, view: 'main' };
  root.innerHTML = renderAuthView();
}

async function refreshCloudMetadata() {
  if (!repository || !state.shows.length) return;
  try {
    const result = await refreshTrackedMetadata({
      shows: state.shows,
      lastCheckedAt: lastMetadataCheckedAt,
      tvmaze,
      repository,
      now: new Date(),
    });
    state = { ...state, shows: result.shows };
    lastMetadataCheckedAt = result.checkedAt;
    globalThis.localStorage?.setItem('watching:metadata-checked-at', result.checkedAt);
    writeCachedSnapshot({ shows: state.shows, cachedAt: result.checkedAt });
    render();
  } catch {}
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || demoMode || !repository) return;
  const then = lastMetadataCheckedAt ? new Date(lastMetadataCheckedAt).getTime() : 0;
  if (!then || Date.now() - then >= 6 * 60 * 60 * 1000) refreshCloudMetadata();
});

boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }, { once: true });
}
