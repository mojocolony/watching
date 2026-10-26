import { getPublicConfig, isCloudConfigured } from './config.js';
import { DEMO_SHOWS } from './demo-data.js';
import { moveShow } from './domain/ordering.js';
import { reconcileCloudShows } from './domain/cloud-sync.js';
import { isSeasonComplete } from './domain/shows.js';
import { tvmaze } from './services/tvmaze.js';
import { getCurrentUser, signIn, signOut } from './services/auth.js';
import { getSupabaseClient } from './services/supabase.js';
import { refreshTrackedMetadata } from './services/metadata-refresh.js';
import { createRepository } from './data/repository.js';
import { clearCachedSnapshot, readCachedSnapshot, writeCachedSnapshot } from './storage/cache.js';
import { readPreferences, writePreferences } from './storage/preferences.js';
import { renderAppMarkup } from './ui/app-shell.js';
import { buildFetchedShow, buildManualShow, chooseDefaultSeasonWithEpisodes, renderFetchedSetup, renderSearchResults } from './ui/add-show.js';
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
let selectedSeasonEpisodes = new Map();
let currentUser = null;
let repository = null;
let offlineReadOnly = false;
let cloudSyncPromise = null;
let providerRefreshPromise = null;
let lastMetadataCheckedAt = globalThis.localStorage?.getItem('watching:metadata-checked-at') || null;

let state = {
  shows: initialShows(),
  preferences: readPreferences(),
  menuOpen: false,
  sheet: null,
  view: 'main',
  completion: null,
  editingShowId: null,
  editingSeasons: null,
  showMenuId: null,
};

function initialShows() {
  const cached = readCachedSnapshot();
  if (cached?.shows?.length) return cached.shows;
  return demoMode ? structuredClone(DEMO_SHOWS) : [];
}

function render() {
  root.innerHTML = renderAppMarkup(state);
  document.documentElement.dataset.fontScale = state.preferences.fontScale;
  document.documentElement.dataset.theme = state.preferences.themeMode ?? 'system';
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
    case 'sync-now':
      dispatch({ type: 'close-menu' });
      if (demoMode) showToast('Demo mode has no cloud account.');
      else if (repository) void syncCloudShows({ notify: true });
      else void boot();
      break;
    case 'close-menu':
      dispatch({ type: 'close-menu' });
      break;
    case 'open-show-menu':
      dispatch({ type: 'open-show-menu', showId: target.dataset.showId });
      break;
    case 'close-show-menu':
      dispatch({ type: 'close-show-menu' });
      break;
    case 'add-show':
      if (!ensureWritable()) break;
      dispatch({ type: 'open-add' });
      queueMicrotask(() => document.querySelector('#show-search')?.focus());
      break;
    case 'close-sheet':
      dispatch({ type: 'close-sheet' });
      break;
    case 'choose-watch-provider':
      openWatchProvider(target.dataset.showId);
      break;
    case 'save-watch-provider':
      void saveWatchProvider();
      break;
    case 'edit-show':
      openEditShow(target.dataset.showId);
      break;
    case 'save-edit-show':
      saveEditShow();
      break;
    case 'open-set-aside':
      dispatch({ type: 'open-set-aside' });
      break;
    case 'close-set-aside':
      dispatch({ type: 'close-set-aside' });
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
    case 'set-theme-mode':
      dispatch({ type: 'set-theme-mode', themeMode: target.dataset.themeMode }, { savePrefs: true });
      break;
    case 'toggle-show-priya':
      toggleShowPriya(target.dataset.showId);
      break;
    case 'move-show-section':
      moveShowFromMenu(target.dataset.showId, target.dataset.section);
      break;
    case 'set-aside-show':
      setAsideShow(target.dataset.showId);
      break;
    case 'resume-set-aside':
      resumeSetAsideShow(target.dataset.showId);
      break;
    case 'archive-show':
      archiveShowFromMenu(target.dataset.showId);
      break;
    case 'delete-show':
      deleteShowFromMenu(target.dataset.showId);
      break;
    case 'resume-archived':
      resumeArchivedShow(target.dataset.showId);
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
  if (!show || !season || !['watching', 'queued', 'someday'].includes(section)) return;
  try {
    const episodes = await tvmaze.getSeasonEpisodes(season.sourceSeasonId);
    const sortOrder = nextSortOrder(section);
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
  if (event.target.dataset.field !== 'watch-provider-other') return;
  const select = root.querySelector('[data-field="watch-provider"]');
  if (select && event.target.value.trim()) select.value = '__other__';
});

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
    const preferred = await chooseDefaultSeasonWithEpisodes(selectedSeasons, seasonId => tvmaze.getSeasonEpisodes(seasonId));
    selectedSeasonEpisodes = new Map();
    if (preferred.season) selectedSeasonEpisodes.set(preferred.season.sourceSeasonId, preferred.episodes);
    sheet.innerHTML = renderFetchedSetup(selectedSearchResult, selectedSeasons, preferred.season?.sourceSeasonId ?? null);
  } catch {
    sheet.innerHTML = `<div class="sheet-header"><h2>${selectedSearchResult.title}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">×</button></div><p class="search-empty">Season information is unavailable. Add this show manually instead.</p><button class="manual-link" type="button" data-action="start-manual-add">Add manually</button>`;
  }
}

