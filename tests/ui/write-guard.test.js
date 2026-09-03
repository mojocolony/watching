import test from 'node:test';
import assert from 'node:assert/strict';
import { canMutate } from '../../src/ui/write-guard.js';

test('demo mode can always mutate local data', () => {
  assert.equal(canMutate({ demoMode: true, repository: null, offlineReadOnly: false }), true);
});

test('cloud mode requires a repository and blocks offline read-only edits', () => {
  assert.equal(canMutate({ demoMode: false, repository: {}, offlineReadOnly: false }), true);
  assert.equal(canMutate({ demoMode: false, repository: null, offlineReadOnly: false }), false);
  assert.equal(canMutate({ demoMode: false, repository: {}, offlineReadOnly: true }), false);
});
