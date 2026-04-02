// Source-of-truth name list state

let names = [];

// Color assignment — each name gets a stable index on first appearance.
// Uses the golden angle (137°) for even hue distribution.
const colorMap = new Map();
let colorCounter = 0;

function assignColor(name) {
  if (!colorMap.has(name)) {
    colorMap.set(name, colorCounter++);
  }
}

/**
 * Return the HSL hue (0–359) assigned to this name, or null if the name
 * hasn't been finalized yet (no newline pressed after it).
 */
export function getNameHue(name) {
  if (!colorMap.has(name)) return null;
  return Math.round((colorMap.get(name) * 137) % 360);
}

/** Parse a newline-separated string into the names array. */
export function setNamesFromText(text) {
  names = text.split('\n').map(n => n.trim()).filter(Boolean);
  names.forEach(assignColor);
}

/** Return a copy of the current names array. */
export function getNames() {
  return [...names];
}

/** Return the count of names. */
export function getCount() {
  return names.length;
}

/** Fisher-Yates in-place shuffle of the internal array. */
export function shuffle() {
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
}

/** Remove a single name (first occurrence) from the list. */
export function remove(name) {
  const idx = names.indexOf(name);
  if (idx !== -1) names.splice(idx, 1);
}

/**
 * Return a shuffled copy of names assigned to slot indices.
 * The returned array index corresponds to a slot on the board.
 */
export function assignToSlots() {
  const copy = [...names];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
