# Plinko Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the app so state, persistence, DOM updates, and plinko simulation have clear boundaries while preserving current behavior.

**Architecture:** Keep the no-build, browser-only structure, but move app decisions into a pure state module, isolate `localStorage` behind a storage module, narrow `ui.js` to DOM/view work, and make `plinko.js` consume explicit config/state instead of module globals. The implementation should stay incremental so the app remains runnable and tests stay green after each task.

**Tech Stack:** Vanilla ES modules, browser DOM APIs, Canvas 2D, Node.js built-in test runner

---

## Planned File Structure

- Modify: `js/main.js`
  - Become the thin app controller that wires state, storage, UI, and plinko engine.
- Modify: `js/names.js`
  - Replace mutable string-list state with pure entrant parsing and color utilities, or trim it down to entrant/color helpers only.
- Create: `js/state.js`
  - Hold the app state shape and pure transition functions.
- Create: `js/state.test.js`
  - Cover round lifecycle, duplicate-name handling, slot assignment stability, and restart behavior.
- Create: `js/storage.js`
  - Centralize persistence keys and `localStorage` load/save logic.
- Create: `js/storage.test.js`
  - Cover parsing defaults and serialization without needing the browser.
- Modify: `js/ui.js`
  - Limit to DOM refs, view rendering, modal/settings helpers, and confetti; remove persistence and unsafe HTML injection.
- Modify: `js/plinko.js`
  - Accept explicit config/options for board drawing and ball simulation; stop reading runtime mode from module globals.
- Modify: `js/plinko.test.js`
  - Update tests for any pure helper signature changes introduced by explicit config.
- Modify: `README.md`
  - Refresh the architecture section after the refactor is complete.

### Target State Shape

```js
{
  entrants: [{ id: 'e1', label: 'Alice' }],
  slotOrder: ['e1'],
  stableSlotOrder: ['e1'],
  originalEntrantIds: ['e1', 'e2'],
  pendingWinnerId: null,
  dropInFlight: false,
  settings: {
    physicsMode: false,
    fullBoard: false,
    aimingMode: false,
    bumperPads: true,
    slidingBumper: false,
    ballSize: 30,
  },
}
```

### Refactor Rules

- Preserve current UX and features.
- Do not add dependencies or a build step.
- Prefer pure functions for any logic that can be tested under `node --test`.
- Support duplicate labels by using entrant IDs internally.
- Keep DOM reads/writes out of pure state transitions.

### Task 1: Introduce Pure App State

**Files:**
- Create: `js/state.js`
- Create: `js/state.test.js`
- Modify: `js/main.js`

- [ ] **Step 1: Write failing tests for state transitions and duplicate identities**

```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createInitialState,
  setEntrantsFromText,
  beginRound,
  markPendingWinner,
  confirmPendingWinner,
  cancelPendingWinner,
  restartRound,
} from './state.js';

test('duplicate labels get distinct ids and only the winning id is removed', () => {
  let state = createInitialState();
  state = setEntrantsFromText(state, 'Alice\nAlice\nBob');
  state = beginRound(state, () => [2, 0, 1]);
  const winnerId = state.slotOrder[1];
  state = markPendingWinner(state, winnerId);
  state = confirmPendingWinner(state);
  assert.equal(state.entrants.length, 2);
  assert.equal(state.entrants.filter(e => e.label === 'Alice').length, 1);
});

test('restartRound restores the original entrant set from the first drop', () => {
  let state = createInitialState();
  state = setEntrantsFromText(state, 'Alice\nBob');
  state = beginRound(state, () => [1, 0]);
  state = markPendingWinner(state, state.slotOrder[0]);
  state = confirmPendingWinner(state);
  state = restartRound(state);
  assert.deepEqual(state.entrants.map(e => e.label), ['Alice', 'Bob']);
});
```

- [ ] **Step 2: Run the new state tests and verify they fail because the module does not exist yet**

Run: `node --test --test-isolation=none js/state.test.js`
Expected: FAIL with module resolution or missing export errors for `./state.js`

- [ ] **Step 3: Implement the minimal pure state module**

