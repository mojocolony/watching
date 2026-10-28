import test from 'node:test';
import assert from 'node:assert/strict';
import { displayProviderName } from '../../src/services/provider-names.js';

test('Apple subscription aliases use the same canonical label', () => {
  for (const provider of ['Apple TV+', 'Apple TV Plus', 'Apple TV']) {
    assert.equal(displayProviderName(provider), 'Apple TV');
  }
});
test('custom services are never renamed', () => {
  assert.equal(displayProviderName('CNN/PVR'), 'CNN/PVR');
  assert.equal(displayProviderName('BritBox Amazon Channel'), 'BritBox Amazon Channel');
});
