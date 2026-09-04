import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from '../../src/data/repository.js';

function deleteClientRecorder() {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        delete() {
          calls.push(['delete', table]);
          return {
            async eq(column, value) {
              calls.push(['eq', column, value]);
              return { error: null };
            },
          };
        },
      };
    },
  };
}

test('deleteShow deletes only the parent show row so database cascades remove its seasons and episodes', async () => {
  const client = deleteClientRecorder();
  const repository = createRepository(client);
  await repository.deleteShow('show-123');
  assert.deepEqual(client.calls, [
    ['delete', 'watching_shows'],
    ['eq', 'id', 'show-123'],
  ]);
});
