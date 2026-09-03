import { getSeasonProgress } from '../domain/shows.js';
import { icon } from './icons.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderEpisodeRow(episode, showId) {
  const runtime = episode.runtimeMinutes ? ` <span class="episode-runtime">· ${escapeHtml(episode.runtimeMinutes)}m</span>` : '';
  return `<li class="episode-row${episode.watched ? ' episode-row--watched' : ''}">
    <button class="episode-button" type="button" data-action="toggle-episode" data-show-id="${escapeHtml(showId)}" data-episode-id="${escapeHtml(episode.id)}" aria-pressed="${episode.watched ? 'true' : 'false'}">
      <span>${escapeHtml(episode.episodeNumber)}. ${escapeHtml(episode.title)}</span>${runtime}
    </button>
  </li>`;
}

function showProgress(show) {
  const { watched, total } = getSeasonProgress(show);
  const seasons = show.totalSeasons == null ? '?' : show.totalSeasons;
  return `Season ${escapeHtml(show.currentSeason)}/${escapeHtml(seasons)} · Episode ${escapeHtml(watched)}/${escapeHtml(total)}`;
}

function renderShowActions(show) {
  const priyaLabel = show.withPriya ? 'Remove Priya marker' : 'Mark With Priya';
  const moveLabel = show.section === 'watching' ? 'Move to Queued Up' : 'Move to Now Watching';
  const moveTarget = show.section === 'watching' ? 'queued' : 'watching';
  return `<div class="show-actions-scrim" data-action="close-show-menu"></div>
    <div class="show-actions-menu" role="menu" aria-label="${escapeHtml(show.title)} actions">
      <button type="button" role="menuitem" data-action="edit-show" data-show-id="${escapeHtml(show.id)}">Edit</button>
      <button type="button" role="menuitem" data-action="toggle-show-priya" data-show-id="${escapeHtml(show.id)}">${priyaLabel}</button>
      <button type="button" role="menuitem" data-action="move-show-section" data-show-id="${escapeHtml(show.id)}" data-section="${moveTarget}">${moveLabel}</button>
      <button class="show-actions-danger" type="button" role="menuitem" data-action="archive-show" data-show-id="${escapeHtml(show.id)}">Archive</button>
    </div>`;
}

export function renderShowRow(show, { menuOpen = false } = {}) {
  const priya = show.withPriya ? `<span class="priya-marker" title="With Priya">${icon('users', { size: 18 })}</span>` : '';
  const expanded = show.expanded === true;
  const episodes = expanded ? `<ol class="episode-list">${(show.episodes ?? []).map(ep => renderEpisodeRow(ep, show.id)).join('')}</ol>` : '';
  return `<article class="show-row" data-show-id="${escapeHtml(show.id)}" data-section="${escapeHtml(show.section)}">
    <div class="show-row-main">
      <button class="show-toggle" type="button" data-action="toggle-show" data-show-id="${escapeHtml(show.id)}" aria-expanded="${expanded ? 'true' : 'false'}">
        <span class="show-copy">
          <span class="show-title-line"><span class="show-title">${escapeHtml(show.title)}</span>${priya}</span>
          <span class="show-meta">${showProgress(show)}</span>
        </span>
        <span class="show-chevron">${icon(expanded ? 'chevron-up' : 'chevron-down', { size: 19 })}</span>
      </button>
      <button class="show-actions-button" type="button" data-action="open-show-menu" data-show-id="${escapeHtml(show.id)}" aria-label="More options for ${escapeHtml(show.title)}" aria-expanded="${menuOpen ? 'true' : 'false'}">${icon('ellipsis', { size: 21 })}</button>
    </div>
    ${menuOpen ? renderShowActions(show) : ''}
    ${episodes}
  </article>`;
}

export function renderSection(section, shows, preferences, showMenuId = null) {
  const isWatching = section === 'watching';
  const label = isWatching ? 'NOW WATCHING' : 'QUEUED UP';
  const collapsed = isWatching ? preferences.watchingCollapsed : preferences.queuedCollapsed;
  const contents = collapsed ? '' : `<div class="show-list" data-drop-section="${section}">${shows.map(show => renderShowRow(show, { menuOpen: show.id === showMenuId })).join('')}</div>`;
  return `<section class="watch-section" data-section="${section}">
    <button class="section-heading" type="button" data-action="toggle-section" data-section="${section}" aria-expanded="${collapsed ? 'false' : 'true'}">
      <span>${label}</span>${icon(collapsed ? 'chevron-down' : 'chevron-up', { size: 17 })}
    </button>
    ${contents}
  </section>`;
}
