// Board geometry, canvas drawing, ball animation
import { getNameHue } from './names.js';

const PEG_RADIUS = 5;
const BALL_RADIUS = 9;
const SLOT_HEIGHT = 48;
const PAD = { top: 28, right: 24, bottom: 10, left: 24 };
const DROP_DURATION_MS = 900; // total animation time

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
  let col = 0;
  for (let row = 0; row < path.length; row++) {
    waypoints.push({ row, col });
    col += path[row];
  }
  return waypoints;
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
  const { pegRows, pegs, slots, boardX, boardY, boardW } = layout;

  const path = computePath(pegRows);
  const waypoints = pathToWaypoints(path);
  const gap = pathToGap(path);
  const winnerSlotIdx = gapToSlot(gap, pegRows, slotLabels.length);

  // Build the list of (x, y) positions the ball travels through
  function pegPos(row, col) {
    const p = pegs.find(p => p.row === row && p.col === col);
    return { x: p.x, y: p.y };
  }

  // x position of the winning slot center
  const finalX = slots[winnerSlotIdx].cx;
  const finalY = slots[winnerSlotIdx].y - BALL_RADIUS - 2;

  const positions = [
    // Start: above the board, centered
    { x: boardX + boardW / 2, y: boardY - BALL_RADIUS },
    // Each peg hit
    ...waypoints.map(wp => pegPos(wp.row, wp.col)),
    // Land in the winning slot
    { x: finalX, y: finalY },
  ];

  const segCount = positions.length - 1;
  const segDuration = DROP_DURATION_MS / segCount;

  let rafId;
  let startTime = null;

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function frame(ts) {
    if (startTime === null) startTime = ts;
    const elapsed = ts - startTime;

    // Which segment are we in?
    const segIndex = Math.min(Math.floor(elapsed / segDuration), segCount - 1);
    const segT = Math.min((elapsed - segIndex * segDuration) / segDuration, 1);
    const t = easeInOut(segT);

    const from = positions[segIndex];
    const to = positions[segIndex + 1];
    const bx = from.x + (to.x - from.x) * t;
    const by = from.y + (to.y - from.y) * t;

    // Determine winner highlight only on last segment
    const highlightSlot = segIndex === segCount - 1 ? winnerSlotIdx : -1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx, pegs);
    drawSlots(ctx, slots, slotLabels, highlightSlot, colorKeys);

    // Ball
    ctx.beginPath();
    ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#e94560';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx - 3, by - 3, BALL_RADIUS * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();

    if (elapsed < DROP_DURATION_MS) {
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
