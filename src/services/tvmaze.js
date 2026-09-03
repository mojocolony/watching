const TVMAZE_BASE = 'https://api.tvmaze.com';

export class TVMazeError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'TVMazeError';
    this.status = status;
  }
}

function textOnly(value, fallback = '') {
  if (value == null) return fallback;
  return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || fallback;
}

async function jsonOrThrow(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    throw new TVMazeError(error?.message || 'TVmaze request failed');
  }
  if (!response?.ok) throw new TVMazeError(`TVmaze returned ${response?.status ?? 'an error'}`, response?.status ?? null);
  try {
    return await response.json();
  } catch {
    throw new TVMazeError('TVmaze returned invalid JSON');
  }
}

function normalizeEpisode(episode) {
  return {
    sourceEpisodeId: Number(episode.id),
    episodeNumber: Number(episode.number),
    title: textOnly(episode.name, `Episode ${episode.number}`),
    runtimeMinutes: Number.isFinite(Number(episode.runtime)) && Number(episode.runtime) > 0 ? Number(episode.runtime) : null,
    airdate: episode.airdate || null,
  };
}

export function createTVMazeClient(fetchImpl = globalThis.fetch) {
  return {
    async searchShows(query) {
      const trimmed = String(query ?? '').trim();
      if (trimmed.length < 2) return [];
      const data = await jsonOrThrow(fetchImpl, `${TVMAZE_BASE}/search/shows?q=${encodeURIComponent(trimmed)}`);
      if (!Array.isArray(data)) throw new TVMazeError('TVmaze search response was not a list');
      return data.map(item => item?.show).filter(Boolean).map(show => ({
        sourceShowId: Number(show.id),
        title: textOnly(show.name, 'Untitled'),
        premieredYear: show.premiered ? String(show.premiered).slice(0, 4) : '',
        networkLabel: textOnly(show.network?.name || show.webChannel?.name || ''),
      }));
    },

    async getShowSeasons(showId) {
      const data = await jsonOrThrow(fetchImpl, `${TVMAZE_BASE}/shows/${encodeURIComponent(showId)}/seasons`);
      if (!Array.isArray(data)) throw new TVMazeError('TVmaze seasons response was not a list');
      return data.filter(season => Number(season.number) > 0).map(season => ({
        sourceSeasonId: Number(season.id),
        seasonNumber: Number(season.number),
        premiereDate: season.premiereDate || null,
        endDate: season.endDate || null,
      }));
    },

    async getSeasonEpisodes(seasonId) {
      const data = await jsonOrThrow(fetchImpl, `${TVMAZE_BASE}/seasons/${encodeURIComponent(seasonId)}/episodes`);
      if (!Array.isArray(data)) throw new TVMazeError('TVmaze episode response was not a list');
      return data.filter(episode => Number(episode.number) > 0).map(normalizeEpisode).sort((a, b) => a.episodeNumber - b.episodeNumber);
    },

    async getRecentShowUpdates(since = 'day') {
      const allowed = new Set(['day', 'week', 'month']);
      if (!allowed.has(since)) throw new TVMazeError('Unsupported TVmaze update window');
      const data = await jsonOrThrow(fetchImpl, `${TVMAZE_BASE}/updates/shows?since=${since}`);
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new TVMazeError('TVmaze updates response was invalid');
      return Object.fromEntries(Object.entries(data).map(([id, timestamp]) => [id, Number(timestamp)]));
    },
  };
}

export const tvmaze = createTVMazeClient();
