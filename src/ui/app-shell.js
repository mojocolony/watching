import { APP_VERSION } from '../config.js';
import { renderSection, escapeHtml } from './markup.js';
import { icon } from './icons.js';
import { displayProviderName, STREAMING_SERVICES } from '../services/provider-names.js';
import { renderCompletionSheet } from './completion.js';
import { renderEditShowSheet } from './add-show.js';

function renderMenu(state) {
  if (!state.menuOpen) return '';
  const scale = state.preferences.fontScale;
  return `<div class="menu-scrim" data-action="close-menu"></div>
    <aside class="menu-panel" aria-label="Menu">
      <button class="menu-item" type="button" data-action="open-set-aside">Set Aside</button>
      <button class="menu-item" type="button" data-action="open-archive">Archive</button>
      <button class="menu-item" type="button" data-action="sync-now">Sync now</button>
      <div class="menu-control-row" aria-label="Font size">
        <span class="menu-label">Font size</span>
        <div class="font-size-controls">
          <button type="button" data-action="set-font-scale" data-font-scale="small" aria-pressed="${scale === 'small'}">A−</button>
          <button type="button" data-action="set-font-scale" data-font-scale="medium" aria-pressed="${scale === 'medium'}">A</button>
          <button type="button" data-action="set-font-scale" data-font-scale="large" aria-pressed="${scale === 'large'}">A+</button>
        </div>
      </div>
      <div class="menu-control-row" aria-label="Theme">
        <span class="menu-label">Theme</span>
        <div class="theme-controls">
          <button type="button" data-action="set-theme-mode" data-theme-mode="system" aria-pressed="${state.preferences.themeMode === 'system'}">System</button>
          <button type="button" data-action="set-theme-mode" data-theme-mode="light" aria-pressed="${state.preferences.themeMode === 'light'}">Light</button>
          <button type="button" data-action="set-theme-mode" data-theme-mode="dark" aria-pressed="${state.preferences.themeMode === 'dark'}">Dark</button>
        </div>
      </div>
      <button class="menu-item" type="button" data-action="sign-out">Sign out</button>
      <div class="menu-version">v${APP_VERSION}</div>
    </aside>`;
}

function renderAddSheet() {
  return `<div class="sheet-scrim" data-action="close-sheet"></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="add-show-title">
      <div class="sheet-header">
        <h2 id="add-show-title">Add show</h2>
        <button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon('x', { size: 19 })}</button>
      </div>
      <label class="field-label" for="show-search">Search shows</label>
      <input id="show-search" class="text-field" type="search" autocomplete="off" placeholder="Start typing a title…" data-field="show-search">
      <div class="search-results" data-region="search-results" aria-live="polite"></div>
      <button class="manual-link" type="button" data-action="start-manual-add">Add manually</button>
    </section>`;
}

function renderSetAside(state) {
  const paused = state.shows.filter(show => show.section === 'set_aside');
  return `<main class="archive-view">
    <div class="archive-header">
      <button class="icon-button" type="button" data-action="close-set-aside" aria-label="Back">${icon('arrow-left', { size: 20 })}</button>
      <h1>Set Aside</h1>
    </div>
    <div class="archive-list">
      ${paused.length ? paused.map(show => {
        const watched = (show.episodes ?? []).filter(episode => episode.watched).length;
        const total = (show.episodes ?? []).length;
        return `<article class="archive-row">
          <div><strong>${escapeHtml(show.title)}</strong><div class="archive-meta">Season ${escapeHtml(show.currentSeason)} · ${watched}/${total} watched${show.setAsideAt ? ` · Set aside ${escapeHtml(formatArchiveDate(show.setAsideAt))}` : ''}</div></div>
          <div class="archive-actions">
            <button class="season-available" type="button" data-action="resume-set-aside" data-show-id="${escapeHtml(show.id)}">Resume</button>
            <button class="season-available" type="button" data-action="archive-show" data-show-id="${escapeHtml(show.id)}">Archive</button>
          </div>
        </article>`;
      }).join('') : '<p class="empty-state">Nothing set aside yet.</p>'}
    </div>
  </main>`;
}

function renderArchive(state) {
  const archived = state.shows.filter(show => show.section === 'archived');
  return `<main class="archive-view">
    <div class="archive-header">
      <button class="icon-button" type="button" data-action="close-archive" aria-label="Back">${icon('arrow-left', { size: 20 })}</button>
      <h1>Archive</h1>
    </div>
    <div class="archive-list">
      ${archived.length ? archived.map(show => {
        const current = (show.seasons ?? []).find(season => Number(season.seasonNumber) === Number(show.currentSeason));
        const finished = Boolean(current?.completedAt);
        const status = finished ? 'Finished' : 'Archived';
        return `<article class="archive-row">
          <div><strong>${escapeHtml(show.title)}</strong><div class="archive-meta">Season ${escapeHtml(show.currentSeason)}${show.archivedAt ? ` · ${status} ${escapeHtml(formatArchiveDate(show.archivedAt))}` : ''}</div></div>
          <div class="archive-actions">
            ${!finished ? `<button class="season-available" type="button" data-action="resume-archived" data-show-id="${escapeHtml(show.id)}">Resume</button>` : ''}
            ${show.availableSeasonNumber ? `<button class="season-available" type="button" data-action="restore-archived" data-show-id="${escapeHtml(show.id)}">Season ${escapeHtml(show.availableSeasonNumber)} available</button>` : ''}
          </div>
        </article>`;
      }).join('') : '<p class="empty-state">Nothing archived yet.</p>'}
    </div>
  </main>`;
}

function formatArchiveDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}


function renderEditSheet(state) {
  const show = state.shows.find(item => item.id === state.editingShowId);
  if (!show) return '';
  return `<div class="sheet-scrim" data-action="close-sheet"></div><section class="sheet" role="dialog" aria-modal="true">${renderEditShowSheet(show, state.editingSeasons ?? [])}</section>`;
}

function renderProviderSheet(state) {
  const show = state.shows.find(item => item.id === state.providerShowId);
  if (!show) return '';
  const options = STREAMING_SERVICES;
  const selected = show.watchProviderManual ? (show.watchProvider ? displayProviderName(show.watchProvider) : '__hide__') : '__auto__';
  const isOther = selected && !options.includes(selected) && !['__auto__', '__hide__'].includes(selected);
  return `<div class="sheet-scrim" data-action="close-sheet"></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="Streaming service or source">
      <div class="sheet-header"><h2>Watching on</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">×</button></div>
      <p class="edit-show-title">${escapeHtml(show.title)}</p>
      <label class="field-label" for="watch-provider-select">Streaming service / source</label>
      <select id="watch-provider-select" class="text-field" data-field="watch-provider">
        <option value="__auto__" ${selected === '__auto__' ? 'selected' : ''}>Automatic (Canada)</option>
        <option value="__hide__" ${selected === '__hide__' ? 'selected' : ''}>Hide service</option>
        ${options.map(item => `<option value="${escapeHtml(item)}" ${selected === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
        <option value="__other__" ${isOther ? 'selected' : ''}>Other source…</option>
      </select>
      <input class="text-field provider-other-field" data-field="watch-provider-other" placeholder="e.g. CNN/PVR or Jellyfin" aria-label="Other source" value="${isOther ? escapeHtml(selected) : ''}" ${isOther ? '' : 'hidden'}>
      <p class="sheet-kicker">Automatic results include only your six streaming services in Canada. Other sources and manual choices are retained.</p><button class="primary-button" type="button" data-action="save-watch-provider">Save</button>
    </section>`;
}

function renderCompletion(state) {
  if (!state.completion) return '';
  const show = state.shows.find(item => item.id === state.completion.showId);
  if (!show) return '';
  return `<div class="sheet-scrim" data-action="close-completion"></div><section class="sheet completion-sheet" role="dialog" aria-modal="true">${renderCompletionSheet(show, state.completion.nextSeasonNumber ?? null)}</section>`;
}

export function renderAppMarkup(state) {
  const filteredShows = state.preferences.priyaFilter
    ? state.shows.filter(show => show.withPriya || show.section === 'archived' || show.section === 'set_aside')
    : state.shows;

  const watching = filteredShows.filter(show => show.section === 'watching').sort((a, b) => a.sortOrder - b.sortOrder);
  const queued = filteredShows.filter(show => show.section === 'queued').sort((a, b) => a.sortOrder - b.sortOrder);
  const someday = filteredShows.filter(show => show.section === 'someday').sort((a, b) => a.sortOrder - b.sortOrder);
  const priyaActive = state.preferences.priyaFilter;

  const main = state.view === 'archive'
    ? renderArchive(state)
    : state.view === 'set_aside'
    ? renderSetAside(state)
    : `<main class="main-view">
        ${priyaActive ? '<div class="filter-notice">With Priya filter is on. <button type="button" data-action="toggle-priya-filter">Show all shows</button></div>' : ''}
        ${renderSection('watching', watching, state.preferences, state.showMenuId ?? null)}
        ${renderSection('queued', queued, state.preferences, state.showMenuId ?? null)}
        ${renderSection('someday', someday, state.preferences, state.showMenuId ?? null)}
      </main>`;

  return `<div class="watching-app" data-font-scale="${escapeHtml(state.preferences.fontScale)}" data-theme-mode="${escapeHtml(state.preferences.themeMode ?? 'system')}">
    <header class="app-header">
      <div class="brand"><span class="brand-icon">${icon('tv', { size: 21 })}</span><span>Watching</span></div>
      <button class="icon-button menu-button" type="button" data-action="open-menu" aria-label="Open menu">${icon('hamburger', { size: 22 })}</button>
    </header>
    ${state.syncError ? '<div class="sync-warning" role="alert">Showing a saved copy. Cloud sync is unavailable; changes are disabled. <button type="button" data-action="sync-now">Retry sync</button></div>' : ''}
    ${main}
    ${state.view === 'main' ? `<div class="floating-pill" aria-label="Quick actions">
      <button class="floating-button" type="button" data-action="add-show" aria-label="Add show">${icon('plus', { size: 24 })}</button>
      <span class="floating-divider"></span>
      <button class="floating-button${priyaActive ? ' floating-button--active' : ''}" type="button" data-action="toggle-priya-filter" aria-label="${priyaActive ? 'Show all shows' : 'Show shows with Priya'}" aria-pressed="${priyaActive}">${icon('users', { size: 22 })}</button>
    </div>` : ''}
    ${renderMenu(state)}
    ${state.sheet === 'add' ? renderAddSheet() : ''}
    ${state.sheet === 'edit' ? renderEditSheet(state) : ''}
    ${state.sheet === 'provider' ? renderProviderSheet(state) : ''}
    ${renderCompletion(state)}
  </div>`;
}
