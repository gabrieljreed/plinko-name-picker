// Board geometry, canvas drawing, ball animation
import { getNameHue } from './names.js';

const PEG_RADIUS = 5;
const SLOT_HEIGHT = 48;
const PAD = { top: 28, right: 24, bottom: 10, left: 24 };
const DROP_DURATION_MS = 2500; // total animation time for motion
const PAUSE_MS = 100; // pause on each peg before moving

// ── Physics constants ─────────────────────────────────────────────────────────
const GRAVITY        = 0.0012;  // px/ms²
const RESTITUTION    = 0.78;    // peg bounce coefficient (bouncy/chaotic)
const WALL_RESTITUTION = 0.6;   // outer-wall bounce coefficient
const PHYSICS_MAX_MS    = 15000; // absolute hard-cap (safety net only)
const IDLE_SPEED_THRESH = 0.10;  // px/ms — below this the ball is considered idle
const IDLE_SETTLE_MS    = 800;   // settle after being idle this long (ms)
const PAD_BOOST      = 1.4;     // speed amplification factor on pad bounce
const PAD_DRAW_WIDTH = 10;       // drawing stroke width in px
const SLIDING_BUMPER_LEN         = 80;  // px — width of the sliding bottom bumper (change to taste)
const SLIDING_BUMPER_RESTITUTION = 0.9; // restitution on sliding-bumper bounce
const DEFAULT_BOARD_OPTIONS = {
  ballRadius: 30,
  bumperPads: true,
  slidingBumper: false,
  fullBoard: false,
};
const legacyBoardOptions = { ...DEFAULT_BOARD_OPTIONS };

function getBoardOptions(options = {}) {
  return {
    ...legacyBoardOptions,
    ...options,
  };
}

/** Get the current ball radius (px). */
export function getBallRadius() { return legacyBoardOptions.ballRadius; }

