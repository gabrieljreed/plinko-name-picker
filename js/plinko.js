// Board geometry, canvas drawing, ball animation
import { getNameHue } from './names.js';

const PEG_RADIUS = 5;
let ballRadius = 30;
const SLOT_HEIGHT = 48;
const PAD = { top: 28, right: 24, bottom: 10, left: 24 };
const DROP_DURATION_MS = 2500; // total animation time for motion
const PAUSE_MS = 100; // pause on each peg before moving

// ── Physics constants ─────────────────────────────────────────────────────────
const GRAVITY        = 0.0012;  // px/ms²
const RESTITUTION    = 0.78;    // peg bounce coefficient (bouncy/chaotic)
const WALL_RESTITUTION = 0.6;   // outer-wall bounce coefficient
const PHYSICS_MAX_MS = 8000;    // fallback settle timeout

/** Get the current ball radius (px). */
export function getBallRadius() { return ballRadius; }

/** Set the ball radius used for drawing and physics (px). Min 4, max 60. */
export function setBallRadius(r) { ballRadius = Math.max(4, Math.min(60, r)); }

// ── Pure path logic (unit-tested) ─────────────────────────────────────────────

/**
 * Compute a random path of `pegRows` decisions.
 * 0 = left, 1 = right.
 */
export function computePath(pegRows) {
  return Array.from({ length: pegRows }, () => (Math.random() < 0.5 ? 0 : 1));
}

/**
 * Convert a path to the final gap index the ball lands in.
 * Gap 0 = leftmost, pegRows = rightmost.
 */
export function pathToGap(path) {
  return path.reduce((acc, d) => acc + d, 0);
}

/**
 * Map a gap index to a slot index.
 * gap:      0 … pegRows
 * slotCount: number of name slots
 */
export function gapToSlot(gap, pegRows, slotCount) {
  return Math.min(Math.floor((gap * slotCount) / pegRows), slotCount - 1);
}

/**
 * Convert a path into the sequence of peg waypoints the ball passes through.
 * Each waypoint is { row, col } — the peg hit on that row.
 */
export function pathToWaypoints(path) {
  const waypoints = [];
  let gap = 0;
  for (let row = 0; row < path.length; row++) {
    gap += path[row];
    waypoints.push({ row, gap });
  }
  return waypoints;
}

// ── Pure physics logic (unit-tested) ─────────────────────────────────────────

/**
 * Create an initial ball state object.
 */
export function createBallState(x, y, vx = 0, vy = 0) {
  return { x, y, vx, vy };
}

/**
 * Advance ball physics by `dt` milliseconds.
 * Handles gravity, outer-wall reflection, and peg collisions.
 * Pure: no side effects, returns a new state object.
 *
 * @param {{x,y,vx,vy}} ball
 * @param {Array<{x,y}>} pegs
 * @param {number} wallLeft  - left boundary (ball center must stay right of this + BALL_RADIUS)
 * @param {number} wallRight - right boundary
 * @param {number} dt        - elapsed milliseconds since last step
 * @returns {{x,y,vx,vy}}
 */
export function stepBall(ball, pegs, wallLeft, wallRight, dt) {
  let { x, y, vx, vy } = ball;

  // Apply gravity
  vy += GRAVITY * dt;

  // Advance position
  x += vx * dt;
  y += vy * dt;

  // Left wall
  if (x - ballRadius < wallLeft) {
    x = wallLeft + ballRadius;
    vx = Math.abs(vx) * WALL_RESTITUTION;
  }

  // Right wall
  if (x + ballRadius > wallRight) {
    x = wallRight - ballRadius;
    vx = -Math.abs(vx) * WALL_RESTITUTION;
  }

  // Peg collisions
  const minDist = ballRadius + PEG_RADIUS;
  for (const peg of pegs) {
    const dx = x - peg.x;
    const dy = y - peg.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < minDist * minDist && distSq > 0) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      // Push ball outside peg
      x = peg.x + nx * minDist;
      y = peg.y + ny * minDist;
      // Reflect velocity along collision normal
      const dot = vx * nx + vy * ny;
      if (dot < 0) { // only resolve if moving toward peg
        vx -= (1 + RESTITUTION) * dot * nx;
        vy -= (1 + RESTITUTION) * dot * ny;
      }
    }
  }

  return { x, y, vx, vy };
}

