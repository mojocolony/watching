import test from 'node:test';
import assert from 'node:assert/strict';
import { moveShow, normalizeSectionOrder } from '../../src/domain/ordering.js';

const base = [
  { id: 'a', section: 'watching', sortOrder: 0 },
  { id: 'b', section: 'watching', sortOrder: 1 },
  { id: 'c', section: 'queued', sortOrder: 0 },
];

test('moves a show within its section', () => {
  const next = moveShow(base, 'b', 'watching', 0);
  assert.deepEqual(next.filter(s => s.section === 'watching').map(s => s.id), ['b', 'a']);
});

test('moves a show between sections and normalizes orders', () => {
  const next = moveShow(base, 'a', 'queued', 1);
  assert.deepEqual(next.filter(s => s.section === 'watching').map(s => [s.id, s.sortOrder]), [['b', 0]]);
  assert.deepEqual(next.filter(s => s.section === 'queued').map(s => [s.id, s.sortOrder]), [['c', 0], ['a', 1]]);
});

test('clamps target indexes', () => {
  assert.deepEqual(moveShow(base, 'b', 'watching', -10).filter(s => s.section === 'watching').map(s => s.id), ['b', 'a']);
  assert.deepEqual(moveShow(base, 'a', 'queued', 99).filter(s => s.section === 'queued').map(s => s.id), ['c', 'a']);
});

test('normalization leaves archive untouched', () => {
  const input = [...base, { id: 'z', section: 'archived', sortOrder: 99 }];
  const next = normalizeSectionOrder(input, 'watching');
  assert.equal(next.find(s => s.id === 'z').sortOrder, 99);
});