/** Set the ball radius used for drawing and physics (px). Min 4, max 60. */
export function setBallRadius(r) {
  legacyBoardOptions.ballRadius = Math.max(4, Math.min(60, r));
}

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
export function stepBall(ball, pegs, wallLeft, wallRight, dt, options = {}) {
  const { ballRadius } = getBoardOptions(options);
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

/** Enable or disable the bumper pads. */
export function setBumperPads(enabled) { legacyBoardOptions.bumperPads = enabled; }

/** Returns true if bumper pads are currently enabled. */
export function getBumperPads() { return legacyBoardOptions.bumperPads; }

/** Enable or disable the full rectangular board layout. */
export function setFullBoard(enabled) { legacyBoardOptions.fullBoard = enabled; }

/** Returns true if the full board layout is active. */
export function getFullBoard() { return legacyBoardOptions.fullBoard; }

/** Enable or disable the sliding bottom bumper. */
export function setSlidingBumper(enabled) { legacyBoardOptions.slidingBumper = enabled; }

/** Returns true if the sliding bumper is currently enabled. */
export function getSlidingBumper() { return legacyBoardOptions.slidingBumper; }

// ── Bumper pads (pure) ────────────────────────────────────────────────────────

/**
 * Compute the bumper pad line segments for the board.
 * Returns [{ x1,y1, x2,y2, nx,ny }] where (nx,ny) is the inward unit normal.
 * Left pads angle up-right (/); right pads angle up-left (\).
 */
export function computePads(boardX, boardY, boardW, boardH) {
  const padLen = Math.min(70, boardW * 0.16);
  // Pad leans at 30° from vertical (60° from horizontal):
  //   horizontal extent = padLen * sin30° = padLen * 0.5
  //   vertical extent   = padLen * cos30° = padLen * 0.866
  const sinA = 0.5;
  const cosA = 0.866;
  const halfH = padLen * cosA / 2;
  const extW  = padLen * sinA;

  const pads = [];

  // Left pads: attached to left wall, lower endpoint at wall, slope upward-right
  //   direction (sinA, -cosA) → inward normal = (cosA, sinA)
  for (const frac of [0.28, 0.62]) {
    const cy = boardY + frac * boardH;
    pads.push({
      x1: boardX,         y1: cy + halfH,
      x2: boardX + extW,  y2: cy - halfH,
      nx: cosA, ny: sinA,
    });
  }

  // Right pads: attached to right wall, lower endpoint at wall, slope upward-left
  //   direction (-sinA, -cosA) → inward normal = (-cosA, sinA)
  for (const frac of [0.45, 0.78]) {
    const cy = boardY + frac * boardH;
    pads.push({
      x1: boardX + boardW - extW,  y1: cy - halfH,
      x2: boardX + boardW,         y2: cy + halfH,
      nx: -cosA, ny: sinA,
    });
  }

  return pads;
}

/**
 * Check ball collisions against bumper pads and resolve with a velocity boost.
 * Pure function — returns a new ball state.
 */
export function checkPadCollisions(ball, pads, options = {}) {
  const { ballRadius } = getBoardOptions(options);
  let { x, y, vx, vy } = ball;

  for (const pad of pads) {
    const segDx = pad.x2 - pad.x1;
    const segDy = pad.y2 - pad.y1;
    const lenSq = segDx * segDx + segDy * segDy;
    if (lenSq === 0) continue;

    // Closest point on the segment to the ball center
    const t  = Math.max(0, Math.min(1, ((x - pad.x1) * segDx + (y - pad.y1) * segDy) / lenSq));
    const cx = pad.x1 + t * segDx;
    const cy = pad.y1 + t * segDy;

    const dx = x - cx;
    const dy = y - cy;
    const distSq = dx * dx + dy * dy;

    if (distSq < ballRadius * ballRadius && distSq > 0) {
      // Push ball out along the direction from segment to ball center
      const dist = Math.sqrt(distSq);
      x = cx + (dx / dist) * ballRadius;
      y = cy + (dy / dist) * ballRadius;

      // Reflect velocity along the pad's inward normal with a speed boost
      const vDotN = vx * pad.nx + vy * pad.ny;
      if (vDotN < 0) { // only resolve if approaching the pad face
        vx -= (1 + PAD_BOOST) * vDotN * pad.nx;
        vy -= (1 + PAD_BOOST) * vDotN * pad.ny;
      }
    }
  }

  return { x, y, vx, vy };
}

// ── Board layout ──────────────────────────────────────────────────────────────

/**
 * Compute the full board layout from canvas dimensions and slot count.
 * Returns { pegRows, pegs, slots, colSpacing, rowSpacing, boardX, boardY, boardW, boardH }
 */
export function computeLayout(canvasW, canvasH, slotCount, options = {}) {
  const { fullBoard } = getBoardOptions(options);
  const pegRows = Math.max(6, Math.ceil(Math.log2(slotCount)) + 4);

  const boardX = PAD.left;
  const boardY = PAD.top;
  const boardW = canvasW - PAD.left - PAD.right;
  const boardH = canvasH - PAD.top - PAD.bottom - SLOT_HEIGHT;

  const slotW      = boardW / slotCount;
  const rowSpacing = boardH / (pegRows + 1);

  let colSpacing;
  const pegs = [];

  if (fullBoard) {
    // Rectangular grid: even rows have (slotCount+1) pegs at divider positions,
    // odd rows have slotCount pegs offset by half a slot (staggered diamond pattern).
    colSpacing = slotW;
    for (let row = 0; row < pegRows; row++) {
      const isEven  = row % 2 === 0;
      const numPegs = isEven ? slotCount + 1 : slotCount;
      const startX  = isEven ? boardX : boardX + slotW / 2;
      const y       = boardY + (row + 1) * rowSpacing;
      for (let col = 0; col < numPegs; col++) {
        pegs.push({ x: startX + col * slotW, y, row, col });
      }
    }
  } else {
    // Triangle: row i has (i+1) pegs, centered horizontally.
    colSpacing = boardW / pegRows;
    for (let row = 0; row < pegRows; row++) {
      const numPegs   = row + 1;
      const totalSpan = (numPegs - 1) * colSpacing;
      const startX    = boardX + boardW / 2 - totalSpan / 2;
      const y         = boardY + (row + 1) * rowSpacing;
      for (let col = 0; col < numPegs; col++) {
        pegs.push({ x: startX + col * colSpacing, y, row, col });
      }
    }
  }

  // Slot positions (same for both modes)
  const slotTop = canvasH - PAD.bottom - SLOT_HEIGHT;
  const slots = [];
  for (let i = 0; i < slotCount; i++) {
    const x = boardX + i * slotW;
    slots.push({ x, y: slotTop, w: slotW, h: SLOT_HEIGHT, cx: x + slotW / 2 });
  }

  const pads = computePads(boardX, boardY, boardW, boardH);
  return { pegRows, pegs, slots, pads, colSpacing, rowSpacing, boardX, boardY, boardW, boardH };
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

function drawPads(ctx, pads, options = {}) {
  const { bumperPads } = getBoardOptions(options);
  if (!bumperPads) return;
  ctx.lineCap = 'round';
  for (const pad of pads) {
    // Outer glow
    ctx.lineWidth = PAD_DRAW_WIDTH + 6;
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.30)';
    ctx.beginPath();
    ctx.moveTo(pad.x1, pad.y1);
    ctx.lineTo(pad.x2, pad.y2);
    ctx.stroke();
    // Core
    ctx.lineWidth = PAD_DRAW_WIDTH;
    ctx.strokeStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(pad.x1, pad.y1);
    ctx.lineTo(pad.x2, pad.y2);
    ctx.stroke();
  }
}

function drawSlidingBumper(ctx, bumperX, bumperY, options = {}) {
  const { slidingBumper } = getBoardOptions(options);
  if (!slidingBumper) return;
  const halfLen = SLIDING_BUMPER_LEN / 2;
  ctx.lineCap = 'round';
  // Outer glow
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(0, 220, 255, 0.28)';
  ctx.beginPath();
  ctx.moveTo(bumperX - halfLen, bumperY);
  ctx.lineTo(bumperX + halfLen, bumperY);
  ctx.stroke();
  // Core
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#00dcff';
  ctx.beginPath();
  ctx.moveTo(bumperX - halfLen, bumperY);
  ctx.lineTo(bumperX + halfLen, bumperY);
  ctx.stroke();
}

function resolveSlidingBumper(ball, bumperX, bumperY, bumperVx, options = {}) {
  const { ballRadius } = getBoardOptions(options);
  const { x, y, vx, vy } = ball;
  const halfLen = SLIDING_BUMPER_LEN / 2;
  if (x < bumperX - halfLen || x > bumperX + halfLen) return ball;
  if (vy <= 0 || y + ballRadius < bumperY) return ball;
  return {
    x,
    y: bumperY - ballRadius,
    vx: vx + bumperVx * 0.35,
    vy: -vy * SLIDING_BUMPER_RESTITUTION,
  };
}

function getSlotLabel(slotValue) {
  if (typeof slotValue === 'string') return slotValue;
  return slotValue?.label ?? '';
}

function getSlotColorKey(slotValue) {
  if (typeof slotValue === 'string') return slotValue;
  return slotValue?.colorKey ?? slotValue?.label ?? null;
}

export function resolveWinnerSlot(slotValues, winnerIndex) {
  const winner = slotValues[winnerIndex];
  return {
    winner,
    label: getSlotLabel(winner),
  };
}

// colorKeys: names used for color lookup — stable across edits.
// slotLabels: names shown as text — updated live.
function drawSlots(ctx, slots, slotValues, winnerSlot = -1, colorKeys = slotValues) {
  const fontSize = Math.max(9, Math.min(13, Math.floor(slots[0].w * 0.28)));
  ctx.font = `bold ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const gap = 2;
    const isWinner = i === winnerSlot;

    ctx.fillStyle = slotColor(getSlotColorKey(colorKeys[i]), isWinner);
    ctx.fillRect(s.x + gap, s.y, s.w - gap * 2, s.h - 4);

    ctx.fillStyle = slotBorderColor(getSlotColorKey(colorKeys[i]));
    ctx.fillRect(s.x + gap, s.y, s.w - gap * 2, 3);

    ctx.fillStyle = isWinner ? '#ffffff' : '#d0d0f0';
    ctx.fillText(getSlotLabel(slotValues[i]), s.cx, s.y + (s.h - 4) / 2 + 2, s.w - 10);
  }
}

function drawBallAt(ctx, bx, by, options = {}) {
  const { ballRadius } = getBoardOptions(options);
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
export function drawBoard(canvas, slotValues, colorKeys = slotValues, options = {}) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!slotValues || slotValues.length < 1) return;

  const { pegs, slots, pads, boardX, boardW } = computeLayout(canvas.width, canvas.height, slotValues.length, options);
  drawPegs(ctx, pegs);
  drawPads(ctx, pads, options);
  drawSlidingBumper(ctx, boardX + boardW / 2, slots[0].y - 6, options);
  drawSlots(ctx, slots, slotValues, -1, colorKeys);
}

// ── Ball animation ────────────────────────────────────────────────────────────

/**
 * Animate a ball drop on `canvas`.
 * slotNames: the current slot assignment (from assignToSlots()).
 * onLand(winnerName): called once the ball settles.
 *
 * Returns a cancel function — call it to abort mid-animation.
 */
export function dropBall(canvas, slotValues, colorKeys = slotValues, onLand, options = {}) {
  const boardOptions = getBoardOptions(options);
  const { ballRadius } = boardOptions;
  const ctx = canvas.getContext('2d');
  const layout = computeLayout(canvas.width, canvas.height, slotValues.length, boardOptions);
  const { pegRows, pegs, slots, pads, colSpacing, boardX, boardY, boardW } = layout;

  const path = computePath(pegRows);
  const waypoints = pathToWaypoints(path);
  const gap = pathToGap(path);
  const winnerSlotIdx = gapToSlot(gap, pegRows, slotValues.length);

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
    drawPads(ctx, pads, boardOptions);
    drawSlidingBumper(ctx, boardX + boardW / 2, slots[0].y - 6, boardOptions);
    drawSlots(ctx, slots, slotValues, highlightSlot, colorKeys);

    drawBallAt(ctx, bx, by, boardOptions);

    if (elapsed < totalDuration) {
      rafId = requestAnimationFrame(frame);
    } else {
      // Final frame: full highlight, no ball
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawPegs(ctx, pegs);
      drawPads(ctx, pads, boardOptions);
      drawSlidingBumper(ctx, boardX + boardW / 2, slots[0].y - 6, boardOptions);
      drawSlots(ctx, slots, slotValues, winnerSlotIdx, colorKeys);
      onLand(resolveWinnerSlot(slotValues, winnerSlotIdx).winner);
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
export function dropBallPhysics(canvas, slotValues, colorKeys = slotValues, onLand, initState = null, options = {}) {
  const boardOptions = getBoardOptions(options);
  const { ballRadius, bumperPads, slidingBumper } = boardOptions;
  const ctx = canvas.getContext('2d');
  const layout = computeLayout(canvas.width, canvas.height, slotValues.length, boardOptions);
  const { pegs, slots, pads, boardX, boardY, boardW } = layout;

  const slotW   = boardW / slotValues.length;
  const wallLeft  = boardX;
  const wallRight = boardX + boardW;
  const slotTop   = slots[0].y;

  // Slot-divider x positions (internal walls between slots)
  const dividers = [];
  for (let i = 1; i < slotValues.length; i++) {
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
  let prevTs   = null;
  let startTs  = null;
  let settled  = false;
  let idleStart = null; // timestamp when ball speed first dropped below threshold

  // Sliding bumper state
  const bumperY    = slotTop - 6;
  const bumperMinX = boardX + SLIDING_BUMPER_LEN / 2;
  const bumperMaxX = boardX + boardW - SLIDING_BUMPER_LEN / 2;
  let bumperX  = boardX + boardW / 2;
  let bumperVx = boardW / 2500; // one full board-width crossing in ~2.5 s

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
    return Math.max(0, Math.min(slotValues.length - 1, idx));
  }

  function settle(bx) {
    settled = true;
    const winner = winnerIdx(bx);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx, pegs);
    drawPads(ctx, pads, boardOptions);
    drawSlidingBumper(ctx, bumperX, bumperY, boardOptions);
    drawSlots(ctx, slots, slotValues, winner, colorKeys);
    onLand(resolveWinnerSlot(slotValues, winner).winner);
  }

  function frame(ts) {
    if (startTs === null) startTs = ts;
    if (prevTs === null) prevTs = ts;

    const elapsed = ts - startTs;
    const dt = Math.min(ts - prevTs, 32); // cap dt to avoid spiral of death
    prevTs = ts;

    // Advance physics
    ball = stepBall(ball, pegs, wallLeft, wallRight, dt, boardOptions);
    if (bumperPads) ball = checkPadCollisions(ball, pads, boardOptions);
    ball = resolveSlotWalls(ball);

    // Update and collide sliding bumper (only while ball is above the slot zone)
    if (slidingBumper) {
      bumperX += bumperVx * dt;
      if (bumperX <= bumperMinX) { bumperX = bumperMinX; bumperVx =  Math.abs(bumperVx); }
      if (bumperX >= bumperMaxX) { bumperX = bumperMaxX; bumperVx = -Math.abs(bumperVx); }
      if (ball.y < slotTop) ball = resolveSlidingBumper(ball, bumperX, bumperY, bumperVx, boardOptions);
    }

    // Track idle time: settle once the ball has been nearly stationary for a while
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed < IDLE_SPEED_THRESH) {
      if (idleStart === null) idleStart = ts;
    } else {
      idleStart = null;
    }

    // Check settlement: natural slot entry, idle timeout, or absolute hard cap
    if (detectSlotEntry(ball.y, slotTop)
        || (idleStart !== null && ts - idleStart > IDLE_SETTLE_MS)
        || elapsed > PHYSICS_MAX_MS) {
      settle(ball.x);
      return;
    }

    // Determine which slot is highlighted (only once ball is in slot zone)
    const highlightSlot = ball.y > slotTop ? winnerIdx(ball.x) : -1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx, pegs);
    drawPads(ctx, pads, boardOptions);
    drawSlidingBumper(ctx, bumperX, bumperY, boardOptions);
    drawSlots(ctx, slots, slotValues, highlightSlot, colorKeys);
    drawBallAt(ctx, ball.x, ball.y, boardOptions);

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
export function startOscillation(canvas, slotValues, colorKeys = slotValues, speedFactor = 1, options = {}) {
  const boardOptions = getBoardOptions(options);
  const { ballRadius, slidingBumper } = boardOptions;
  const ctx = canvas.getContext('2d');
  const layout = computeLayout(canvas.width, canvas.height, slotValues.length, boardOptions);
  const { pegs, slots, pads, boardX, boardY, boardW } = layout;

  const minX = boardX + ballRadius;
  const maxX = boardX + boardW - ballRadius;
  // Base speed: one full board-width crossing in ~1500 ms
  const speed = (boardW / 1500) * Math.max(1, speedFactor); // px/ms

  const by = boardY; // top of board area — ball is visible here
  let bx = boardX + boardW / 2;
  let vx = speed; // start moving right

  // Sliding bumper state (visual + animation during oscillation; no collision until drop)
  const bumperY    = slots[0].y - 6;
  const bumperMinX = boardX + SLIDING_BUMPER_LEN / 2;
  const bumperMaxX = boardX + boardW - SLIDING_BUMPER_LEN / 2;
  let bumperX  = boardX + boardW / 2;
  let bumperVx = boardW / 2500;

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

    if (slidingBumper) {
      bumperX += bumperVx * dt;
      if (bumperX <= bumperMinX) { bumperX = bumperMinX; bumperVx =  Math.abs(bumperVx); }
      if (bumperX >= bumperMaxX) { bumperX = bumperMaxX; bumperVx = -Math.abs(bumperVx); }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx, pegs);
    drawPads(ctx, pads, boardOptions);
    drawSlidingBumper(ctx, bumperX, bumperY, boardOptions);
    drawSlots(ctx, slots, slotValues, -1, colorKeys);
    drawBallAt(ctx, bx, by, boardOptions);

    rafId = requestAnimationFrame(frame);
  }

  function getBallState() { return { x: bx, y: by, vx, vy: 0 }; }
  function cancel() { cancelled = true; cancelAnimationFrame(rafId); }

  rafId = requestAnimationFrame(frame);
  return { cancel, getBallState };
}
