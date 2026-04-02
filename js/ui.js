// DOM manipulation helpers

const textarea       = document.getElementById('name-input');
const nameCount      = document.getElementById('name-count');
const dropBtn        = document.getElementById('drop-btn');
const modalOverlay   = document.getElementById('modal-overlay');
const modalWinnerTxt = document.getElementById('modal-winner-text');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverText   = document.getElementById('gameover-text');

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
