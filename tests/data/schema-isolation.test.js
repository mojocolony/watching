import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/202609030001_watching_schema.sql', import.meta.url);

test('Watching schema uses an explicit app allow-list inside the shared project', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /create table if not exists public\.watching_access/i);
  assert.match(sql, /watching_shows_select_own[\s\S]*watching_access/i);
  assert.match(sql, /revoke all on public\.watching_access from anon/i);
  assert.match(sql, /grant select on public\.watching_access to authenticated/i);
});

test('Watching data tables do not depend on Ticking or other app tables', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  const forbidden = [
    'public.brands', 'public.watch_models', 'public.watch_variants',
    'public.fetch_items', 'public.podstream_subscriptions', 'public.snippets_items',
  ];
  for (const table of forbidden) assert.doesNotMatch(sql, new RegExp(table.replace('.', '\\.')));
  assert.match(sql, /references auth\.users\(id\)/i);
});
