import { setNamesFromText } from './names.js';
import { closeSettingsPanel, getBallSizeValue, getUiElements, hideGameOver, hideWinnerModal, isBumperPadsMode, isSettingsPanelOpen, isSettingsTarget, isSlidingBumperMode, isWinnerModalOpen, renderNameCount, setAimingMode, setBallSizeValue, setBumperPadsMode, setFullBoardMode, setPhysicsMode, setSlidingBumperMode, showGameOver, showWinnerModal, syncTextarea, toggleSettingsPanel } from './ui.js';
import { drawBoard, dropBall, dropBallPhysics, startOscillation } from './plinko.js';
import { beginRound, cancelPendingWinner, confirmPendingWinner, createInitialState, getEntrantLabel, getSlotEntrants, getStableSlotEntrants, markPendingWinner, restartRound, setEntrantsFromText as setStateEntrantsFromText, syncSlotOrder, updateSettings } from './state.js';
import { loadAppSnapshot, saveAppSnapshot } from './storage.js';

const {
  textarea,
  canvas,
  boardContainer: container,
  dropBtn,
  settingsBtn,
  modalOk,
  modalCancel,
  gameoverRestart,
  physicsToggle,
  fullBoardToggle,
  aimingToggle,
  bumperPadsToggle,
  slidingBumperToggle,
  ballSizeSlider,
} = getUiElements();

let cancelDrop = null;
let oscillationHandle = null;
let state = createInitialState();

function getEntrantCount() {
  return state.entrants.length;
}

function getCurrentSlotValues() {
  return getSlotEntrants(state);
}

function getStableSlotValues() {
  const stableEntrants = getStableSlotEntrants(state);
  return stableEntrants.length > 0 ? stableEntrants : getSlotEntrants(state);
}

function syncEntrantsFromTextarea() {
  state = setStateEntrantsFromText(state, textarea.value);
  setNamesFromText(textarea.value);
}

function syncStateFromTextarea() {
  syncEntrantsFromTextarea();
  state = syncSlotOrder(state);
}

function syncTextareaFromState() {
  syncTextarea(state.entrants.map((entrant) => entrant.label));
  persistApp();
}

function getBoardOptions() {
  return {
    ballRadius: state.settings.ballSize,
    bumperPads: state.settings.bumperPads,
    slidingBumper: state.settings.slidingBumper,
    fullBoard: state.settings.fullBoard,
  };
}

function persistApp() {
  saveAppSnapshot(localStorage, {
    namesText: textarea.value,
    settings: state.settings,
  });
}

function applySettings() {
  const { physicsMode, fullBoard, aimingMode, bumperPads, slidingBumper, ballSize } = state.settings;

  setPhysicsMode(physicsMode);
  setFullBoardMode(fullBoard);
  setAimingMode(aimingMode);
  setBumperPadsMode(bumperPads);
  setSlidingBumperMode(slidingBumper);
  setBallSizeValue(ballSize);
}

function sizeCanvas() {
  canvas.width  = container.clientWidth;
  canvas.height = Math.max(container.clientHeight, 340);
}

function renderControls() {
  renderNameCount(getEntrantCount());
}

function renderBoard() {
  sizeCanvas();
  const currentSlotValues = getCurrentSlotValues();
  const stableSlotValues = getStableSlotValues();

  // Cancel any existing oscillation before redrawing
  if (oscillationHandle) {
    oscillationHandle.cancel();
    oscillationHandle = null;
  }

  if (getEntrantCount() > 0 && state.settings.aimingMode && !cancelDrop) {
    const eliminated = state.originalEntrants ? (state.originalEntrants.length - getEntrantCount()) : 0;
    const speedFactor = Math.min(4, 1 + eliminated * 0.25);
    oscillationHandle = startOscillation(
      canvas,
      currentSlotValues,
      stableSlotValues,
      speedFactor,
      getBoardOptions(),
    );
  } else {
    drawBoard(canvas, currentSlotValues, stableSlotValues, getBoardOptions());
  }
}

function renderApp() {
  syncStateFromTextarea();
  renderControls();
  renderBoard();
}

