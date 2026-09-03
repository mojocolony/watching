import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

function jsFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? jsFiles(path) : path.endsWith('.js') ? [path] : [];
  });
}

test('all shipped JavaScript parses successfully', () => {
  const files = [...jsFiles(join(root, 'src')), join(root, 'sw.js')];
  const failures = [];
  for (const file of files) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (error) {
      failures.push(`${file}: ${error.stderr?.toString() || error.message}`);
    }
  }
  assert.deepEqual(failures, []);
});
