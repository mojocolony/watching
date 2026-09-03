import { formatProgress } from '../domain/shows.js';
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

export function renderShowRow(show) {
  const progress = formatProgress(show);
  const priya = show.withPriya ? `<span class="priya-marker" title="With Priya">${icon('users', { size: 17 })}</span>` : '';
  const expanded = show.expanded === true;
  const episodes = expanded ? `<ol class="episode-list">${(show.episodes ?? []).map(ep => renderEpisodeRow(ep, show.id)).join('')}</ol><div class="show-edit-row"><button class="show-edit-button" type="button" data-action="edit-show" data-show-id="${escapeHtml(show.id)}">Edit</button></div>` : '';
  return `<article class="show-row" data-show-id="${escapeHtml(show.id)}" data-section="${escapeHtml(show.section)}">
    <button class="show-toggle" type="button" data-action="toggle-show" data-show-id="${escapeHtml(show.id)}" aria-expanded="${expanded ? 'true' : 'false'}">
      <span class="show-copy">
        <span class="show-title-line"><span class="show-title">${escapeHtml(show.title)}</span>${priya}</span>
        <span class="show-meta">Season ${escapeHtml(show.currentSeason)} · ${escapeHtml(progress)}</span>
      </span>
      <span class="show-chevron">${icon(expanded ? 'chevron-up' : 'chevron-down', { size: 18 })}</span>
    </button>
    ${episodes}
  </article>`;
}

export function renderSection(section, shows, preferences) {
  const isWatching = section === 'watching';
  const label = isWatching ? 'NOW WATCHING' : 'QUEUED UP';
  const collapsed = isWatching ? preferences.watchingCollapsed : preferences.queuedCollapsed;
  const contents = collapsed ? '' : `<div class="show-list" data-drop-section="${section}">${shows.map(renderShowRow).join('')}</div>`;
  return `<section class="watch-section" data-section="${section}">
    <button class="section-heading" type="button" data-action="toggle-section" data-section="${section}" aria-expanded="${collapsed ? 'false' : 'true'}">
      <span>${label}</span>${icon(collapsed ? 'chevron-down' : 'chevron-up', { size: 16 })}
    </button>
    ${contents}
  </section>`;
}
