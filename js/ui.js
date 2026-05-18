// DOM manipulation helpers

const textarea       = document.getElementById('name-input');
const canvas         = document.getElementById('plinko-canvas');
const boardContainer = document.getElementById('board-container');
const nameCount      = document.getElementById('name-count');
const dropBtn        = document.getElementById('drop-btn');
const settingsBtn    = document.getElementById('settings-btn');
const modalOverlay   = document.getElementById('modal-overlay');
const modalWinnerName = document.getElementById('modal-winner-name');
const modalOk        = document.getElementById('modal-ok');
const modalCancel    = document.getElementById('modal-cancel');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverText   = document.getElementById('gameover-text');
const gameoverRestart = document.getElementById('gameover-restart');
const settingsPanel  = document.getElementById('settings-panel');
const physicsToggle    = document.getElementById('physics-toggle');
const fullBoardToggle  = document.getElementById('full-board-toggle');
const aimingToggle     = document.getElementById('aiming-toggle');
const bumperPadsToggle = document.getElementById('bumper-pads-toggle');
const slidingBumperToggle = document.getElementById('sliding-bumper-toggle');
const ballSizeSlider = document.getElementById('ball-size-slider');
const ballSizeValueEl = document.getElementById('ball-size-value');

export function getUiElements() {
  return {
    textarea,
    canvas,
    boardContainer,
    dropBtn,
    settingsBtn,
    modalOk,
    modalCancel,
    gameoverRestart,
    settingsPanel,
    physicsToggle,
    fullBoardToggle,
    aimingToggle,
    bumperPadsToggle,
    slidingBumperToggle,
    ballSizeSlider,
  };
}

/** Update the "(N)" count label and enable/disable the Drop button. */
export function renderNameCount(count) {
  nameCount.textContent = count > 0 ? `(${count})` : '';
  dropBtn.disabled = count < 1;
}

/** Overwrite the textarea with the current names (one per line). */
export function syncTextarea(names) {
  textarea.value = names.join('\n');
}

// ── Confetti ──────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  '#e94560', '#ff6b35', '#ffcc02', '#00d4aa', '#4ec9ff',
  '#b06aff', '#ff4daa', '#7fff6a', '#ff8c00',
];
const CONFETTI_GRAVITY = 0.001; // px/ms²

let _confettiCanvas = null;
let _particles      = [];
let _confettiRafId  = null;

function getConfettiCanvas() {
  if (!_confettiCanvas) {
    _confettiCanvas = document.createElement('canvas');
    _confettiCanvas.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:300;';
    document.body.appendChild(_confettiCanvas);
  }
  _confettiCanvas.width  = window.innerWidth;
  _confettiCanvas.height = window.innerHeight;
  return _confettiCanvas;
}

