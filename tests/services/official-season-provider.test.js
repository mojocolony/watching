import test from 'node:test';
import assert from 'node:assert/strict';
import { officialSeasonProvider } from '../../supabase/functions/watching-providers/official-overrides.js';

test('The Paper Season 1 uses the verified Crave listing', () => {
  assert.equal(officialSeasonProvider({
    title: 'The Paper', sourceShowId: 84611, seasonNumber: 1,
  }), 'Crave');
});

test('a season-specific listing does not carry over to Season 2', () => {
  assert.equal(officialSeasonProvider({
    title: 'The Paper', sourceShowId: 84611, seasonNumber: 2,
  }), null);
});

test('official fallback never matches a different show or missing season', () => {
  assert.equal(officialSeasonProvider({title: 'The Paper', sourceShowId: 31, seasonNumber: 1}), null);
  assert.equal(officialSeasonProvider({title: 'Another Show', sourceShowId: 84611, seasonNumber: 1}), null);
  assert.equal(officialSeasonProvider({title: 'The Paper', sourceShowId: 84611}), null);
});