```js
export function createInitialState(overrides = {}) {
  return {
    entrants: [],
    slotOrder: [],
    stableSlotOrder: [],
    originalEntrantIds: null,
    pendingWinnerId: null,
    dropInFlight: false,
    settings: {
      physicsMode: false,
      fullBoard: false,
      aimingMode: false,
      bumperPads: true,
      slidingBumper: false,
      ballSize: 30,
      ...overrides.settings,
    },
  };
}

export function setEntrantsFromText(state, text) { /* parse labels into entrant objects */ }
export function beginRound(state, shuffleIndices) { /* set slotOrder + stableSlotOrder */ }
export function markPendingWinner(state, entrantId) { /* set pending winner */ }
export function confirmPendingWinner(state) { /* remove only matching id */ }
export function cancelPendingWinner(state) { /* clear pending winner */ }
export function restartRound(state) { /* restore snapshot */ }
```

- [ ] **Step 4: Move `main.js` name/slot/original-winner state into `state.js` consumers without changing UI behavior**

```js
import {
  createInitialState,
  setEntrantsFromText,
  beginRound,
  markPendingWinner,
  confirmPendingWinner,
  cancelPendingWinner,
  restartRound,
} from './state.js';

let state = createInitialState();

function syncEntrantsFromTextarea() {
  state = setEntrantsFromText(state, textarea.value);
}
```

- [ ] **Step 5: Run state and existing tests to verify the new state layer is stable**

Run: `node --test --test-isolation=none js/state.test.js js/names.test.js js/plinko.test.js`
Expected: PASS for all tests

- [ ] **Step 6: Commit**

```bash
git add js/state.js js/state.test.js js/main.js js/names.test.js js/plinko.test.js
git commit -m "refactor: introduce pure app state"
```

### Task 2: Centralize Persistence

**Files:**
- Create: `js/storage.js`
- Create: `js/storage.test.js`
- Modify: `js/main.js`
- Modify: `js/ui.js`

- [ ] **Step 1: Write failing tests for settings defaults and persisted text loading**

```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadAppSnapshot, saveAppSnapshot } from './storage.js';

test('loadAppSnapshot returns default settings when keys are missing', () => {
  const store = new Map();
  const snapshot = loadAppSnapshot({
    getItem(key) { return store.has(key) ? store.get(key) : null; },
  });
  assert.equal(snapshot.settings.bumperPads, true);
  assert.equal(snapshot.settings.ballSize, 30);
});

test('saveAppSnapshot persists textarea text and settings in one place', () => {
  const writes = new Map();
  saveAppSnapshot({
    setItem(key, value) { writes.set(key, value); },
  }, {
    namesText: 'Alice\nBob',
    settings: { physicsMode: true, fullBoard: false, aimingMode: false, bumperPads: true, slidingBumper: false, ballSize: 24 },
  });
  assert.equal(writes.get('plinko-names'), 'Alice\nBob');
  assert.equal(writes.get('plinko-physics-mode'), 'true');
});
```

- [ ] **Step 2: Run storage tests and verify they fail before implementation**

Run: `node --test --test-isolation=none js/storage.test.js`
Expected: FAIL because `js/storage.js` does not exist yet

- [ ] **Step 3: Implement `js/storage.js` as the only module that knows persistence keys**

```js
export const STORAGE_KEYS = {
  names: 'plinko-names',
  physicsMode: 'plinko-physics-mode',
  aimingMode: 'plinko-aiming-mode',
  fullBoard: 'plinko-full-board',
  bumperPads: 'plinko-bumper-pads',
  slidingBumper: 'plinko-sliding-bumper',
  ballSize: 'plinko-ball-size',
};

export function loadAppSnapshot(storage = localStorage) { /* parse values + defaults */ }
export function saveAppSnapshot(storage = localStorage, snapshot) { /* write names + settings */ }
```

- [ ] **Step 4: Remove persistence writes from `ui.js` and replace scattered `main.js` key handling with the storage module**

