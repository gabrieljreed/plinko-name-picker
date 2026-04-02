import { setNamesFromText, getNames, getCount, remove } from './names.js';
import { renderNameCount, syncTextarea, showWinnerModal, hideWinnerModal, showGameOver, hideGameOver } from './ui.js';
import { drawBoard, dropBall } from './plinko.js';

const textarea  = document.getElementById('name-input');
const canvas    = document.getElementById('plinko-canvas');
const container = document.getElementById('board-container');
const dropBtn   = document.getElementById('drop-btn');
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

  cancelDrop = dropBall(canvas, currentSlotNames, stableSlotNames, (winnerName) => {
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

function saveNames() {
  localStorage.setItem(STORAGE_KEY, textarea.value);
}

function loadNames() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) textarea.value = saved;
}

textarea.addEventListener('input', () => { saveNames(); render(); });
dropBtn.addEventListener('click', onDrop);
modalOk.addEventListener('click', onOK);
modalCancel.addEventListener('click', onCancel);
gameoverRestart.addEventListener('click', onRestart);

new ResizeObserver(render).observe(container);

loadNames();
render();
