function nowIso() {
  return new Date().toISOString();
}

function throwIf(error) {
  if (error) throw error;
}

export function mapDbEpisode(row) {
  return {
    id: row.id,
    sourceEpisodeId: row.source_episode_id == null ? null : Number(row.source_episode_id),
    episodeNumber: Number(row.episode_number),
    title: row.title,
    runtimeMinutes: row.runtime_minutes == null ? null : Number(row.runtime_minutes),
    airdate: row.airdate ?? null,
    watched: Boolean(row.watched),
  };
}

export function mapDbShow(row) {
  const seasonRows = (row.watching_seasons ?? []).slice().sort((a, b) => Number(a.season_number) - Number(b.season_number));
  const current = seasonRows.find(season => Number(season.season_number) === Number(row.current_season));
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    sourceShowId: row.source_show_id == null ? null : Number(row.source_show_id),
    sourceUpdatedAt: row.source_updated_at == null ? null : Number(row.source_updated_at),
    title: row.title,
    section: row.section,
    sortOrder: Number(row.sort_order ?? 0),
    withPriya: Boolean(row.with_priya),
    currentSeason: Number(row.current_season),
    totalSeasons: row.total_seasons == null ? null : Number(row.total_seasons),
    availableSeasonNumber: row.available_season_number == null ? null : Number(row.available_season_number),
    archivedAt: row.archived_at ?? null,
    expanded: false,
    seasons: seasonRows.map(season => ({
      id: season.id,
      sourceSeasonId: season.source_season_id == null ? null : Number(season.source_season_id),
      seasonNumber: Number(season.season_number),
      completedAt: season.completed_at ?? null,
    })),
    episodes: (current?.watching_episodes ?? []).map(mapDbEpisode).sort((a, b) => a.episodeNumber - b.episodeNumber),
  };
}

export function toMetadataEpisodeUpdate(episode) {
  return {
    title: episode.title,
    runtime_minutes: episode.runtimeMinutes ?? null,
    airdate: episode.airdate ?? null,
    updated_at: nowIso(),
  };
}


export function toSeasonUpsert(showId, season) {
  return {
    show_id: showId,
    source_season_id: season.sourceSeasonId ?? null,
    season_number: Number(season.seasonNumber),
  };
}

export function toSeasonEpisodeUpsert(seasonId, episode) {
  return {
    season_id: seasonId,
    source_episode_id: episode.sourceEpisodeId ?? null,
    episode_number: Number(episode.episodeNumber),
    title: episode.title,
    runtime_minutes: episode.runtimeMinutes ?? null,
    airdate: episode.airdate ?? null,
  };
}

export function toPlacementUpdate(show) {
  return {
    id: show.id,
    section: show.section,
    sort_order: show.sortOrder,
    updated_at: nowIso(),
  };
}

function showInsertPayload(userId, payload) {
  return {
    user_id: userId,
    source: payload.source,
    source_show_id: payload.sourceShowId ?? null,
    source_updated_at: payload.sourceUpdatedAt ?? null,
    title: payload.title,
    section: payload.section,
    sort_order: payload.sortOrder ?? 0,
    with_priya: Boolean(payload.withPriya),
    current_season: Number(payload.currentSeason),
    total_seasons: payload.totalSeasons == null ? null : Number(payload.totalSeasons),
    available_season_number: payload.availableSeasonNumber ?? null,
  };
}

