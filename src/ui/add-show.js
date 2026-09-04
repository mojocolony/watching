import { escapeHtml } from './markup.js';

export function renderSearchResults(results) {
  if (!results?.length) return '<p class="search-empty">No matches</p>';
  return results.map((item, index) => {
    const details = [item.premieredYear, item.networkLabel].filter(Boolean).join(' · ');
    return `<button class="search-result" type="button" data-action="select-search-result" data-result-index="${index}">
      <span class="search-result-title">${escapeHtml(item.title)}</span>
      ${details ? `<span class="search-result-meta">${escapeHtml(details)}</span>` : ''}
    </button>`;
  }).join('');
}

export function renderFetchedSetup(result, seasons, selectedSeasonId = null) {
  const options = (seasons ?? [])
    .slice()
    .sort((a, b) => b.seasonNumber - a.seasonNumber)
    .map(season => `<option value="${escapeHtml(season.sourceSeasonId)}"${Number(season.sourceSeasonId) === Number(selectedSeasonId) ? ' selected' : ''}>Season ${escapeHtml(season.seasonNumber)}</option>`)
    .join('');

  return `<div class="sheet-header">
      <div>
        <div class="sheet-kicker">Add show</div>
        <h2>${escapeHtml(result.title)}</h2>
      </div>
      <button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">×</button>
    </div>
    <label class="field-label" for="fetched-season">Season</label>
    <select id="fetched-season" class="text-field" data-field="fetched-season">${options}</select>
    <fieldset class="choice-group">
      <legend>Put it in</legend>
      <label><input type="radio" name="fetched-section" value="watching" checked> Now Watching</label>
      <label><input type="radio" name="fetched-section" value="queued"> Queued Up</label>
    </fieldset>
    <label class="check-row"><input type="checkbox" data-field="fetched-priya"> <span>With Priya</span></label>
    <button class="primary-button" type="button" data-action="save-fetched-show">Add show</button>`;
}


export async function chooseDefaultSeasonWithEpisodes(seasons, getSeasonEpisodes) {
  const ordered = (seasons ?? []).slice().sort((a, b) => Number(b.seasonNumber) - Number(a.seasonNumber));
  if (!ordered.length) return { season: null, episodes: [] };
  for (const season of ordered) {
    const episodes = await getSeasonEpisodes(season.sourceSeasonId);
    if (episodes?.length) return { season, episodes };
  }
  return { season: ordered[0], episodes: [] };
}

export function buildFetchedShow({ result, season, episodes, section, withPriya, sortOrder, id, totalSeasons = null }) {
  return {
    id,
    source: 'tvmaze',
    sourceShowId: result.sourceShowId,
    sourceUpdatedAt: null,
    title: result.title,
    section,
    sortOrder,
    withPriya: Boolean(withPriya),
    currentSeason: season.seasonNumber,
    totalSeasons: totalSeasons == null ? null : Number(totalSeasons),
    expanded: false,
    archivedAt: null,
    availableSeasonNumber: null,
    seasons: [{
      id: null,
      sourceSeasonId: season.sourceSeasonId,
      seasonNumber: season.seasonNumber,
      completedAt: null,
    }],
    episodes: (episodes ?? []).map(ep => ({
      id: `${id}-source-${ep.sourceEpisodeId}`,
      sourceEpisodeId: ep.sourceEpisodeId,
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      runtimeMinutes: ep.runtimeMinutes ?? null,
      airdate: ep.airdate ?? null,
      watched: false,
    })),
  };
}

export function buildManualShow({ id, title, seasonNumber, episodeCount, section, withPriya, sortOrder }) {
  const season = {
    id: null,
    sourceSeasonId: null,
    seasonNumber: Number(seasonNumber),
    completedAt: null,
  };
  return {
    id,
    source: 'manual',
    sourceShowId: null,
    sourceUpdatedAt: null,
    title,
    section,
    sortOrder,
    withPriya: Boolean(withPriya),
    currentSeason: Number(seasonNumber),
    totalSeasons: null,
    expanded: false,
    archivedAt: null,
    availableSeasonNumber: null,
    season,
    seasons: [season],
    episodes: Array.from({ length: Number(episodeCount) }, (_, index) => ({
      id: `${id}-ep-${index + 1}`,
      sourceEpisodeId: null,
      episodeNumber: index + 1,
      title: `Episode ${index + 1}`,
      runtimeMinutes: null,
      airdate: null,
      watched: false,
    })),
  };
}


export function renderEditShowSheet(show, availableSeasons = []) {
  const watchingChecked = show.section === 'watching' ? ' checked' : '';
  const queuedChecked = show.section === 'queued' ? ' checked' : '';
  const priyaChecked = show.withPriya ? ' checked' : '';
  const titleControl = show.source === 'manual'
    ? `<label class="field-label" for="edit-title">Title</label><input id="edit-title" class="text-field" data-field="edit-title" value="${escapeHtml(show.title)}" autocomplete="off">`
    : `<div class="edit-show-title">${escapeHtml(show.title)}</div>`;
  const seasonOptions = show.source === 'tvmaze'
    ? (availableSeasons.length ? availableSeasons : (show.seasons ?? []))
      .slice()
      .sort((a, b) => Number(a.seasonNumber) - Number(b.seasonNumber))
      .map(season => `<option value="${escapeHtml(season.sourceSeasonId)}"${Number(season.seasonNumber) === Number(show.currentSeason) ? ' selected' : ''}>Season ${escapeHtml(season.seasonNumber)}</option>`)
      .join('')
    : '';
  const seasonControl = seasonOptions
    ? `<label class="field-label" for="edit-season">Season</label><select id="edit-season" class="text-field" data-field="edit-season">${seasonOptions}</select>`
    : '';
  return `<div class="sheet-header">
      <div><div class="sheet-kicker">Edit show</div><h2>${escapeHtml(show.title)}</h2></div>
      <button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">×</button>
    </div>
    ${titleControl}
    ${seasonControl}
    <fieldset class="choice-group">
      <legend>Put it in</legend>
      <label><input type="radio" name="edit-section" value="watching"${watchingChecked}> Now Watching</label>
      <label><input type="radio" name="edit-section" value="queued"${queuedChecked}> Queued Up</label>
    </fieldset>
    <label class="check-row"><input type="checkbox" data-field="edit-priya"${priyaChecked}> <span>With Priya</span></label>
    <button class="primary-button" type="button" data-action="save-edit-show">Save changes</button>`;
}
