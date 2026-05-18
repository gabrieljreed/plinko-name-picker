# Plinko Name Picker — Copilot Instructions

## Project Overview

A browser-based single-page app where a Plinko ball randomly selects a winner from a list of names. After each round the user can remove the winner or keep them for the next round.

## Tech Stack & Constraints

- **Vanilla HTML/CSS/JavaScript** — no framework, no build step, no bundler
- **Canvas API** for board rendering and ball animation
- **No external dependencies** — runs by opening `index.html` directly in a browser
- **ES modules** (`type="module"` in the script tag); all JS files use `import`/`export`
- Tests use the **Node.js built-in test runner** (`node:test` and `node:assert/strict`); run with `node --test js/*.test.js`

## File Structure & Responsibilities

| File | Responsibility |
|---|---|
| `index.html` | App shell and static markup only; no inline scripts |
| `style.css` | All styles; uses CSS custom properties defined on `:root` |
| `js/main.js` | Entry point — wires modules together, owns app-level state, handles events |
| `js/names.js` | Pure name-list state: parse, shuffle, remove, color assignment |
| `js/plinko.js` | Board geometry, path computation (pure), canvas drawing, ball animation |
| `js/ui.js` | DOM helpers: update count label, sync textarea, show/hide modals |
| `js/names.test.js` | Unit tests for `names.js` |
| `js/plinko.test.js` | Unit tests for pure functions in `plinko.js` |

## Architecture & Data Flow

```
[textarea input] → names.js (parse/shuffle) → main.js (slot assignment)
    → plinko.js drawBoard() → user clicks Drop
    → plinko.js dropBall() → onLand(winnerName) callback
    → ui.js showWinnerModal() → user clicks OK or Cancel
    → names.js remove() (OK) or no-op (Cancel)
    → main.js render() → loop
```

## Key Design Decisions

### Separation of pure vs. DOM code
- `plinko.js` exports pure geometry functions (`computePath`, `pathToGap`, `gapToSlot`, `pathToWaypoints`, `computeLayout`) that have no side effects and are unit-tested. Keep new logic in this style.
- Drawing functions (`drawBoard`, `dropBall`) take `canvas` as a parameter — they never access `document` directly.
- `ui.js` is the only module that caches DOM element references at module load time.

### Slot color system
- Colors are assigned in `names.js` via `getNameHue(name)` using the **golden angle (137°)** for even hue distribution: `hue = (index * 137) % 360`.
- Colors are assigned on first appearance and never reassigned, giving each name a stable color across rounds.
- `drawBoard` and `dropBall` accept both `slotLabels` (visible text) and `colorKeys` (stable names for color lookup) as separate parameters so colors don't shift when the name list changes mid-round.

### Slot shuffle strategy
- Slot order is maintained in `main.js` via `slotIndices` — a shuffled index array into `getNames()`.
- Indices are only reshuffled when the name count changes, giving visual stability between rounds.
- `stableSlotNames` is snapshotted at drop time so mid-edit name changes don't affect an in-flight animation.

### Board geometry
- Peg rows: `Math.max(6, Math.ceil(Math.log2(slotCount)) + 4)`
- Row `i` has `i + 1` pegs, centered horizontally with `colSpacing = boardW / pegRows`
- Slot width is uniform: `boardW / slotCount`
- All layout is recomputed from canvas dimensions on every render (responsive)

### Persistence
- Names are saved to `localStorage` under the key `'plinko-names'` on every `input` event and after each round update.

## Coding Conventions

- Use `const` by default; `let` only when reassignment is needed.
- Prefer plain functions over classes.
- Canvas drawing functions always call `ctx.clearRect` first before redrawing.
- Animation uses `requestAnimationFrame`; `dropBall` returns a cancel function (`() => cancelAnimationFrame(rafId)`).
- Modal visibility is toggled via adding/removing the `hidden` CSS class (which uses `display: none !important`).
- Keyboard shortcuts (Enter = OK, Escape = Cancel) are handled in `main.js` with a `keydown` listener that checks whether the modal overlay is visible first.

## Testing

- Only **pure functions** are unit-tested (no DOM, no canvas).
- Tests live in `*.test.js` files alongside the module they test.
- Use `node:test` and `node:assert/strict`; do not introduce any test framework dependency.
- Each test file uses `beforeEach` to reset state to a known fixture (`'Alice\nBob\nCarol'`).
