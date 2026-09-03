import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_NAME, APP_VERSION, GITHUB_PAGES_BASE } from '../src/config.js';

test('exposes the fixed app identity', () => {
  assert.equal(APP_NAME, 'Watching');
  assert.equal(APP_VERSION, '0.2.0');
  assert.equal(GITHUB_PAGES_BASE, '/watching/');
});

test('cloud mode is used when credentials exist unless demo is explicitly requested', async () => {
  const { getPublicConfig, isCloudConfigured } = await import('../src/config.js');
  const cloud = getPublicConfig({ supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'pk', demoMode: false });
  assert.equal(isCloudConfigured(cloud), true);
  assert.equal(cloud.demoMode, false);
  const defaultCloud = getPublicConfig({ supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'pk' });
  assert.equal(defaultCloud.demoMode, false);
});

test('production page points cloud mode at the shared Ticking Supabase project', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /https:\/\/appesztafatypbxzdunr\.supabase\.co/);
  assert.match(html, /sb_publishable_[A-Za-z0-9_-]+/);
  assert.doesNotMatch(html, /demoMode\s*:\s*true/);
});
