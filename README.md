# Plinko Name Picker

A browser-based single-page app where a Plinko ball randomly selects a winner from a list of names. After each round the winner can be removed or kept for the next round.

No framework, no build step, no dependencies — just open `index.html` in a browser.

## Features

- **Classic mode** — scripted ball path following a randomised left/right sequence through the pegs
- **Physics mode** — real gravity, peg collisions, and wall bounces
- **Full board** — rectangular staggered peg grid instead of a triangle (forces physics)
- **Aiming mode** — ball sways back and forth at the top; click Drop to release from wherever it is. Speed increases as names are eliminated.
- **Bumper pads** — angled pads on the sides deflect the ball with extra speed
- **Sliding bumper** — a horizontal bumper oscillates just above the slots and sends the ball back up on contact
- **Adjustable ball size** — slider in the settings panel
- **Confetti** — fires on every winner and on game-over
- All settings persist via `localStorage`

## Running the app

```
open index.html
```

No server required. Works in any modern browser (Chrome, Edge, Firefox, Safari).

## Architecture

```
index.html          App shell and static markup
style.css           All styles; CSS custom properties on :root
js/
  main.js           Thin controller wiring state, storage, UI, and plinko rendering
  state.js          Pure app state and round transitions
  storage.js        Persistence boundary around localStorage
  plinko.js         Board geometry, physics, canvas drawing, and animation
  ui.js             DOM/view helpers, settings panel, and confetti
  names.js          Name parsing and legacy colour-assignment helpers
  *.test.js         Unit tests for pure modules
```

### Data flow

```
[textarea input] → main.js → state.js (entrant parsing + slot state)
    → storage.js (persist text/settings)
    → plinko.js drawBoard()
    → user clicks Drop
    → plinko.js dropBall() / dropBallPhysics() → onLand(winner entrant)
    → ui.js showWinnerModal()
    → state.js confirm/cancel/restart transition
    → main.js re-renders controls + board
```

### Key design points

- **Pure app state** — `state.js` owns entrant identity, duplicate-safe winner removal, round snapshots, slot order, and settings updates.
- **Explicit plinko config** — `plinko.js` no longer relies on hidden runtime mode for layout or physics; board options are passed in from `main.js`.
- **Pure functions** — `plinko.js` exports geometry and physics helpers (`computePath`, `stepBall`, `detectSlotEntry`, `computeLayout`, `computePads`, `checkPadCollisions`, etc.) that have no side effects and are fully unit-tested.
- **Drawing functions** take `canvas` as a parameter and never touch `document` directly.
- **`storage.js`** is the only module that reads or writes `localStorage`.
- **`ui.js`** is the only module that caches DOM element references at load time.
- **Duplicate labels are safe** because the app tracks entrants by internal IDs even when multiple slots show the same label.

## Running the tests

Tests use the Node.js built-in test runner — no extra packages needed.

```bash
node --test js/*.test.js
```

Only pure functions are tested (no DOM, no canvas). Test files live alongside the modules they test (`state.test.js`, `storage.test.js`, `plinko.test.js`, `names.test.js`).