function nextSortOrder(section) {
  const values = state.shows.filter(show => show.section === section).map(show => Number(show.sortOrder ?? 0));
  return values.length ? Math.max(...values) + 1 : 0;
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
    const episodes = selectedSeasonEpisodes.has(season.sourceSeasonId)
      ? selectedSeasonEpisodes.get(season.sourceSeasonId)
      : await tvmaze.getSeasonEpisodes(season.sourceSeasonId);
    const sortOrder = nextSortOrder(section);
    const id = globalThis.crypto?.randomUUID?.() ?? `show-${Date.now()}`;
    const totalSeasons = selectedSeasons.length ? Math.max(...selectedSeasons.map(item => Number(item.seasonNumber))) : null;
    const draft = buildFetchedShow({ result: selectedSearchResult, season, episodes, section, withPriya, sortOrder, id, totalSeasons });
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
  const beforePreferences = state.preferences;
  const nextShows = moveShow(state.shows, showId, targetSection, targetIndex);
  // Make a successful drop visible, including when its destination was collapsed.
  const collapsedKey = { watching: 'watchingCollapsed', queued: 'queuedCollapsed', someday: 'somedayCollapsed' }[targetSection];
  const preferences = collapsedKey && state.preferences[collapsedKey]
    ? { ...state.preferences, [collapsedKey]: false }
    : state.preferences;
  state = { ...state, shows: nextShows, preferences };
  if (preferences !== beforePreferences) writePreferences(preferences);
  writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
  if (repository) {
    try {
      await repository.saveShowPlacement(nextShows.filter(show => ['watching', 'queued', 'someday'].includes(show.section)));
    } catch {
      state = { ...state, shows: beforeShows, preferences: beforePreferences };
      if (preferences !== beforePreferences) writePreferences(beforePreferences);
      writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
      render();
      showToast('Could not sync that order.');
    }
  }
});

root.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (state.showMenuId) dispatch({ type: 'close-show-menu' });
  else if (state.completion) dispatch({ type: 'clear-completion' });
  else if (state.sheet) dispatch({ type: 'close-sheet' });
  else if (state.menuOpen) dispatch({ type: 'close-menu' });
  else if (state.view === 'archive') dispatch({ type: 'close-archive' });
  else if (state.view === 'set_aside') dispatch({ type: 'close-set-aside' });
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
       <label><input type="radio" name="manual-section" value="someday"> Someday</label>
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
  const sortOrder = nextSortOrder(section);
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


function openWatchProvider(showId) {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show) return;
  state = { ...state, sheet: 'provider', providerShowId: showId, showMenuId: null };
  render();
  const select = root.querySelector('[data-field="watch-provider"]');
  if (select) select.value = show.watchProviderManual ? (show.watchProvider || '') : '__auto__';
}

async function saveWatchProvider() {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === state.providerShowId);
  if (!show) return;
  const selected = root.querySelector('[data-field="watch-provider"]')?.value || '';
  const manual = selected !== '__auto__';
  const provider = manual ? (selected === '__other__'
    ? root.querySelector('[data-field="watch-provider-other"]')?.value.trim().slice(0,80)
    : selected) : (show.watchProviderManual ? null : show.watchProvider);
  if (manual && !provider) { showToast('Enter a service name.'); return; }
  try {
    if (repository) await repository.updateShow(show.id, { watchProvider: provider, watchProviderManual: manual });
  } catch { showToast('Could not save the service.'); return; }
  state = { ...state, shows: state.shows.map(item => item.id === show.id
    ? { ...item, watchProvider: provider, watchProviderManual: manual } : item),
    sheet: null, providerShowId: null };
  writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
  if (!manual) {
    void refreshWatchProvider(show.id);
  }
}

