export function getSeasonProgress(show) {
  const episodes = show.episodes ?? [];
  return {
    watched: episodes.filter(episode => episode.watched).length,
    total: episodes.length,
  };
}

export function toggleEpisodeWatched(show, episodeId) {
  return {
    ...show,
    episodes: (show.episodes ?? []).map(episode =>
      episode.id === episodeId ? { ...episode, watched: !episode.watched } : episode
    ),
  };
}

export function isSeasonComplete(show) {
  const { watched, total } = getSeasonProgress(show);
  return total > 0 && watched === total;
}

export function mergeEpisodeMetadata(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    watched: existing.watched,
  };
}

export function getNextSeasonNumber(show) {
  const wanted = Number(show.currentSeason) + 1;
  const numbers = (show.seasons ?? []).map(season => Number(season.seasonNumber));
  return numbers.includes(wanted) ? wanted : null;
}

export function formatProgress(show) {
  const { watched, total } = getSeasonProgress(show);
  if (show.section === 'queued' && watched === 0) {
    return `${total} episode${total === 1 ? '' : 's'}`;
  }
  return `${watched}/${total}`;
}
