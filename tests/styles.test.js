import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('v0.2.1 uses 20 22 24px primary typography sizes', () => {
  assert.match(css, /html\[data-font-scale="small"\]\s*\{\s*--font-size:\s*20px/);
  assert.match(css, /html\[data-font-scale="medium"\]\s*\{\s*--font-size:\s*22px/);
  assert.match(css, /html\[data-font-scale="large"\]\s*\{\s*--font-size:\s*24px/);
  assert.match(css, /\.show-title\s*\{[^}]*font-size:\s*1em/s);
  assert.match(css, /\.episode-button[\s\S]*font-size:\s*\.92em/);
});

test('show action menu text matches the season and episode metadata size', () => {
  assert.match(css, /--meta-font-size:\s*calc\(var\(--font-size\) \* \.78\)/);
  assert.match(css, /\.show-meta\s*\{[^}]*font-size:\s*var\(--meta-font-size\)/s);
  assert.match(css, /\.show-actions-menu button\s*\{[^}]*font-size:\s*var\(--meta-font-size\)/s);
});

test('styles provide explicit light dark and system theme behavior', () => {
  assert.match(css, /html\[data-theme="light"\]/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /html\[data-theme="system"\]/);
});