async function backfillWatchProviders() {
  if (providerRefreshPromise) return providerRefreshPromise;
  const userId = currentUser?.id;
  const candidates = state.shows.filter(show => show.source === 'tvmaze' && !show.watchProviderManual && !show.watchProvider).map(show => show.id);
  const run = (async () => {
    for (const showId of candidates) {
      if (!repository || currentUser?.id !== userId) break;
      await refreshWatchProvider(showId);
    }
  })();
  providerRefreshPromise = run;
  try { await run; } finally { if (providerRefreshPromise === run) providerRefreshPromise = null; }
}

async function refreshWatchProvider(showId) {
  if (!repository) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show || show.watchProviderManual || show.source !== 'tvmaze') return;
  try {
    const client = await getSupabaseClient();
    const { data, error } = await client.functions.invoke('watching-providers', { body: { title: show.title } });
    if (error || data?.error) {
      console.warn('Watching: provider lookup unavailable', data?.error || error?.message || 'Unknown error');
      return;
    }
    const provider = data?.provider;
    if (!provider) return;
    const fresh = state.shows.find(item => item.id === showId);
    if (!fresh || fresh.watchProviderManual) return;
    await repository.updateShow(showId, { watchProvider: provider, watchProviderManual: false });
    state = { ...state, shows: state.shows.map(item => item.id === showId && !item.watchProviderManual
      ? { ...item, watchProvider: provider } : item) };
    writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
    render();
  } catch (error) { console.warn('Watching: provider lookup failed', error); }
}

async function openEditShow(showId) {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show) return;
  dispatch({ type: 'open-edit', showId, editingSeasons: show.seasons ?? [] });
  if (show.source !== 'tvmaze' || !show.sourceShowId) return;
  try {
    const seasons = await tvmaze.getShowSeasons(show.sourceShowId);
    if (state.sheet !== 'edit' || state.editingShowId !== showId) return;
    state = { ...state, editingSeasons: seasons };
    render();
  } catch {
    // Keep the already-known season choices if TVmaze is temporarily unavailable.
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

  const availableSeasons = state.editingSeasons ?? show.seasons ?? [];
  const selectedSeasonId = Number(root.querySelector('[data-field="edit-season"]')?.value);
  const selectedSeason = show.source === 'tvmaze'
    ? availableSeasons.find(item => Number(item.sourceSeasonId) === selectedSeasonId) ?? null
    : null;
  const seasonChanged = Boolean(selectedSeason && Number(selectedSeason.seasonNumber) !== Number(show.currentSeason));
  let selectedEpisodes = null;

  let nextShows = state.shows;
  if (section !== show.section) {
    const targetIndex = state.shows.filter(item => item.section === section && item.id !== show.id).length;
    nextShows = moveShow(nextShows, show.id, section, targetIndex);
  }

  try {
    if (seasonChanged) {
      selectedEpisodes = await tvmaze.getSeasonEpisodes(selectedSeason.sourceSeasonId);
    }
    if (repository) {
      if (seasonChanged) {
        await repository.addSeason(show, selectedSeason, selectedEpisodes, section);
      }
      if (section !== show.section) {
        await repository.saveShowPlacement(nextShows.filter(item => ['watching', 'queued', 'someday'].includes(item.section)));
      }
      await repository.updateShow(show.id, { title, withPriya });
      if (seasonChanged) {
        nextShows = await repository.loadShows(currentUser.id);
      } else {
        nextShows = nextShows.map(item => item.id === show.id ? { ...item, title, withPriya } : item);
      }
    } else {
      nextShows = nextShows.map(item => {
        if (item.id !== show.id) return item;
        const base = { ...item, title, withPriya };
        if (!seasonChanged) return base;
        const seasonSummary = {
          id: null,
          sourceSeasonId: selectedSeason.sourceSeasonId,
          seasonNumber: selectedSeason.seasonNumber,
          completedAt: null,
        };
        return {
          ...base,
          currentSeason: selectedSeason.seasonNumber,
          seasons: [...(base.seasons ?? []).filter(s => Number(s.seasonNumber) !== Number(selectedSeason.seasonNumber)), seasonSummary]
            .sort((a, b) => Number(a.seasonNumber) - Number(b.seasonNumber)),
          episodes: (selectedEpisodes ?? []).map(ep => ({
            id: `${show.id}-source-${ep.sourceEpisodeId}`,
            sourceEpisodeId: ep.sourceEpisodeId,
            episodeNumber: ep.episodeNumber,
            title: ep.title,
            runtimeMinutes: ep.runtimeMinutes ?? null,
            airdate: ep.airdate ?? null,
            summary: ep.summary ?? null,
            watched: false,
          })),
        };
      });
    }
  } catch {
    showToast(seasonChanged ? 'Could not load that season.' : 'Could not save those changes.');
    return;
  }

  state = { ...state, shows: nextShows, sheet: null, editingShowId: null, editingSeasons: null };
  writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
  showToast('Show updated.');
}
async function toggleShowPriya(showId) {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show) return;
  const withPriya = !show.withPriya;
  try {
    if (repository) await repository.updateShow(show.id, { withPriya });
  } catch {
    showToast('Could not update that show.');
    return;
  }
  state = {
    ...state,
    shows: state.shows.map(item => item.id === show.id ? { ...item, withPriya } : item),
    showMenuId: null,
  };
  writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
}

