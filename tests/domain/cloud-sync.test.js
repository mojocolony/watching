import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileCloudShows } from '../../src/domain/cloud-sync.js';

test('cloud refresh replaces stale membership and values, preserving only expansion', () => {
  const local = [
    { id: 'one', title: 'Outdated title', section: 'queued', expanded: true },
    { id: 'gone', title: 'Locally cached', section: 'watching', expanded: true },
  ];
  const remote = [
    { id: 'one', title: 'Current title', section: 'someday', expanded: false },
    { id: 'new', title: 'New on desktop', section: 'watching', expanded: false },
  ];
  const next = reconcileCloudShows(local, remote);
  assert.deepEqual(next, [
    { id: 'one', title: 'Current title', section: 'someday', expanded: true },
    { id: 'new', title: 'New on desktop', section: 'watching', expanded: false },
  ]);
  assert.equal(local.length, 2);
  assert.equal(remote[0].expanded, false);
});

test('an intentionally empty cloud result stays empty', () => {
  assert.deepEqual(reconcileCloudShows([{ id: 'old', expanded: true }], []), []);
});
