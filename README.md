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
  main.js           Entry point — wires modules together, owns app-level state
  names.js          Pure name-list state: parse, shuffle, remove, colour assignment
  plinko.js         Board geometry, physics, canvas drawing, ball animation
  ui.js             DOM helpers, settings panel, confetti
  names.test.js     Unit tests for names.js
  plinko.test.js    Unit tests for pure functions in plinko.js
```

### Data flow

```
[textarea input] → names.js (parse/shuffle) → main.js (slot assignment)
    → plinko.js drawBoard() → user clicks Drop
    → plinko.js dropBall() / dropBallPhysics() → onLand(winnerName)
    → ui.js showWinnerModal() → user clicks OK or Cancel
    → names.js remove() (OK) or no-op (Cancel) → render() → loop
```

### Key design points

- **Pure functions** — `plinko.js` exports geometry and physics helpers (`computePath`, `stepBall`, `detectSlotEntry`, `computePads`, `checkPadCollisions`, etc.) that have no side effects and are fully unit-tested.
- **Drawing functions** take `canvas` as a parameter and never touch `document` directly.
- **`ui.js`** is the only module that caches DOM element references at load time.
- **Slot colours** use the golden angle (137 °) for even hue distribution and are assigned once per name, staying stable across rounds.

## Running the tests

Tests use the Node.js built-in test runner — no extra packages needed.

```bash
node --test js/*.test.js
```

Only pure functions are tested (no DOM, no canvas). Test files live alongside the modules they test (`names.test.js`, `plinko.test.js`).
