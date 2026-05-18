import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { checkPadCollisions, computeLayout, computePads, computePath, createBallState, detectSlotEntry, gapToSlot, pathToGap, pathToWaypoints, resolveWinnerSlot, stepBall } from './plinko.js';

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

test('computeLayout uses the provided fullBoard flag instead of hidden module state', () => {
  const triangle = computeLayout(600, 500, 4, { fullBoard: false });
  const full = computeLayout(600, 500, 4, { fullBoard: true });
  assert.notEqual(triangle.pegs.length, full.pegs.length);
});

// ── computePads ───────────────────────────────────────────────────────────────

test('computePads returns 4 pads (2 left, 2 right)', () => {
  const pads = computePads(0, 0, 400, 300);
  assert.equal(pads.length, 4);
});

test('computePads pads have x1,y1,x2,y2,nx,ny', () => {
  for (const p of computePads(0, 0, 400, 300)) {
    assert.ok('x1' in p && 'y1' in p && 'x2' in p && 'y2' in p, 'has endpoints');
    assert.ok('nx' in p && 'ny' in p, 'has normal');
  }
});

test('computePads normals are unit vectors', () => {
  for (const p of computePads(0, 0, 400, 300)) {
    const len = Math.sqrt(p.nx * p.nx + p.ny * p.ny);
    assert.ok(Math.abs(len - 1) < 0.01, `normal length should be 1, got ${len.toFixed(4)}`);
  }
});

test('computePads left pads have nx > 0 (normal points into board)', () => {
  const pads = computePads(0, 0, 400, 300);
  const leftPads = pads.filter(p => p.x1 === 0 || p.x2 === 0);
  assert.equal(leftPads.length, 2);
  assert.ok(leftPads.every(p => p.nx > 0));
});

test('computePads right pads have nx < 0 (normal points into board)', () => {
  const pads = computePads(0, 0, 400, 300);
  const rightPads = pads.filter(p => p.x1 === 400 || p.x2 === 400);
  assert.equal(rightPads.length, 2);
  assert.ok(rightPads.every(p => p.nx < 0));
});

// ── checkPadCollisions ────────────────────────────────────────────────────────

test('checkPadCollisions: ball far from all pads is unaffected', () => {
  const pads = computePads(0, 0, 400, 300);
  const ball = createBallState(200, 150, -0.3, 0.2);
  const result = checkPadCollisions(ball, pads);
  assert.deepEqual(result, ball);
});

test('checkPadCollisions: left pad reverses negative vx to positive', () => {
  // Ball placed 10 px along left-pad normal from the pad midpoint (within ballRadius=30)
  const pads = computePads(0, 0, 400, 300);
  const lp = pads[0]; // first left pad
  const midX = (lp.x1 + lp.x2) / 2;
  const midY = (lp.y1 + lp.y2) / 2;
  const ball = createBallState(midX + lp.nx * 10, midY + lp.ny * 10, -0.4, 0.1);
  const result = checkPadCollisions(ball, pads);
  assert.ok(result.vx > 0, `vx should become positive after left pad bounce (got ${result.vx.toFixed(3)})`);
});

test('checkPadCollisions: right pad reverses positive vx to negative', () => {
  const pads = computePads(0, 0, 400, 300);
  const rp = pads[2]; // first right pad
  const midX = (rp.x1 + rp.x2) / 2;
  const midY = (rp.y1 + rp.y2) / 2;
  const ball = createBallState(midX + rp.nx * 10, midY + rp.ny * 10, 0.4, 0.1);
  const result = checkPadCollisions(ball, pads);
  assert.ok(result.vx < 0, `vx should become negative after right pad bounce (got ${result.vx.toFixed(3)})`);
});

test('checkPadCollisions: reflected speed is greater than incoming speed', () => {
  const pads = computePads(0, 0, 400, 300);
  const lp = pads[0];
  const midX = (lp.x1 + lp.x2) / 2;
  const midY = (lp.y1 + lp.y2) / 2;
  const ball = createBallState(midX + lp.nx * 10, midY + lp.ny * 10, -0.4, 0);
  const speedBefore = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
  const result = checkPadCollisions(ball, pads);
  const speedAfter = Math.sqrt(result.vx ** 2 + result.vy ** 2);
  assert.ok(speedAfter > speedBefore, `speed should increase on pad bounce (${speedBefore.toFixed(3)} → ${speedAfter.toFixed(3)})`);
});

test('checkPadCollisions: ball moving away from pad face is not reflected', () => {
  const pads = computePads(0, 0, 400, 300);
  const lp = pads[0];
  const midX = (lp.x1 + lp.x2) / 2;
  const midY = (lp.y1 + lp.y2) / 2;
  // Place ball at pad face but moving outward (away from inward normal)
  const ball = createBallState(midX + lp.nx * 10, midY + lp.ny * 10, 0.4, 0);
  const result = checkPadCollisions(ball, pads);
  assert.equal(result.vx, ball.vx, 'vx unchanged when moving away from pad face');
});

test('stepBall uses the provided ballRadius instead of a hidden module global', () => {
  const result = stepBall(
    { x: 5, y: 20, vx: -1, vy: 0 },
    [],
    0,
    300,
    16,
    { ballRadius: 20 },
  );
  assert.equal(result.x, 20);
});

test('resolveWinnerSlot returns the exact slot value even when labels are duplicated', () => {
  const firstAlice = { id: 'e1', label: 'Alice' };
  const secondAlice = { id: 'e2', label: 'Alice' };
  const { winner, label } = resolveWinnerSlot([firstAlice, secondAlice], 1);

  assert.equal(winner, secondAlice);
  assert.equal(label, 'Alice');
});
