import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('v0.2 uses a larger typography scale', () => {
  assert.match(css, /html\[data-font-scale=\"small\"\]\s*\{\s*--font-size:\s*15\.5px/);
  assert.match(css, /html\[data-font-scale=\"medium\"\]\s*\{\s*--font-size:\s*17px/);
  assert.match(css, /html\[data-font-scale=\"large\"\]\s*\{\s*--font-size:\s*19px/);
  assert.match(css, /\.episode-button[\s\S]*font-size:\s*\.92em/);
});

test('styles provide explicit light dark and system theme behavior', () => {
  assert.match(css, /html\[data-theme=\"light\"\]/);
  assert.match(css, /html\[data-theme=\"dark\"\]/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /html\[data-theme=\"system\"\]/);
});