/**
 * Returns true when the ball has descended far enough into the slot row
 * to be considered settled.
 *
 * @param {number} ballY    - ball center y
 * @param {number} slotTop  - y coordinate of the top of the slot row
 * @param {number} threshold - how far below slotTop counts as settled (px)
 */
export function detectSlotEntry(ballY, slotTop, threshold = SLOT_HEIGHT * 0.5) {
  return ballY > slotTop + threshold;
}

// ── Board layout ──────────────────────────────────────────────────────────────

/**
 * Compute the full board layout from canvas dimensions and slot count.
 * Returns { pegRows, pegs, slots, colSpacing, rowSpacing, boardX, boardY, boardW, boardH }
 */
export function computeLayout(canvasW, canvasH, slotCount) {
  const pegRows = Math.max(6, Math.ceil(Math.log2(slotCount)) + 4);

  const boardX = PAD.left;
  const boardY = PAD.top;
  const boardW = canvasW - PAD.left - PAD.right;
  const boardH = canvasH - PAD.top - PAD.bottom - SLOT_HEIGHT;

  const colSpacing = boardW / pegRows;
  const rowSpacing = boardH / (pegRows + 1);

  // Peg positions: row i has (i+1) pegs, centered horizontally
  const pegs = [];
  for (let row = 0; row < pegRows; row++) {
    const numPegs = row + 1;
    const totalSpan = (numPegs - 1) * colSpacing;
    const startX = boardX + boardW / 2 - totalSpan / 2;
    const y = boardY + (row + 1) * rowSpacing;
    for (let col = 0; col < numPegs; col++) {
      pegs.push({ x: startX + col * colSpacing, y, row, col });
    }
  }

  // Slot positions
  const slotW = boardW / slotCount;
  const slotTop = canvasH - PAD.bottom - SLOT_HEIGHT;
  const slots = [];
  for (let i = 0; i < slotCount; i++) {
    const x = boardX + i * slotW;
    slots.push({ x, y: slotTop, w: slotW, h: SLOT_HEIGHT, cx: x + slotW / 2 });
  }

  return { pegRows, pegs, slots, colSpacing, rowSpacing, boardX, boardY, boardW, boardH };
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function slotColor(name, highlight = false) {
  const hue = getNameHue(name);
  if (hue === null) return highlight ? '#909090' : '#2a2a3a';
  return highlight ? `hsl(${hue}, 80%, 55%)` : `hsl(${hue}, 55%, 28%)`;
}

function slotBorderColor(name) {
  const hue = getNameHue(name);
  if (hue === null) return '#555566';
  return `hsl(${hue}, 65%, 50%)`;
}

function drawPegs(ctx, pegs) {
  for (const peg of pegs) {
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#5a5aaa';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(peg.x - 1.5, peg.y - 1.5, PEG_RADIUS * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
  }
}

// colorKeys: names used for color lookup — stable across edits.
// slotLabels: names shown as text — updated live.
function drawSlots(ctx, slots, slotLabels, winnerSlot = -1, colorKeys = slotLabels) {
  const fontSize = Math.max(9, Math.min(13, Math.floor(slots[0].w * 0.28)));
  ctx.font = `bold ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const gap = 2;
    const isWinner = i === winnerSlot;

    ctx.fillStyle = slotColor(colorKeys[i], isWinner);
    ctx.fillRect(s.x + gap, s.y, s.w - gap * 2, s.h - 4);

    ctx.fillStyle = slotBorderColor(colorKeys[i]);
    ctx.fillRect(s.x + gap, s.y, s.w - gap * 2, 3);

    ctx.fillStyle = isWinner ? '#ffffff' : '#d0d0f0';
    ctx.fillText(slotLabels[i], s.cx, s.y + (s.h - 4) / 2 + 2, s.w - 10);
  }
}

function drawBallAt(ctx, bx, by) {
  ctx.beginPath();
  ctx.arc(bx, by, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#e94560';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx - 3, by - 3, ballRadius * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();
}

/**
 * Draw the static board (no ball). Called between rounds.
 */
export function drawBoard(canvas, slotLabels, colorKeys = slotLabels) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!slotLabels || slotLabels.length < 1) return;

  const { pegs, slots } = computeLayout(canvas.width, canvas.height, slotLabels.length);
  drawPegs(ctx, pegs);
  drawSlots(ctx, slots, slotLabels, -1, colorKeys);
}

// ── Ball animation ────────────────────────────────────────────────────────────

/**
 * Animate a ball drop on `canvas`.
 * slotNames: the current slot assignment (from assignToSlots()).
 * onLand(winnerName): called once the ball settles.
 *
 * Returns a cancel function — call it to abort mid-animation.
 */
export function dropBall(canvas, slotLabels, colorKeys = slotLabels, onLand) {
  const ctx = canvas.getContext('2d');
  const layout = computeLayout(canvas.width, canvas.height, slotLabels.length);
  const { pegRows, pegs, slots, colSpacing, boardX, boardY, boardW } = layout;

  const path = computePath(pegRows);
  const waypoints = pathToWaypoints(path);
  const gap = pathToGap(path);
  const winnerSlotIdx = gapToSlot(gap, pegRows, slotLabels.length);

  // Build the list of (x, y) positions the ball travels through
  function gapPos(row, gap) {
    const rowPegs = pegs.filter(p => p.row === row);
    if (!rowPegs.length) {
      return { x: boardX + boardW / 2, y: boardY };
    }
    const firstX = rowPegs[0].x;
    const x = firstX + (gap - 0.5) * colSpacing;
    const y = rowPegs[0].y;
    return { x, y };
  }

  // x position of the winning slot center
  const finalX = slots[winnerSlotIdx].cx;
  const finalY = slots[winnerSlotIdx].y - ballRadius - 2;

  const positions = [
    // Start: above the board, centered
    { x: boardX + boardW / 2, y: boardY - ballRadius },
    // Path through gaps (between pegs)
    ...waypoints.map(wp => gapPos(wp.row, wp.gap)),
    // Land in the winning slot
    { x: finalX, y: finalY },
  ];

  const segCount = positions.length - 1;
  const moveDuration = DROP_DURATION_MS / segCount;
  const segmentDuration = PAUSE_MS + moveDuration;
  const totalDuration = segmentDuration * segCount;

  let rafId;
  let startTime = null;

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function frame(ts) {
    if (startTime === null) startTime = ts;
    const elapsed = ts - startTime;

    // Which segment are we in? Each segment has a brief pause then move.
    const segIndex = Math.min(Math.floor(elapsed / segmentDuration), segCount - 1);
    const segElapsed = Math.min(elapsed - segIndex * segmentDuration, segmentDuration);

    const from = positions[segIndex];
    const to = positions[segIndex + 1];

    let bx;
    let by;
    if (segElapsed < PAUSE_MS) {
      // Hesitate on peg
      bx = from.x;
      by = from.y;
    } else {
      const moveT = Math.min((segElapsed - PAUSE_MS) / moveDuration, 1);
      const t = easeInOut(moveT);
      bx = from.x + (to.x - from.x) * t;
      by = from.y + (to.y - from.y) * t;
    }

    // Determine winner highlight only on last segment
    const highlightSlot = segIndex === segCount - 1 ? winnerSlotIdx : -1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx, pegs);
    drawSlots(ctx, slots, slotLabels, highlightSlot, colorKeys);

    drawBallAt(ctx, bx, by);

    if (elapsed < totalDuration) {
      rafId = requestAnimationFrame(frame);
    } else {
      // Final frame: full highlight, no ball
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawPegs(ctx, pegs);
      drawSlots(ctx, slots, slotLabels, winnerSlotIdx, colorKeys);
      onLand(slotLabels[winnerSlotIdx]);
    }
  }

  rafId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(rafId);
}

// ── Physics ball animation ────────────────────────────────────────────────────

/**
 * Animate a physics-driven ball drop on `canvas`.
 * The winner is determined by which slot the ball physically settles into.
 * Same signature as dropBall — returns a cancel function.
 */
export function dropBallPhysics(canvas, slotLabels, colorKeys = slotLabels, onLand, initState = null) {
  const ctx = canvas.getContext('2d');
  const layout = computeLayout(canvas.width, canvas.height, slotLabels.length);
  const { pegs, slots, boardX, boardY, boardW } = layout;

  const slotW   = boardW / slotLabels.length;
  const wallLeft  = boardX;
  const wallRight = boardX + boardW;
  const slotTop   = slots[0].y;

  // Slot-divider x positions (internal walls between slots)
  const dividers = [];
  for (let i = 1; i < slotLabels.length; i++) {
    dividers.push(boardX + i * slotW);
  }

  // Initial ball state: use provided initState (from aiming mode) or default to top-center
  let ball = initState ?? createBallState(
    boardX + boardW / 2 + (Math.random() - 0.5) * slotW * 0.5,
    boardY - ballRadius,
    (Math.random() - 0.5) * 0.05,
    0
  );

  let rafId;
  let prevTs = null;
  let startTs = null;
  let settled = false;

  function resolveSlotWalls(b) {
    // Only apply slot-divider collisions once ball is in the slot zone
    if (b.y < slotTop) return b;
    let { x, y, vx, vy } = b;
    for (const dx of dividers) {
      const dist = Math.abs(x - dx);
      if (dist < ballRadius) {
        // Push ball away from divider
        x = x < dx ? dx - ballRadius : dx + ballRadius;
        vx = (x < dx ? -1 : 1) * Math.abs(vx) * WALL_RESTITUTION;
      }
    }
    return { x, y, vx, vy };
  }

  function winnerIdx(bx) {
    const idx = Math.floor((bx - boardX) / slotW);
    return Math.max(0, Math.min(slotLabels.length - 1, idx));
  }

  function settle(bx) {
    settled = true;
    const winner = winnerIdx(bx);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx, pegs);
    drawSlots(ctx, slots, slotLabels, winner, colorKeys);
    onLand(slotLabels[winner]);
  }

  function frame(ts) {
    if (startTs === null) startTs = ts;
    if (prevTs === null) prevTs = ts;

    const elapsed = ts - startTs;
    const dt = Math.min(ts - prevTs, 32); // cap dt to avoid spiral of death
    prevTs = ts;

    // Advance physics
    ball = stepBall(ball, pegs, wallLeft, wallRight, dt);
    ball = resolveSlotWalls(ball);

    // Check settlement
    if (detectSlotEntry(ball.y, slotTop) || elapsed > PHYSICS_MAX_MS) {
      settle(ball.x);
      return;
    }

    // Determine which slot is highlighted (only once ball is in slot zone)
    const highlightSlot = ball.y > slotTop ? winnerIdx(ball.x) : -1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx, pegs);
    drawSlots(ctx, slots, slotLabels, highlightSlot, colorKeys);
    drawBallAt(ctx, ball.x, ball.y);

    if (!settled) {
      rafId = requestAnimationFrame(frame);
    }
  }

  rafId = requestAnimationFrame(frame);
  return () => { settled = true; cancelAnimationFrame(rafId); };
}

// ── Aiming oscillation ────────────────────────────────────────────────────────

/**
 * Show the ball swaying back and forth at the top of the board before a drop.
 * speedFactor > 1 makes the ball faster (use to increase tension as names shrink).
 *
 * Returns { cancel(), getBallState() }.
 * getBallState() returns { x, y, vx, vy } — snapshot the moment Drop is clicked.
 */
export function startOscillation(canvas, slotLabels, colorKeys = slotLabels, speedFactor = 1) {
  const ctx = canvas.getContext('2d');
  const layout = computeLayout(canvas.width, canvas.height, slotLabels.length);
  const { pegs, slots, boardX, boardY, boardW } = layout;

  const minX = boardX + ballRadius;
  const maxX = boardX + boardW - ballRadius;
  // Base speed: one full board-width crossing in ~1500 ms
  const speed = (boardW / 1500) * Math.max(1, speedFactor); // px/ms

  const by = boardY; // top of board area — ball is visible here
  let bx = boardX + boardW / 2;
  let vx = speed; // start moving right

  let rafId;
  let prevTs = null;
  let cancelled = false;

  function frame(ts) {
    if (cancelled) return;
    if (prevTs === null) prevTs = ts;
    const dt = Math.min(ts - prevTs, 32);
    prevTs = ts;

    bx += vx * dt;
    if (bx <= minX) { bx = minX; vx =  Math.abs(vx); }
    if (bx >= maxX) { bx = maxX; vx = -Math.abs(vx); }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx, pegs);
    drawSlots(ctx, slots, slotLabels, -1, colorKeys);
    drawBallAt(ctx, bx, by);

    rafId = requestAnimationFrame(frame);
  }

  function getBallState() { return { x: bx, y: by, vx, vy: 0 }; }
  function cancel() { cancelled = true; cancelAnimationFrame(rafId); }

  rafId = requestAnimationFrame(frame);
  return { cancel, getBallState };
}

