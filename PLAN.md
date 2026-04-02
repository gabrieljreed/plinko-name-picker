# Plinko Name Generator — Project Plan

## Overview

A browser-based game that uses a Plinko board to randomly select a winner from a list of names. After each round, the user can remove the winner or keep them in for the next round.

---

## Tech Stack

- **HTML/CSS/JavaScript** — no framework, no build step, single-page app
- **Canvas API** — for the Plinko board and ball animation
- No dependencies; runs entirely in the browser by opening `index.html`

---

## File Structure

```
plinko-name-generator/
├── index.html        # App shell and layout
├── style.css         # All styles
└── js/
    ├── main.js       # Entry point, wires everything together
    ├── names.js      # Name list state (add, remove, shuffle)
    ├── plinko.js     # Board geometry, path computation, canvas animation
    └── ui.js         # DOM manipulation, modal, input area updates
```

---

## Core Data Flow

```
[Name Input] → names.js (shuffle) → plinko.js (assign names to slots)
    → animate ball drop → resolve winner slot
    → ui.js (show winner modal)
    → [OK] remove winner from list → reshuffle → restart
    → [Cancel] keep list as-is   → reshuffle → restart
```

---

## Feature Breakdown

### 1. Name Input (`ui.js` + `names.js`)

- A `<textarea>` (one name per line) or tag-style chip inputs
- An **"Add Names"** / **"Start"** button to begin the game
- After a round ends, the input area updates to show remaining names
- The input is editable between rounds

### 2. Plinko Board (`plinko.js`)

- Drawn on an HTML `<canvas>` element
- **Pegs** arranged in a staggered triangular grid
- **Slots** at the bottom: one per name (dynamic width)
- Each slot is labeled with a shuffled name
- Number of peg rows scales with the number of names (min ~6, max ~12)

**Board geometry:**
- Slot count = number of names
- Peg rows = `Math.max(6, Math.ceil(Math.log2(slotCount)) + 4)` (ensures enough decision points)
- Row `i` has `i + 1` pegs, staggered so the ball can reach any slot

### 3. Ball Drop (`plinko.js`)

- Ball starts at the top-center of the board
- At each peg row, the path goes **left or right** (random, pre-computed before animation starts)
- Path is computed once → then animated step-by-step along that path
- Animation uses `requestAnimationFrame` with easing between peg positions
- Ball speed is configurable (constant for now, ~medium pace)

### 4. Winner Resolution (`main.js`)

- When the ball reaches the bottom, the slot (= name) it lands in is the winner
- A modal/overlay appears: **"[Name] wins!"**
- Two buttons:
  - **OK** (default, highlighted): removes winner from the name list, reshuffles remaining names, restarts
  - **Cancel**: keeps the name list unchanged, reshuffles, restarts
- If only one name remains and OK is pressed: show a "Game Over" / "final winner" screen

### 5. Name List State (`names.js`)

- Source-of-truth array of names
- `shuffle()` — Fisher-Yates in-place shuffle
- `remove(name)` — removes a single name
- `assignToSlots()` — returns shuffled copy mapped to slot indices

---

## UI Layout

```
┌─────────────────────────────────┐
│         Plinko Name Picker      │  ← title
├─────────────────────────────────┤
│                                 │
│       [  Canvas Board  ]        │  ← main visual area
│                                 │
├─────────────────────────────────┤
│  Names (8 remaining):           │
│  ┌───────────────────────────┐  │
│  │ Alice                     │  │  ← textarea, editable between rounds
│  │ Bob                       │  │
│  │ Carol                     │  │
│  └───────────────────────────┘  │
│           [ Drop! ]             │  ← triggers ball drop
└─────────────────────────────────┘
```

**Winner Modal (overlay):**
```
┌──────────────────┐
│   🎉 Alice wins! │
│                  │
│  [Cancel]  [OK]  │  ← OK is default (focused), removes Alice
└──────────────────┘
```

---

## Implementation Phases

### Phase 1 — Static Layout
- `index.html` with canvas, textarea, and button
- `style.css` with basic layout, colors, modal placeholder

### Phase 2 — Name Management
- `names.js`: parse textarea, shuffle, remove
- `ui.js`: render name count, sync textarea after removal

### Phase 3 — Plinko Board
- `plinko.js`: draw pegs, slots, and slot labels on canvas
- Board resizes when name count changes

### Phase 4 — Ball Animation
- Pre-compute random path
- Animate ball along path using `requestAnimationFrame`
- Highlight winning slot when ball lands

### Phase 5 — Winner Flow
- Show modal with winner name
- Wire OK / Cancel buttons
- Loop back to Phase 3 with updated name list

### Phase 6 — Polish
- Responsive canvas sizing
- Sound effects (optional)
- Keyboard shortcut: Enter = OK, Escape = Cancel
- Persist name list to `localStorage`

---

## Open Questions / Decisions

| Question | Default decision |
|---|---|
| Input style: textarea vs. chips | Textarea (simpler) |
| Board color scheme | Dark background, bright pegs, colorful slots |
| Ball physics: pure random or weighted? | Pure random (50/50 at each peg) |
| Animation speed | Fixed medium speed (~800ms total drop) |
| Mobile support | Yes, canvas scales to viewport |
