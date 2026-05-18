// DOM manipulation helpers

const textarea       = document.getElementById('name-input');
const nameCount      = document.getElementById('name-count');
const dropBtn        = document.getElementById('drop-btn');
const modalOverlay   = document.getElementById('modal-overlay');
const modalWinnerTxt = document.getElementById('modal-winner-text');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverText   = document.getElementById('gameover-text');
const settingsPanel  = document.getElementById('settings-panel');
const physicsToggle  = document.getElementById('physics-toggle');
const aimingToggle   = document.getElementById('aiming-toggle');
const ballSizeSlider = document.getElementById('ball-size-slider');
const ballSizeValueEl = document.getElementById('ball-size-value');

/** Update the "(N)" count label and enable/disable the Drop button. */
export function renderNameCount(count) {
  nameCount.textContent = count > 0 ? `(${count})` : '';
  dropBtn.disabled = count < 1;
}

/** Overwrite the textarea with the current names (one per line) and persist. */
export function syncTextarea(names) {
  textarea.value = names.join('\n');
  localStorage.setItem('plinko-names', textarea.value);
}

/** Show the winner modal for the given name. */
export function showWinnerModal(name) {
  modalWinnerTxt.innerHTML = `Winner!<strong>${name}</strong>`;
  modalOverlay.classList.remove('hidden');
  document.getElementById('modal-ok').focus();
}

/** Hide the winner modal. */
export function hideWinnerModal() {
  modalOverlay.classList.add('hidden');
}

/** Show the game-over screen. lastWinner is the final remaining name. */
export function showGameOver(lastWinner) {
  gameoverText.textContent = `${lastWinner} is the last one standing!`;
  gameoverOverlay.classList.remove('hidden');
}

/** Hide the game-over screen. */
export function hideGameOver() {
  gameoverOverlay.classList.add('hidden');
}

/** Toggle the settings panel open/closed, anchored above the settings button. */
export function toggleSettingsPanel() {
  if (settingsPanel.classList.contains('hidden')) {
    // Position panel above the settings button using viewport coordinates
    const btn = document.getElementById('settings-btn');
    const rect = btn.getBoundingClientRect();
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

/** Returns true if physics mode is enabled. */
export function isPhysicsMode() {
  return physicsToggle.checked;
}

/** Set the physics mode toggle state. */
export function setPhysicsMode(enabled) {
  physicsToggle.checked = enabled;
}

/** Returns true if aiming mode is enabled. */
export function isAimingMode() {
  return aimingToggle.checked;
}

/** Set the aiming mode toggle state. */
export function setAimingMode(enabled) {
  aimingToggle.checked = enabled;
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