async function moveShowFromMenu(showId, section) {
  if (!ensureWritable() || !['watching', 'queued', 'someday'].includes(section)) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show || show.section === section) return;
  const targetIndex = state.shows.filter(item => item.section === section && item.id !== show.id).length;
  const nextShows = moveShow(state.shows, show.id, section, targetIndex);
  try {
    if (repository) await repository.saveShowPlacement(nextShows.filter(item => ['watching', 'queued', 'someday'].includes(item.section)));
  } catch {
    showToast('Could not move that show.');
    return;
  }
  state = { ...state, shows: nextShows, showMenuId: null };
  writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
}

async function setAsideShow(showId) {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show || !['watching', 'queued', 'someday'].includes(show.section)) return;
  const setAsideAt = new Date().toISOString();
  try {
    if (repository) await repository.updateShow(show.id, { section: 'set_aside', setAsideAt, archivedAt: null });
  } catch {
    showToast('Could not set that show aside.');
    return;
  }
  state = {
    ...state,
    shows: state.shows.map(item => item.id === show.id
      ? { ...item, section: 'set_aside', setAsideAt, archivedAt: null, expanded: false }
      : item),
    showMenuId: null,
  };
  writeCachedSnapshot({ shows: state.shows, cachedAt: setAsideAt });
  render();
  showToast(`${show.title} set aside.`);
}

async function resumeSetAsideShow(showId) {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show || show.section !== 'set_aside') return;
  const sortOrder = nextSortOrder('watching');
  try {
    if (repository) await repository.updateShow(show.id, { section: 'watching', sortOrder, setAsideAt: null });
  } catch {
    showToast('Could not resume that show.');
    return;
  }
  const resumed = { ...show, section: 'watching', sortOrder, setAsideAt: null, expanded: false };
  state = { ...state, shows: state.shows.map(item => item.id === show.id ? resumed : item), view: 'main' };
  writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
  showToast(`${show.title} resumed.`);
}

async function archiveShowFromMenu(showId) {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show || show.section === 'archived') return;
  const archivedAt = new Date().toISOString();
  const completed = isSeasonComplete(show);
  try {
    if (repository) await repository.archiveShow(show, archivedAt, { completed });
  } catch {
    showToast('Could not archive that show.');
    return;
  }
  const archived = archiveShowLocally(show, archivedAt, { completed });
  state = {
    ...state,
    shows: state.shows.map(item => item.id === show.id ? archived : item),
    showMenuId: null,
  };
  writeCachedSnapshot({ shows: state.shows, cachedAt: archivedAt });
  render();
  showToast(`${show.title} archived.`);
}

async function deleteShowFromMenu(showId) {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show) return;
  const confirmed = globalThis.confirm?.(`Delete “${show.title}”? This can’t be undone.`) ?? false;
  if (!confirmed) return;
  try {
    if (repository) await repository.deleteShow(show.id);
  } catch {
    showToast('Could not delete that show.');
    return;
  }
  state = { ...state, shows: state.shows.filter(item => item.id !== show.id), showMenuId: null };
  writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
  showToast(`${show.title} deleted.`);
}

