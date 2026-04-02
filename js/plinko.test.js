import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computePath, pathToGap, gapToSlot, pathToWaypoints } from './plinko.js';

// ── computePath ───────────────────────────────────────────────────────────────

test('computePath returns an array of the requested length', () => {
  assert.equal(computePath(6).length, 6);
  assert.equal(computePath(10).length, 10);
});

test('computePath values are only 0 or 1', () => {
  const path = computePath(100);
  assert.ok(path.every(d => d === 0 || d === 1));
});

// ── pathToGap ─────────────────────────────────────────────────────────────────

test('all-left path gives gap 0', () => {
  assert.equal(pathToGap([0, 0, 0, 0, 0, 0]), 0);
});

test('all-right path gives gap equal to path length', () => {
  assert.equal(pathToGap([1, 1, 1, 1, 1, 1]), 6);
});

test('mixed path gives the count of right decisions', () => {
  assert.equal(pathToGap([0, 1, 0, 1, 1, 0]), 3);
});

// ── gapToSlot ─────────────────────────────────────────────────────────────────

test('gap 0 always maps to slot 0', () => {
  assert.equal(gapToSlot(0, 6, 4), 0);
  assert.equal(gapToSlot(0, 10, 8), 0);
});

test('rightmost gap always maps to the last slot', () => {
  assert.equal(gapToSlot(6, 6, 4), 3);
  assert.equal(gapToSlot(10, 10, 5), 4);
});

test('result is always a valid slot index', () => {
  for (let gap = 0; gap <= 8; gap++) {
    const slot = gapToSlot(gap, 8, 5);
    assert.ok(slot >= 0 && slot <= 4, `slot ${slot} out of range for gap ${gap}`);
  }
});

// ── pathToWaypoints ───────────────────────────────────────────────────────────

test('returns one waypoint per peg row', () => {
  const wp = pathToWaypoints([0, 1, 0, 1, 1, 0]);
  assert.equal(wp.length, 6);
});

test('first waypoint reflects first decision', () => {
  const wp = pathToWaypoints([1, 1, 1, 1]);
  assert.equal(wp[0].gap, 1);
});

test('all-left path keeps gap at 0 throughout', () => {
  const wp = pathToWaypoints([0, 0, 0, 0]);
  assert.ok(wp.every(p => p.gap === 0));
});

test('all-right path increments gap by 1 each row', () => {
  const wp = pathToWaypoints([1, 1, 1, 1]);
  wp.forEach((p, i) => assert.equal(p.gap, i + 1));
});

test('waypoint row matches its index', () => {
  const wp = pathToWaypoints([0, 1, 0, 1, 0]);
  wp.forEach((p, i) => assert.equal(p.row, i));
});

test('mixed path accumulates correctly', () => {
  // path [0,1,0,1]: gaps should be 0, 1, 1, 2
  const wp = pathToWaypoints([0, 1, 0, 1]);
  assert.equal(wp[0].gap, 0);
  assert.equal(wp[1].gap, 1);
  assert.equal(wp[2].gap, 1);
  assert.equal(wp[3].gap, 2);
});