```js
import { loadAppSnapshot, saveAppSnapshot } from './storage.js';

function persist() {
  saveAppSnapshot(localStorage, {
    namesText: textarea.value,
    settings: state.settings,
  });
}
```

- [ ] **Step 5: Run storage and app tests**

Run: `node --test --test-isolation=none js/storage.test.js js/state.test.js js/names.test.js js/plinko.test.js`
Expected: PASS for all tests

- [ ] **Step 6: Commit**

```bash
git add js/storage.js js/storage.test.js js/main.js js/ui.js
git commit -m "refactor: centralize local storage access"
```

### Task 3: Make Plinko Config Explicit

**Files:**
- Modify: `js/plinko.js`
- Modify: `js/plinko.test.js`
- Modify: `js/main.js`

- [ ] **Step 1: Add failing tests for config-driven helpers**

```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeLayout, stepBall } from './plinko.js';

test('computeLayout uses the provided fullBoard flag instead of module state', () => {
  const triangle = computeLayout(600, 500, 4, { fullBoard: false });
  const full = computeLayout(600, 500, 4, { fullBoard: true });
  assert.notEqual(triangle.pegs.length, full.pegs.length);
});

test('stepBall uses the provided ball radius instead of a hidden module global', () => {
  const result = stepBall({ x: 5, y: 20, vx: -1, vy: 0 }, [], 0, 300, 16, { ballRadius: 20 });
  assert.ok(result.x >= 20);
});
```

- [ ] **Step 2: Run the plinko tests and verify they fail against current signatures**

Run: `node --test --test-isolation=none js/plinko.test.js`
Expected: FAIL because helpers do not yet accept explicit config objects

- [ ] **Step 3: Refactor `plinko.js` so runtime settings are passed in as options**

```js
function withDefaults(options = {}) {
  return {
    ballRadius: 30,
    bumperPads: true,
    slidingBumper: false,
    fullBoard: false,
    ...options,
  };
}

export function computeLayout(canvasW, canvasH, slotCount, options = {}) { /* use options.fullBoard */ }
export function stepBall(ball, pegs, wallLeft, wallRight, dt, options = {}) { /* use options.ballRadius */ }
export function drawBoard(canvas, viewModel, options = {}) { /* no hidden globals */ }
export function dropBallPhysics(canvas, viewModel, options = {}) { /* thread options through */ }
```

- [ ] **Step 4: Update `main.js` to build one config object from `state.settings` and pass it into all plinko calls**

```js
function getBoardOptions() {
  return {
    ballRadius: state.settings.ballSize,
    bumperPads: state.settings.bumperPads,
    slidingBumper: state.settings.slidingBumper,
    fullBoard: state.settings.fullBoard,
  };
}
```

- [ ] **Step 5: Run the plinko and state test suite**

Run: `node --test --test-isolation=none js/plinko.test.js js/state.test.js js/storage.test.js js/names.test.js`
Expected: PASS for all tests

- [ ] **Step 6: Commit**

```bash
git add js/plinko.js js/plinko.test.js js/main.js
git commit -m "refactor: make plinko runtime config explicit"
```

### Task 4: Narrow the UI Boundary and Remove Unsafe HTML

**Files:**
- Modify: `js/ui.js`
- Modify: `index.html`
- Modify: `js/main.js`

- [ ] **Step 1: Write a small DOM-focused regression checklist before editing**

```text
1. Winner modal still shows the selected entrant label.
2. Duplicate labels display exactly as entered.
3. Settings panel still toggles and closes on outside click.
4. Confetti still fires on winner and game over.
```

- [ ] **Step 2: Replace `innerHTML` winner rendering with safe DOM updates and explicit nodes**

```html
<p id="modal-winner-text">
  <span>Winner!</span>
  <strong id="modal-winner-name"></strong>
</p>
```

```js
const modalWinnerName = document.getElementById('modal-winner-name');

export function showWinnerModal(name) {
  modalWinnerName.textContent = name;
  modalOverlay.classList.remove('hidden');
  modalOk.focus();
  launchConfetti();
}
```

- [ ] **Step 3: Move `document.getElementById(...)` lookups and event-related helpers behind a single UI API**

