import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAuthView } from '../../src/ui/auth-view.js';

test('password login has no magic-link language or email callback', () => {
  const html = renderAuthView();
  assert.match(html, /Watching/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.match(html, /data-action="sign-in"/);
  assert.doesNotMatch(html, /magic|link|check your email/i);
});
