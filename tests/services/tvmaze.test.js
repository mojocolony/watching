import test from 'node:test';
import assert from 'node:assert/strict';
import { createTVMazeClient, TVMazeError } from '../../src/services/tvmaze.js';

function response(body, ok = true, status = 200) {
  return { ok, status, async json() { return body; } };
}

test('search normalizes TVmaze show results', async () => {
  const calls = [];
  const client = createTVMazeClient(async url => {
    calls.push(url);
    return response([{
      show: { id: 12, name: 'Slow Horses', premiered: '2022-04-01', network: null, webChannel: { name: 'Apple TV+' } },
    }]);
  });
  assert.deepEqual(await client.searchShows('Slow Horses'), [{
    sourceShowId: 12,
    title: 'Slow Horses',
    premieredYear: '2022',
    networkLabel: 'Apple TV+',
  }]);
  assert.match(calls[0], /search\/shows\?q=Slow%20Horses$/);
});

test('search skips fewer than two trimmed characters', async () => {
  let calls = 0;
  const client = createTVMazeClient(async () => { calls += 1; return response([]); });
  assert.deepEqual(await client.searchShows(' a '), []);
  assert.equal(calls, 0);
});

test('season episode normalization strips markup and keeps null runtime', async () => {
  const client = createTVMazeClient(async url => {
    assert.match(url, /seasons\/55\/episodes$/);
    return response([{ id: 8, number: 1, name: '<b>Pilot</b>', runtime: null, airdate: '2026-09-10' }]);
  });
  assert.deepEqual(await client.getSeasonEpisodes(55), [{
    sourceEpisodeId: 8,
    episodeNumber: 1,
    title: 'Pilot',
    runtimeMinutes: null,
    airdate: '2026-09-10',
  }]);
});

test('show seasons normalize numbered seasons only', async () => {
  const client = createTVMazeClient(async () => response([
    { id: 1, number: 1, premiereDate: '2025-01-01', endDate: '2025-02-01' },
    { id: 2, number: null, premiereDate: null, endDate: null },
  ]));
  assert.deepEqual(await client.getShowSeasons(99), [{ sourceSeasonId: 1, seasonNumber: 1, premiereDate: '2025-01-01', endDate: '2025-02-01' }]);
});

test('HTTP failures throw TVMazeError', async () => {
  const client = createTVMazeClient(async () => response({}, false, 503));
  await assert.rejects(() => client.getShowSeasons(1), TVMazeError);
});

test('recent updates pass through numeric timestamps', async () => {
  const client = createTVMazeClient(async url => {
    assert.match(url, /updates\/shows\?since=week$/);
    return response({ '12': 1788450000, '13': 1788450100 });
  });
  assert.deepEqual(await client.getRecentShowUpdates('week'), { '12': 1788450000, '13': 1788450100 });
});
