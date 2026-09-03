import test from 'node:test';
import assert from 'node:assert/strict';
import { getDropIndex } from '../../src/ui/drag-controller.js';

const rows = [
  { top: 100, bottom: 160 },
  { top: 160, bottom: 220 },
  { top: 220, bottom: 280 },
];

test('drop index reaches the very top of a list', () => {
  assert.equal(getDropIndex(rows, 90), 0);
  assert.equal(getDropIndex(rows, 110), 0);
});

test('drop index moves between rows based on row midpoints', () => {
  assert.equal(getDropIndex(rows, 150), 1);
  assert.equal(getDropIndex(rows, 200), 2);
});

test('drop index reaches the very bottom of a list', () => {
  assert.equal(getDropIndex(rows, 290), 3);
});

test('empty list accepts a drop at index zero', () => {
  assert.equal(getDropIndex([], 500), 0);
});
