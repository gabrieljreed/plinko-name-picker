import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computePath, pathToGap, gapToSlot, pathToWaypoints, createBallState, stepBall, detectSlotEntry } from './plinko.js';

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

// ── createBallState ───────────────────────────────────────────────────────────

test('createBallState sets x, y, vx, vy', () => {
  const b = createBallState(10, 20, 3, -4);
  assert.deepEqual(b, { x: 10, y: 20, vx: 3, vy: -4 });
});

test('createBallState defaults vx and vy to 0', () => {
  const b = createBallState(5, 15);
  assert.equal(b.vx, 0);
  assert.equal(b.vy, 0);
});

// ── stepBall — gravity ────────────────────────────────────────────────────────

test('gravity increases vy each step', () => {
  const b = createBallState(100, 100);
  const b2 = stepBall(b, [], 0, 500, 16);
  assert.ok(b2.vy > b.vy, 'vy should increase due to gravity');
});

test('gravity advances y downward', () => {
  const b = createBallState(100, 100, 0, 0);
  const b2 = stepBall(b, [], 0, 500, 16);
  assert.ok(b2.y > b.y, 'y should increase (ball falls)');
});

// ── stepBall — wall collisions ────────────────────────────────────────────────

test('left wall clamps x and reflects vx positive', () => {
  // Place ball past the left wall, moving left
  const b = createBallState(5, 200, -2, 0); // wallLeft = 20, BALL_RADIUS = 20 => min x = 40
  const b2 = stepBall(b, [], 20, 500, 1);
  assert.ok(b2.x >= 20, 'x should be clamped at or past wallLeft + BALL_RADIUS');
  assert.ok(b2.vx >= 0, 'vx should be reflected to non-negative');
});

test('right wall clamps x and reflects vx negative', () => {
  // Place ball past the right wall, moving right
  const b = createBallState(495, 200, 2, 0); // wallRight = 480, BALL_RADIUS = 20 => max x = 460
  const b2 = stepBall(b, [], 0, 480, 1);
  assert.ok(b2.x <= 480, 'x should be clamped at or before wallRight - BALL_RADIUS');
  assert.ok(b2.vx <= 0, 'vx should be reflected to non-positive');
});

// ── stepBall — peg collisions ─────────────────────────────────────────────────

test('ball overlapping peg is pushed outside collision range', () => {
  // BALL_RADIUS=20, PEG_RADIUS=5 => minDist=25
  // Place ball center 10px from peg center (deeply overlapping)
  const peg = { x: 200, y: 200 };
  const b = createBallState(210, 200, 0, 1); // moving toward peg
  const b2 = stepBall(b, [peg], 0, 500, 1);
  const dx = b2.x - peg.x;
  const dy = b2.y - peg.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  assert.ok(dist >= 24.9, `ball should be pushed outside peg (dist=${dist.toFixed(2)})`);
});

test('ball far from peg is not affected', () => {
  const peg = { x: 200, y: 200 };
  const b = createBallState(300, 300, 1, 1);
  const b2 = stepBall(b, [peg], 0, 500, 16);
  // Position should advance freely (no collision interference)
  assert.ok(b2.x > b.x, 'x should advance by vx');
  assert.ok(b2.y > b.y, 'y should advance by vy + gravity');
});

test('peg collision reflects velocity away from peg', () => {
  // Ball directly above peg, moving downward into it
  const peg = { x: 200, y: 200 };
  const b = createBallState(200, 180, 0, 3); // moving straight down into peg
  const b2 = stepBall(b, [peg], 0, 500, 1);
  // After collision the y-velocity should be reversed (moving away)
  assert.ok(b2.vy < 0, 'vy should be reflected upward after hitting top of peg');
});

// ── detectSlotEntry ───────────────────────────────────────────────────────────

test('detectSlotEntry returns false when ball is above threshold', () => {
  assert.equal(detectSlotEntry(300, 400, 24), false);
});

test('detectSlotEntry returns true when ball is below threshold', () => {
  assert.equal(detectSlotEntry(430, 400, 24), true);
});

test('detectSlotEntry returns false exactly at slotTop', () => {
  assert.equal(detectSlotEntry(400, 400, 24), false);
});

test('detectSlotEntry uses default threshold when not specified', () => {
  // Default threshold is SLOT_HEIGHT * 0.5 = 24; 400 + 24 = 424
  assert.equal(detectSlotEntry(423, 400), false);
  assert.equal(detectSlotEntry(425, 400), true);
});
