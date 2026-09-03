import { mergeEpisodeMetadata } from '../domain/shows.js';

const DAY = 24 * 60 * 60 * 1000;

export function selectUpdateWindow(lastCheckedAt, now = new Date()) {
  if (!lastCheckedAt) return null;
  const then = lastCheckedAt instanceof Date ? lastCheckedAt : new Date(lastCheckedAt);
  if (Number.isNaN(then.getTime())) return null;
  const elapsed = Math.max(0, now.getTime() - then.getTime());
  if (elapsed <= DAY) return 'day';
  if (elapsed <= 7 * DAY) return 'week';
  if (elapsed <= 30 * DAY) return 'month';
  return null;
}

function localEpisodeId() {
  return globalThis.crypto?.randomUUID?.() ?? `episode-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function mergeTrackedShowMetadata(show, seasons, incomingEpisodes) {
  const existingSeasons = new Map((show.seasons ?? []).map(season => [Number(season.seasonNumber), season]));
  const normalizedSeasons = (seasons ?? []).map(season => {
    const existing = existingSeasons.get(Number(season.seasonNumber));
    return existing ? { ...existing, ...season, id: existing.id ?? null, completedAt: existing.completedAt ?? null } : { ...season };
  }).sort((a, b) => a.seasonNumber - b.seasonNumber);
  if (show.section === 'archived') {
    const nextSeason = normalizedSeasons.find(season => season.seasonNumber > show.currentSeason);
    return {
      ...show,
      seasons: normalizedSeasons,
      availableSeasonNumber: nextSeason?.seasonNumber ?? null,
    };
  }

  const existing = show.episodes ?? [];
  const bySource = new Map(existing.filter(ep => ep.sourceEpisodeId != null).map(ep => [Number(ep.sourceEpisodeId), ep]));
  const byNumber = new Map(existing.map(ep => [Number(ep.episodeNumber), ep]));
  const episodes = (incomingEpisodes ?? []).map(incoming => {
    const old = bySource.get(Number(incoming.sourceEpisodeId)) ?? byNumber.get(Number(incoming.episodeNumber));
    if (old) return mergeEpisodeMetadata(old, incoming);
    return { id: localEpisodeId(), watched: false, ...incoming };
  }).sort((a, b) => a.episodeNumber - b.episodeNumber);

  return {
    ...show,
    seasons: normalizedSeasons,
    episodes,
  };
}

async function refreshOne(show, tvmaze, sourceUpdatedAt) {
  const seasons = await tvmaze.getShowSeasons(show.sourceShowId);
  if (show.section === 'archived') {
    return { ...mergeTrackedShowMetadata(show, seasons, []), sourceUpdatedAt: sourceUpdatedAt ?? show.sourceUpdatedAt };
  }
  const season = seasons.find(item => item.seasonNumber === Number(show.currentSeason));
  if (!season) return { ...show, seasons, sourceUpdatedAt: sourceUpdatedAt ?? show.sourceUpdatedAt };
  const episodes = await tvmaze.getSeasonEpisodes(season.sourceSeasonId);
  return { ...mergeTrackedShowMetadata(show, seasons, episodes), sourceUpdatedAt: sourceUpdatedAt ?? show.sourceUpdatedAt };
}

export async function refreshTrackedMetadata({ shows, lastCheckedAt, tvmaze, repository = null, now = new Date() }) {
  const tracked = (shows ?? []).filter(show => show.source === 'tvmaze' && show.sourceShowId != null);
  if (tracked.length === 0) return { shows: (shows ?? []).map(show => ({ ...show })), checkedAt: now.toISOString(), changedShowIds: [] };

  const window = selectUpdateWindow(lastCheckedAt, now);
  let updates = null;
  if (window) {
    try {
      updates = await tvmaze.getRecentShowUpdates(window);
    } catch {
      updates = null;
    }
  }

  const changed = new Map();
  for (let offset = 0; offset < tracked.length; offset += 4) {
    const batch = tracked.slice(offset, offset + 4);
    const results = await Promise.all(batch.map(async show => {
      const sourceStamp = updates?.[String(show.sourceShowId)];
      if (updates && sourceStamp == null) return null;
      try {
        const next = await refreshOne(show, tvmaze, sourceStamp);
        const didChange = JSON.stringify(next) !== JSON.stringify(show);
        if (didChange && repository?.mergeFetchedMetadata) {
          const persisted = await repository.mergeFetchedMetadata(show.id, next);
          return persisted ?? next;
        }
        return didChange ? next : null;
      } catch {
        return null;
      }
    }));
    results.filter(Boolean).forEach(next => changed.set(next.id, next));
  }

  const nextShows = (shows ?? []).map(show => changed.get(show.id) ?? show);
  return { shows: nextShows, checkedAt: now.toISOString(), changedShowIds: [...changed.keys()] };
}
