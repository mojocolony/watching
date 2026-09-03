import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('manifest identifies Watching and its standalone scope', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'Watching');
  assert.equal(manifest.short_name, 'Watching');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
});

test('service worker does not cache TVmaze or Supabase responses', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /request\.url/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /fetch\(request\)/);
});

test('service worker shell includes every cloud module imported by the app', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const path of [
    './src/services/auth.js',
    './src/services/supabase.js',
    './src/services/metadata-refresh.js',
    './src/data/repository.js',
    './src/ui/auth-view.js',
    './src/ui/write-guard.js',
  ]) assert.match(sw, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('service worker pre-caches all manifest icon variants', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /\.\/icons\/icon-192\.png/);
  assert.match(sw, /\.\/icons\/icon-512\.png/);
  assert.match(sw, /\.\/icons\/maskable-512\.png/);
});
