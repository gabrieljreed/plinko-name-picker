import { setNamesFromText, getNames, getCount, remove } from './names.js';
import { renderNameCount, syncTextarea, showWinnerModal, hideWinnerModal, showGameOver, hideGameOver, toggleSettingsPanel, closeSettingsPanel, isSettingsPanelOpen, isPhysicsMode, setPhysicsMode } from './ui.js';
import { drawBoard, dropBall, dropBallPhysics } from './plinko.js';

const textarea  = document.getElementById('name-input');
const canvas    = document.getElementById('plinko-canvas');
const container = document.getElementById('board-container');
const dropBtn   = document.getElementById('drop-btn');
const settingsBtn = document.getElementById('settings-btn');
const modalOk     = document.getElementById('modal-ok');
const modalCancel = document.getElementById('modal-cancel');
const gameoverRestart = document.getElementById('gameover-restart');

let cancelDrop = null;
let currentSlotNames = [];
let stableSlotNames = [];   // color source — only updated on count change or at drop time
let slotIndices = [];       // shuffled indices into getNames(); only reshuffled when count changes
let pendingWinner = null;   // winner name waiting for OK/Cancel
let originalNames = null;   // snapshot taken at the start of each game

function reshuffleSlots() {
  const n = getCount();
  slotIndices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slotIndices[i], slotIndices[j]] = [slotIndices[j], slotIndices[i]];
  }
}

function sizeCanvas() {
  canvas.width  = container.clientWidth;
  canvas.height = Math.max(container.clientHeight, 340);
}

function render() {
  setNamesFromText(textarea.value);
  renderNameCount(getCount());
  sizeCanvas();
  if (getCount() !== slotIndices.length) {
    reshuffleSlots();
    stableSlotNames = slotIndices.map(i => getNames()[i]);
  }
  currentSlotNames = slotIndices.map(i => getNames()[i]);
  drawBoard(canvas, currentSlotNames, stableSlotNames);
}

function onDrop() {
  if (cancelDrop) return;
  if (!originalNames) originalNames = getNames();
  // Freeze colors at drop time so any mid-edit names get a stable color.
  stableSlotNames = [...currentSlotNames];
  dropBtn.disabled = true;
  textarea.disabled = true;

  const dropFn = isPhysicsMode() ? dropBallPhysics : dropBall;
  cancelDrop = dropFn(canvas, currentSlotNames, stableSlotNames, (winnerName) => {
    cancelDrop = null;
    pendingWinner = winnerName;
    showWinnerModal(winnerName);
  });
}

function onOK() {
  hideWinnerModal();
  const winner = pendingWinner;
  remove(winner);
  pendingWinner = null;
  textarea.disabled = false;

  if (getCount() === 0) {
    syncTextarea([]);
    renderNameCount(0);
    showGameOver(winner);
    return;
  }

  syncTextarea(getNames());
  render();
}

function onCancel() {
  hideWinnerModal();
  pendingWinner = null;
  textarea.disabled = false;
  render();
}

function onRestart() {
  hideGameOver();
  syncTextarea(originalNames ?? []);
  originalNames = null;
  render();
}

// Keyboard shortcuts: Enter = OK, Escape = Cancel (when modal is open)
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('modal-overlay').classList.contains('hidden')) {
    if (e.key === 'Enter') onOK();
    if (e.key === 'Escape') onCancel();
  }
});

const STORAGE_KEY = 'plinko-names';
const PHYSICS_STORAGE_KEY = 'plinko-physics-mode';

function saveNames() {
  localStorage.setItem(STORAGE_KEY, textarea.value);
}

function loadNames() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) textarea.value = saved;
}

function loadPhysicsMode() {
  setPhysicsMode(localStorage.getItem(PHYSICS_STORAGE_KEY) === 'true');
}

textarea.addEventListener('input', () => { saveNames(); render(); });
dropBtn.addEventListener('click', onDrop);
modalOk.addEventListener('click', onOK);
modalCancel.addEventListener('click', onCancel);
gameoverRestart.addEventListener('click', onRestart);

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSettingsPanel();
});

document.getElementById('physics-toggle').addEventListener('change', () => {
  localStorage.setItem(PHYSICS_STORAGE_KEY, isPhysicsMode());
});

// Close settings panel when clicking outside it
document.addEventListener('click', (e) => {
  if (isSettingsPanelOpen()
      && !document.getElementById('settings-panel').contains(e.target)
      && !document.getElementById('settings-btn').contains(e.target)) {
    closeSettingsPanel();
  }
});

new ResizeObserver(render).observe(container);

loadNames();
loadPhysicsMode();
render();