export function createRepository(client) {
  return {
    async loadShows(userId) {
      const { data, error } = await client
        .from('watching_shows')
        .select('*, watching_seasons(*, watching_episodes(*))')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });
      throwIf(error);
      return (data ?? []).map(mapDbShow);
    },

    async saveEpisodeWatched(episodeId, watched) {
      const { error } = await client.from('watching_episodes').update({ watched: Boolean(watched), updated_at: nowIso() }).eq('id', episodeId);
      throwIf(error);
    },

    async saveShowPlacement(changedShows) {
      await Promise.all(changedShows.map(async show => {
        const payload = toPlacementUpdate(show);
        const { error } = await client.from('watching_shows').update({
          section: payload.section,
          sort_order: payload.sort_order,
          updated_at: payload.updated_at,
        }).eq('id', payload.id);
        throwIf(error);
      }));
    },

    async createShow(userId, payload) {
      const { data: showRow, error: showError } = await client
        .from('watching_shows')
        .insert(showInsertPayload(userId, payload))
        .select()
        .single();
      throwIf(showError);

      const seasonPayload = payload.season ?? {
        sourceSeasonId: null,
        seasonNumber: payload.currentSeason,
      };
      const { data: seasonRow, error: seasonError } = await client
        .from('watching_seasons')
        .insert({
          show_id: showRow.id,
          source_season_id: seasonPayload.sourceSeasonId ?? null,
          season_number: Number(seasonPayload.seasonNumber),
        })
        .select()
        .single();
      throwIf(seasonError);

      const episodeRows = (payload.episodes ?? []).map(episode => ({
        season_id: seasonRow.id,
        source_episode_id: episode.sourceEpisodeId ?? null,
        episode_number: Number(episode.episodeNumber),
        title: episode.title,
        runtime_minutes: episode.runtimeMinutes ?? null,
        airdate: episode.airdate ?? null,
        watched: Boolean(episode.watched),
      }));
      if (episodeRows.length) {
        const { error: episodeError } = await client.from('watching_episodes').insert(episodeRows);
        throwIf(episodeError);
      }
      const rows = await this.loadShows(userId);
      return rows.find(show => show.id === showRow.id) ?? null;
    },

    async updateShow(showId, patch) {
      const dbPatch = { updated_at: nowIso() };
      if ('title' in patch) dbPatch.title = patch.title;
      if ('section' in patch) dbPatch.section = patch.section;
      if ('sortOrder' in patch) dbPatch.sort_order = patch.sortOrder;
      if ('withPriya' in patch) dbPatch.with_priya = Boolean(patch.withPriya);
      if ('currentSeason' in patch) dbPatch.current_season = Number(patch.currentSeason);
      if ('totalSeasons' in patch) dbPatch.total_seasons = patch.totalSeasons == null ? null : Number(patch.totalSeasons);
      if ('availableSeasonNumber' in patch) dbPatch.available_season_number = patch.availableSeasonNumber;
      if ('archivedAt' in patch) dbPatch.archived_at = patch.archivedAt;
      if ('sourceUpdatedAt' in patch) dbPatch.source_updated_at = patch.sourceUpdatedAt;
      const { error } = await client.from('watching_shows').update(dbPatch).eq('id', showId);
      throwIf(error);
    },

    async archiveShow(show, archivedAt, { completed = true } = {}) {
      await this.updateShow(show.id, { section: 'archived', archivedAt, availableSeasonNumber: null });
      const current = (show.seasons ?? []).find(season => season.seasonNumber === show.currentSeason);
      if (completed && current?.id) {
        const { error } = await client.from('watching_seasons').update({ completed_at: archivedAt }).eq('id', current.id);
        throwIf(error);
      }
    },

    async deleteShow(showId) {
      const { error } = await client.from('watching_shows').delete().eq('id', showId);
      throwIf(error);
    },

    async addSeason(show, season, episodes, section) {
      const { data: seasonRow, error } = await client.from('watching_seasons').upsert(
        toSeasonUpsert(show.id, season),
        { onConflict: 'show_id,season_number' },
      ).select().single();
      throwIf(error);
      if (episodes.length) {
        const rows = episodes.map(ep => toSeasonEpisodeUpsert(seasonRow.id, ep));
        const { error: epError } = await client.from('watching_episodes').upsert(rows, { onConflict: 'season_id,episode_number' });
        throwIf(epError);
      }
      await this.updateShow(show.id, {
        currentSeason: season.seasonNumber,
        section,
        archivedAt: null,
        availableSeasonNumber: null,
      });
    },

    async mergeFetchedMetadata(showId, nextShow) {
      await this.updateShow(showId, {
        sourceUpdatedAt: nextShow.sourceUpdatedAt,
        availableSeasonNumber: nextShow.availableSeasonNumber ?? null,
        totalSeasons: nextShow.totalSeasons ?? null,
      });
      if (nextShow.section === 'archived') return nextShow;
      const season = (nextShow.seasons ?? []).find(item => item.seasonNumber === nextShow.currentSeason);
      if (!season) return nextShow;
      const { data: dbSeason, error } = await client.from('watching_seasons').upsert({
        show_id: showId,
        source_season_id: season.sourceSeasonId ?? null,
        season_number: season.seasonNumber,
      }, { onConflict: 'show_id,season_number' }).select().single();
      throwIf(error);

      const persistedEpisodes = [];
      for (const episode of nextShow.episodes ?? []) {
        if (episode.id && /^[0-9a-f-]{36}$/i.test(episode.id)) {
          const { error: updateError } = await client.from('watching_episodes').update(toMetadataEpisodeUpdate(episode)).eq('id', episode.id);
          throwIf(updateError);
          persistedEpisodes.push(episode);
        } else {
          const { data: persistedEpisode, error: insertError } = await client.from('watching_episodes').upsert({
            season_id: dbSeason.id,
            source_episode_id: episode.sourceEpisodeId ?? null,
            episode_number: episode.episodeNumber,
            title: episode.title,
            runtime_minutes: episode.runtimeMinutes ?? null,
            airdate: episode.airdate ?? null,
            watched: false,
          }, { onConflict: 'season_id,episode_number' }).select('id').single();
          throwIf(insertError);
          persistedEpisodes.push({ ...episode, id: persistedEpisode.id });
        }
      }

      return {
        ...nextShow,
        seasons: (nextShow.seasons ?? []).map(item => item.seasonNumber === nextShow.currentSeason
          ? { ...item, id: dbSeason.id }
          : item),
        episodes: persistedEpisodes,
      };
    },
  };
}
