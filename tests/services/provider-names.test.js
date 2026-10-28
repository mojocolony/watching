import test from 'node:test';
import assert from 'node:assert/strict';
import { STREAMING_SERVICES, displayProviderName, subscribedProviderName, visibleProviderForShow } from '../../src/services/provider-names.js';

test('exactly six streaming services are offered', () => {
  assert.deepEqual(STREAMING_SERVICES, ['Netflix', 'Crave', 'Prime', 'Paramount+', 'Disney+', 'AppleTV']);
});

test('TMDB provider variants normalize to subscription names', () => {
  const aliases = {
    'Apple TV+': 'AppleTV',
    'Apple TV': 'AppleTV',
    'Disney Plus': 'Disney+',
    'Paramount Plus': 'Paramount+',
    'Amazon Prime Video': 'Prime',
    'Amazon Prime Video with Ads': 'Prime',
    'Netflix Standard with Ads': 'Netflix',
    'Crave': 'Crave',
  };
  for (const [source, expected] of Object.entries(aliases)) {
    assert.equal(subscribedProviderName(source), expected, source);
  }
});

test('separately billed channels are not confused with Prime or AppleTV', () => {
  for (const name of [
    'StackTV Amazon Channel', 'BritBox Amazon Channel', 'Starz Amazon Channel',
    'Crave Amazon Channel', 'Apple TV Amazon Channel', 'Paramount Plus Apple TV channel',
    'Hayu', 'CBC Gem', 'Global TV',
  ]) assert.equal(subscribedProviderName(name), null, name);
});

test('nonselected automatic providers are hidden, but custom sources are retained', () => {
  const show = {watchProvider: 'BritBox Amazon Channel', watchProviderManual: false};
  assert.equal(visibleProviderForShow(show), '');
  assert.equal(visibleProviderForShow({...show, watchProviderManual: true}), 'BritBox Amazon Channel');
  assert.equal(visibleProviderForShow({watchProvider: 'CNN/PVR', watchProviderManual: true}), 'CNN/PVR');
  assert.equal(visibleProviderForShow({watchProvider: 'Jellyfin', watchProviderManual: true}), 'Jellyfin');
  assert.equal(displayProviderName('Download'), 'Download');
});