function launchConfetti() {
  const canvas = getConfettiCanvas();
  const W = canvas.width;
  const H = canvas.height;
  const now = performance.now();

  // Two bursts: left-side shoots upper-right (40°–80°), right-side upper-left (100°–140°)
  for (let i = 0; i < 400; i++) {
    const side = i < 70;
    const angleDeg = side ? (40 + Math.random() * 40) : (100 + Math.random() * 40);
    const angleRad = (angleDeg * Math.PI) / 180;
    const speed    = 0.7 + Math.random() * 0.8; // px/ms
    _particles.push({
      x:     (side ? W * 0.25 : W * 0.75) + (Math.random() - 0.5) * 40,
      y:     H * 0.82,
      vx:    Math.cos(angleRad) * speed,
      vy:   -Math.sin(angleRad) * speed,
      angle: Math.random() * Math.PI * 2,
      spin:  (Math.random() - 0.5) * 0.012,       // rad/ms
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      w:     7 + Math.random() * 7,
      h:     4 + Math.random() * 5,
      shape: Math.floor(Math.random() * 3),        // 0=rect 1=ellipse 2=ribbon
      born:  now,
      ttl:   3500 + Math.random() * 1500,
    });
  }

  if (_confettiRafId) return; // loop already running — particles were just added

  let prev = null;
  function frame(ts) {
    const dt = prev === null ? 16 : Math.min(ts - prev, 32);
    prev = ts;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const CH = canvas.height;

    _particles = _particles.filter(p => {
      const age = ts - p.born;
      if (age >= p.ttl || p.y > CH + 60) return false;

      p.vy     += CONFETTI_GRAVITY * dt;
      p.vx     *= (1 - 0.0008 * dt); // gentle air resistance
      p.x      += p.vx * dt;
      p.y      += p.vy * dt;
      p.angle  += p.spin * dt;

      // Fade out in the last 25 % of lifetime
      const alpha = age < p.ttl * 0.75
        ? 1
        : 1 - (age - p.ttl * 0.75) / (p.ttl * 0.25);

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 0) {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else if (p.shape === 1) {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // ribbon: long thin strip
        ctx.fillRect(-p.w, -p.h / 4, p.w * 2, p.h / 2);
      }
      ctx.restore();
      return true;
    });

    if (_particles.length > 0) {
      _confettiRafId = requestAnimationFrame(frame);
    } else {
      _confettiRafId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  _confettiRafId = requestAnimationFrame(frame);
}

/** Show the winner modal for the given name. */
export function showWinnerModal(name) {
  modalWinnerName.textContent = name;
  modalOverlay.classList.remove('hidden');
  modalOk.focus();
  launchConfetti();
}

/** Hide the winner modal. */
export function hideWinnerModal() {
  modalOverlay.classList.add('hidden');
}

export function isWinnerModalOpen() {
  return !modalOverlay.classList.contains('hidden');
}

/** Show the game-over screen. lastWinner is the final remaining name. */
export function showGameOver(lastWinner) {
  gameoverText.textContent = `${lastWinner} is the last one standing!`;
  gameoverOverlay.classList.remove('hidden');
  launchConfetti();
}

/** Hide the game-over screen. */
export function hideGameOver() {
  gameoverOverlay.classList.add('hidden');
}

/** Toggle the settings panel open/closed, anchored above the settings button. */
export function toggleSettingsPanel() {
  if (settingsPanel.classList.contains('hidden')) {
    // Position panel above the settings button using viewport coordinates
    const rect = settingsBtn.getBoundingClientRect();
    settingsPanel.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
    settingsPanel.style.right  = (window.innerWidth - rect.right) + 'px';
    settingsPanel.classList.remove('hidden');
  } else {
    settingsPanel.classList.add('hidden');
  }
}

/** Close the settings panel if it is open. */
export function closeSettingsPanel() {
  settingsPanel.classList.add('hidden');
}

/** Returns true if the settings panel is currently visible. */
export function isSettingsPanelOpen() {
  return !settingsPanel.classList.contains('hidden');
}

export function isSettingsTarget(target) {
  return settingsPanel.contains(target) || settingsBtn.contains(target);
}

/** Returns true if physics mode is enabled. */
export function isPhysicsMode() {
  return physicsToggle.checked;
}

/** Set the physics mode toggle state. */
export function setPhysicsMode(enabled) {
  physicsToggle.checked = enabled;
}

/** Returns true if full board mode is enabled. */
export function isFullBoardMode() {
  return fullBoardToggle.checked;
}

/** Set the full board toggle state. */
export function setFullBoardMode(enabled) {
  fullBoardToggle.checked = enabled;
}

/** Returns true if aiming mode is enabled. */
export function isAimingMode() {
  return aimingToggle.checked;
}

/** Set the aiming mode toggle state. */
export function setAimingMode(enabled) {
  aimingToggle.checked = enabled;
}

/** Returns true if bumper pads mode is enabled. */
export function isBumperPadsMode() {
  return bumperPadsToggle.checked;
}

/** Set the bumper pads toggle state. */
export function setBumperPadsMode(enabled) {
  bumperPadsToggle.checked = enabled;
}

/** Returns true if the sliding bumper is enabled. */
export function isSlidingBumperMode() {
  return slidingBumperToggle.checked;
}

/** Set the sliding bumper toggle state. */
export function setSlidingBumperMode(enabled) {
  slidingBumperToggle.checked = enabled;
}

/** Returns the current ball size slider value as a number. */
export function getBallSizeValue() {
  return parseInt(ballSizeSlider.value, 10);
}

/** Set the ball size slider and its displayed value. */
export function setBallSizeValue(n) {
  ballSizeSlider.value = n;
  ballSizeValueEl.textContent = n;
}
