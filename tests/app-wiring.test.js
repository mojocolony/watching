import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

function functionSource(name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`async function ${nextName}`, start + 1);
  return source.slice(start, end);
}

test('Add Show cache is used only by Add Show, not the season-completion flow', () => {
  const completion = functionSource('startCompletionNextSeason', 'restoreArchivedShow');
  const add = functionSource('saveFetchedShow', 'openEditShow');
  assert.doesNotMatch(completion, /selectedSeasonEpisodes/);
  assert.match(add, /selectedSeasonEpisodes/);
});