async function resumeArchivedShow(showId) {
  if (!ensureWritable()) return;
  const show = state.shows.find(item => item.id === showId);
  if (!show || show.section !== 'archived') return;
  const sortOrder = nextSortOrder('watching');
  try {
    if (repository) await repository.updateShow(show.id, { section: 'watching', sortOrder, archivedAt: null, setAsideAt: null, availableSeasonNumber: null });
  } catch {
    showToast('Could not restore that show.');
    return;
  }
  const restored = { ...show, section: 'watching', sortOrder, archivedAt: null, setAsideAt: null, availableSeasonNumber: null, expanded: false };
  state = { ...state, shows: state.shows.map(item => item.id === show.id ? restored : item), view: 'main' };
  writeCachedSnapshot({ shows: state.shows, cachedAt: new Date().toISOString() });
  render();
  showToast(`${show.title} restored.`);
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

// The cloud is authoritative. Cache is only a read-only fallback, never proof
// that the list is current. Re-fetch whenever the installed PWA becomes visible.
async function syncCloudShows({ notify = false } = {}) {
  if (!repository || !currentUser) return false;
  if (cloudSyncPromise) return cloudSyncPromise;
  const activeRepository = repository;
  const userId = currentUser.id;
  const work = (async () => {
    try {
      const shows = await activeRepository.loadShows(userId);
      if (activeRepository !== repository || currentUser?.id !== userId) return false;
      // Keep expanded rows open without preserving stale show data.
      const freshShows = reconcileCloudShows(state.shows, shows);
      offlineReadOnly = false;
      state = { ...state, shows: freshShows, syncError: false };
      writeCachedSnapshot({ shows: freshShows, cachedAt: new Date().toISOString() });
      render();
      if (notify) {
        showToast(`Synced ${shows.length} shows.${state.preferences.priyaFilter ? ' With Priya filter is on.' : ''}`);
      }
      return true;
    } catch {
      if (activeRepository !== repository || currentUser?.id !== userId) return false;
      offlineReadOnly = true;
      state = { ...state, syncError: true };
      render();
      if (notify) showToast('Could not reach the cloud. Try again.');
      return false;
    }
  })();
  cloudSyncPromise = work;
  try {
    return await work;
  } finally {
    if (cloudSyncPromise === work) cloudSyncPromise = null;
  }
}

async function boot() {
  document.documentElement.dataset.fontScale = state.preferences.fontScale;
  document.documentElement.dataset.theme = state.preferences.themeMode ?? 'system';
  if (demoMode) {
    render();
    return;
  }
  root.innerHTML = '<div class="boot-message">Loading Watching…</div>';
  const cached = readCachedSnapshot();
  if (navigator.onLine === false && cached?.shows) {
    offlineReadOnly = true;
    state = { ...state, shows: cached.shows, syncError: true };
    render();
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
  offlineReadOnly = true;
  currentUser = user;
  const client = await getSupabaseClient();
  if (!client) throw new Error('Cloud sync is not configured.');
  repository = createRepository(client);
  const cached = readCachedSnapshot();
  if (cached?.shows) {
    state = { ...state, shows: cached.shows, syncError: false };
    render();
  }
  const synced = await syncCloudShows();
  if (synced) { void refreshCloudMetadata(); void backfillWatchProviders(); }
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
  cloudSyncPromise = null;
  clearCachedSnapshot();
  state = { ...state, shows: [], menuOpen: false, sheet: null, editingShowId: null, editingSeasons: null, showMenuId: null, completion: null, view: 'main' };
  root.innerHTML = renderAuthView();
}

async function refreshCloudMetadata() {
  if (!repository || !state.shows.length) return;
  try {
    const needsSynopsisBackfill = globalThis.localStorage?.getItem(`watching:synopses-v1:${currentUser?.id}`) !== '1';
    const sourceShows = state.shows;
    const result = await refreshTrackedMetadata({
      shows: sourceShows,
      lastCheckedAt: needsSynopsisBackfill ? null : lastMetadataCheckedAt,
      tvmaze,
      repository,
      now: new Date(),
    });
    // If a cloud reload or local change happened while TVmaze was updating,
    // do not overwrite the newer list with the older metadata snapshot.
    if (state.shows !== sourceShows) return;
    state = { ...state, shows: result.shows };
    lastMetadataCheckedAt = result.checkedAt;
    if (needsSynopsisBackfill) globalThis.localStorage?.setItem(`watching:synopses-v1:${currentUser?.id}`, '1');
    globalThis.localStorage?.setItem('watching:metadata-checked-at', result.checkedAt);
    writeCachedSnapshot({ shows: state.shows, cachedAt: result.checkedAt });
    render();
  } catch {}
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || demoMode) return;
  if (!repository) {
    if (navigator.onLine !== false) await boot();
    return;
  }
  const synced = await syncCloudShows();
  if (!synced) return;
  const then = lastMetadataCheckedAt ? new Date(lastMetadataCheckedAt).getTime() : 0;
  if (!then || Date.now() - then >= 6 * 60 * 60 * 1000) void refreshCloudMetadata();
});

window.addEventListener('online', () => {
  if (demoMode) return;
  if (repository) void syncCloudShows({ notify: true });
  else void boot();
});

boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }, { once: true });
}
