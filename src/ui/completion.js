import { escapeHtml } from './markup.js';

export function renderCompletionSheet(show, nextSeasonNumber) {
  const nextActions = nextSeasonNumber ? `
      <button class="primary-button" type="button" data-action="completion-next" data-section="watching">Watch next season</button>
      <button class="secondary-button" type="button" data-action="completion-next" data-section="queued">Queue next season</button>
      <button class="text-button" type="button" data-action="completion-archive">Archive for now</button>` : `
      <button class="primary-button" type="button" data-action="completion-archive">Archive</button>`;
  return `<div class="sheet-header">
      <div><div class="sheet-kicker">Season complete</div><h2>${escapeHtml(show.title)}</h2></div>
      <button class="icon-button" type="button" data-action="close-completion" aria-label="Close">×</button>
    </div>
    ${nextSeasonNumber ? `<p class="completion-copy">Season ${escapeHtml(nextSeasonNumber)} is available.</p>` : ''}
    <div class="completion-actions">${nextActions}</div>`;
}

export function archiveShowLocally(show, completedAt) {
  return {
    ...show,
    section: 'archived',
    archivedAt: completedAt,
    availableSeasonNumber: null,
    expanded: false,
    seasons: (show.seasons ?? []).map(season => season.seasonNumber === show.currentSeason
      ? { ...season, completedAt }
      : season),
  };
}

export function startNextSeasonLocally(show, { season, episodes, section }) {
  return {
    ...show,
    section,
    currentSeason: season.seasonNumber,
    archivedAt: null,
    availableSeasonNumber: null,
    expanded: false,
    seasons: [...(show.seasons ?? []).filter(item => item.seasonNumber !== season.seasonNumber), {
      id: null,
      sourceSeasonId: season.sourceSeasonId ?? null,
      seasonNumber: season.seasonNumber,
      completedAt: null,
    }],
    episodes: (episodes ?? []).map(ep => ({
      id: `${show.id}-source-${ep.sourceEpisodeId ?? ep.episodeNumber}`,
      sourceEpisodeId: ep.sourceEpisodeId ?? null,
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      runtimeMinutes: ep.runtimeMinutes ?? null,
      airdate: ep.airdate ?? null,
      watched: false,
    })),
  };
}