```js
export function getUiElements() {
  return {
    textarea,
    dropBtn,
    settingsBtn,
    modalOk,
    modalCancel,
    gameoverRestart,
    boardContainer,
    canvas,
  };
}
```

- [ ] **Step 4: Update `main.js` to consume the UI API instead of mixing its own DOM cache with `ui.js` internals**

```js
import { getUiElements, renderNameCount, syncTextarea, showWinnerModal } from './ui.js';

const ui = getUiElements();
const { textarea, canvas, boardContainer, dropBtn } = ui;
```

- [ ] **Step 5: Manually verify the UI regression checklist in the browser**

Run: open `index.html`
Expected: winner modal text is safe, settings still work, confetti still renders, no visual regressions in normal flow

- [ ] **Step 6: Commit**

```bash
git add index.html js/ui.js js/main.js
git commit -m "refactor: narrow ui boundary and remove unsafe modal rendering"
```

### Task 5: Simplify the Main Controller

**Files:**
- Modify: `js/main.js`
- Modify: `README.md`

- [ ] **Step 1: Replace the all-purpose `render()` flow with three focused controller functions**

```js
function syncStateFromTextarea() { /* parse textarea into state */ }
function renderControls() { /* count, disabled states, modal visibility */ }
function renderBoard() { /* canvas size + draw or oscillate */ }
```

- [ ] **Step 2: Ensure non-data events do not mutate entrant state**

```js
new ResizeObserver(() => {
  sizeCanvas();
  renderBoard();
}).observe(boardContainer);
```

- [ ] **Step 3: Route all winner actions through state transitions instead of ad-hoc local variables**

```js
function onDropComplete(winnerId) {
  state = markPendingWinner(state, winnerId);
  showWinnerModal(getEntrantLabel(state, winnerId));
}

function onWinnerConfirmed() {
  state = confirmPendingWinner(state);
  syncTextarea(state.entrants.map(e => e.label));
  renderApp();
}
```

- [ ] **Step 4: Remove dead APIs and update docs to match the final architecture**

```md
js/state.js        Pure app state and round transitions
js/storage.js      Persistence boundary around localStorage
js/ui.js           DOM/view helpers and confetti
js/plinko.js       Board layout, animation, and physics with explicit options
js/main.js         Thin controller wiring modules together
```

- [ ] **Step 5: Run the full automated suite and a final manual smoke test**

Run: `node --test --test-isolation=none js/*.test.js`
Expected: PASS for all tests

Run: open `index.html`
Expected: names entry, classic drop, physics drop, aiming mode, full board, bumper pads, sliding bumper, restart flow, and modal cancel/confirm all behave as before

- [ ] **Step 6: Commit**

```bash
git add js/main.js README.md
git commit -m "refactor: simplify main controller architecture"
```

## Sequence Notes

- Implement in task order. Each task reduces coupling for the next one.
- Do not start `plinko.js` API cleanup before the state model exists; otherwise the winner identity problem remains unresolved.
- Do not remove old helper exports from `names.js` until `main.js` and tests no longer depend on them.
- Keep the app runnable after every task, even if some internal duplication remains temporarily.

## Risks to Watch

- Duplicate-label handling can break silently if any callback still passes winner labels instead of winner IDs.
- Canvas code is sensitive to signature churn; keep `viewModel` objects small and explicit.
- `ResizeObserver` redraws must not recreate round state or reshuffle slots.
- If `state.settings.ballSize` uses diameter semantics anywhere, normalize it once and document whether plinko consumes radius or size.

## Verification Checklist

- Automated:
  - `node --test --test-isolation=none js/*.test.js`
- Manual:
  - Enter names, reload page, verify names/settings restore.
  - Drop in classic mode and confirm winner removal.
  - Enter duplicate labels and verify only the correct winner instance is removed.
  - Toggle physics/full-board/aiming/bumper/sliding-bumper settings and verify board behavior updates immediately.
  - Change ball size and verify both drawing and physics match.
  - Complete a full game, then restart and verify the original entrant list is restored.

