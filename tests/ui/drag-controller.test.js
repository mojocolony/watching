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

test('Someday heading is an active drop target even when its show list has no height', async () => {
  const { findDropSection } = await import('../../src/ui/drag-controller.js');
  const watching = { getBoundingClientRect: () => ({ top: 50, bottom: 130 }) };
  const someday = { getBoundingClientRect: () => ({ top: 250, bottom: 288 }) };
  const heading = { closest: selector => selector === '.watch-section' ? someday : null };
  assert.strictEqual(findDropSection([watching, someday], heading, 268), someday);
  assert.strictEqual(findDropSection([watching, someday], null, 238), someday);
});

test('pointer dragging to an empty or collapsed Someday section emits a move to Someday', async () => {
  const { attachDragController } = await import('../../src/ui/drag-controller.js');
  for (const collapsed of [false, true]) {
    const oldDocument = globalThis.document;
    const callbacks = {};
    const moves = [];
    const classes = () => ({ add() {}, remove() {} });
    const marker = { remove() {} };
    let markerContainer = null;

    const emptyList = {
      querySelectorAll: () => [],
      append: node => { markerContainer = 'list'; assert.equal(node, marker); },
    };
    const someday = {
      dataset: { section: 'someday' },
      classList: classes(),
      getBoundingClientRect: () => ({ top: 250, bottom: 288 }),
      querySelector: () => collapsed ? null : emptyList,
      append: node => { markerContainer = 'section'; assert.equal(node, marker); },
    };
    const watching = {
      dataset: { section: 'watching' },
      getBoundingClientRect: () => ({ top: 50, bottom: 130 }),
    };
    const row = {
      dataset: { showId: 'show-1', section: 'watching' },
      classList: classes(),
      setPointerCapture() {},
    };
    const toggle = {
      closest: selector => selector === '.show-toggle' ? toggle
        : selector === '.show-row' ? row : null,
    };
    const heading = { closest: selector => selector === '.watch-section' ? someday : null };
    const root = {
      dataset: {},
      querySelectorAll: () => [watching, someday],
      addEventListener: (name, callback) => { callbacks[name] = callback; },
      removeEventListener: () => {},
    };
    globalThis.document = {
      elementFromPoint: () => heading,
      createElement: () => marker,
      body: { classList: classes() },
    };
    try {
      const detach = attachDragController(root, result => moves.push(result));
      callbacks.pointerdown({ button: 0, target: toggle, pointerId: 1, pointerType: 'mouse', clientX: 20, clientY: 60 });
      callbacks.pointermove({ pointerId: 1, clientX: 20, clientY: 270, preventDefault() {} });
      callbacks.pointerup({ pointerId: 1, preventDefault() {}, stopPropagation() {} });
      assert.deepEqual(moves, [{ showId: 'show-1', targetSection: 'someday', targetIndex: 0 }]);
      assert.equal(markerContainer, collapsed ? 'section' : 'list');
      detach();
    } finally {
      globalThis.document = oldDocument;
    }
  }
});