function onDrop() {
  if (cancelDrop) return;
  state = beginRound(state);
  const roundSlotEntrants = getSlotEntrants(state);
  const stableSlotEntrants = getStableSlotEntrants(state);
  dropBtn.disabled = true;
  textarea.disabled = true;

  // Capture ball position from oscillation before cancelling it
  let initState = null;
  if (oscillationHandle) {
    initState = oscillationHandle.getBallState();
    oscillationHandle.cancel();
    oscillationHandle = null;
  }

  // Aiming mode forces physics so the starting position actually matters
  // Full board forces physics so the rectangular peg grid is physically simulated
  const usePhysics = state.settings.physicsMode
    || state.settings.fullBoard
    || (state.settings.aimingMode && initState !== null);
  const onWinner = (winnerName) => {
    cancelDrop = null;
    const winnerId = typeof winnerName === 'string'
      ? roundSlotEntrants.find((entrant) => entrant.label === winnerName)?.id ?? null
      : winnerName?.id ?? null;
    const winnerLabel = typeof winnerName === 'string' ? winnerName : winnerName?.label ?? '';
    if (winnerId) {
      state = markPendingWinner(state, winnerId);
    }
    showWinnerModal(winnerLabel);
  };

  if (usePhysics) {
    cancelDrop = dropBallPhysics(
      canvas,
      roundSlotEntrants,
      stableSlotEntrants,
      onWinner,
      initState,
      getBoardOptions(),
    );
  } else {
    cancelDrop = dropBall(
      canvas,
      roundSlotEntrants,
      stableSlotEntrants,
      onWinner,
      getBoardOptions(),
    );
  }
}

function onOK() {
  hideWinnerModal();
  const winner = getEntrantLabel(state, state.pendingWinnerId);
  state = confirmPendingWinner(state);
  textarea.disabled = false;

  if (getEntrantCount() === 0) {
    syncTextareaFromState();
    renderNameCount(0);
    showGameOver(winner);
    return;
  }

  syncTextareaFromState();
  renderApp();
}

function onCancel() {
  hideWinnerModal();
  state = cancelPendingWinner(state);
  textarea.disabled = false;
  renderBoard();
}

function onRestart() {
  hideGameOver();
  state = restartRound(state);
  syncTextareaFromState();
  renderApp();
}

// Keyboard shortcuts: Enter = OK, Escape = Cancel (when modal is open)
document.addEventListener('keydown', (e) => {
  if (isWinnerModalOpen()) {
    if (e.key === 'Enter') onOK();
    if (e.key === 'Escape') onCancel();
  }
});

textarea.addEventListener('input', () => {
  persistApp();
  renderApp();
});
dropBtn.addEventListener('click', onDrop);
modalOk.addEventListener('click', onOK);
modalCancel.addEventListener('click', onCancel);
gameoverRestart.addEventListener('click', onRestart);

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSettingsPanel();
});

physicsToggle.addEventListener('change', () => {
  state = updateSettings(state, { physicsMode: physicsToggle.checked });
  persistApp();
});

fullBoardToggle.addEventListener('change', () => {
  const enabled = fullBoardToggle.checked;
  state = updateSettings(state, { fullBoard: enabled });
  persistApp();
  renderBoard();
});

aimingToggle.addEventListener('change', () => {
  state = updateSettings(state, { aimingMode: aimingToggle.checked });
  persistApp();
  renderBoard(); // start or stop oscillation immediately
});

bumperPadsToggle.addEventListener('change', () => {
  const enabled = isBumperPadsMode();
  state = updateSettings(state, { bumperPads: enabled });
  persistApp();
  renderBoard();
});

slidingBumperToggle.addEventListener('change', () => {
  const enabled = isSlidingBumperMode();
  state = updateSettings(state, { slidingBumper: enabled });
  persistApp();
  renderBoard();
});

ballSizeSlider.addEventListener('input', () => {
  const val = getBallSizeValue();
  state = updateSettings(state, { ballSize: val });
  setBallSizeValue(val);   // keeps the displayed number in sync
  persistApp();
  renderBoard();
});

// Close settings panel when clicking outside it
document.addEventListener('click', (e) => {
  if (isSettingsPanelOpen()
      && !isSettingsTarget(e.target)) {
    closeSettingsPanel();
  }
});

new ResizeObserver(renderBoard).observe(container);

const initialSnapshot = loadAppSnapshot(localStorage);
textarea.value = initialSnapshot.namesText;
state = updateSettings(state, initialSnapshot.settings);
applySettings();
renderApp();
