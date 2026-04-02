import { strict as assert } from 'node:assert';
import { test, beforeEach } from 'node:test';
import { setNamesFromText, getNames, getCount, shuffle, remove, assignToSlots } from './names.js';

beforeEach(() => {
  setNamesFromText('Alice\nBob\nCarol');
});

// ── setNamesFromText ──────────────────────────────────────────────────────────

test('parses names separated by newlines', () => {
  assert.deepEqual(getNames(), ['Alice', 'Bob', 'Carol']);
});

test('trims whitespace from each name', () => {
  setNamesFromText('  Alice  \n  Bob\n Carol  ');
  assert.deepEqual(getNames(), ['Alice', 'Bob', 'Carol']);
});

test('filters out blank lines', () => {
  setNamesFromText('Alice\n\nBob\n\n');
  assert.deepEqual(getNames(), ['Alice', 'Bob']);
});

test('results in empty list for blank input', () => {
  setNamesFromText('');
  assert.deepEqual(getNames(), []);
});

// ── getCount ──────────────────────────────────────────────────────────────────

test('getCount returns the number of names', () => {
  assert.equal(getCount(), 3);
});

test('getCount returns 0 after clearing', () => {
  setNamesFromText('');
  assert.equal(getCount(), 0);
});

// ── remove ────────────────────────────────────────────────────────────────────

test('remove drops the named entry', () => {
  remove('Bob');
  assert.deepEqual(getNames(), ['Alice', 'Carol']);
});

test('remove only deletes first occurrence of a duplicate', () => {
  setNamesFromText('Alice\nAlice\nBob');
  remove('Alice');
  assert.deepEqual(getNames(), ['Alice', 'Bob']);
});

test('remove is a no-op for a name not in the list', () => {
  remove('Nobody');
  assert.deepEqual(getNames(), ['Alice', 'Bob', 'Carol']);
});

test('getCount decrements after remove', () => {
  remove('Alice');
  assert.equal(getCount(), 2);
});

// ── getNames returns a copy ───────────────────────────────────────────────────

test('getNames returns a copy, not a reference', () => {
  const copy = getNames();
  copy.push('Extra');
  assert.equal(getCount(), 3);
});

// ── shuffle ───────────────────────────────────────────────────────────────────

test('shuffle keeps the same names', () => {
  shuffle();
  assert.deepEqual(getNames().sort(), ['Alice', 'Bob', 'Carol']);
});

test('shuffle keeps the count the same', () => {
  shuffle();
  assert.equal(getCount(), 3);
});

// ── assignToSlots ─────────────────────────────────────────────────────────────

test('assignToSlots returns all names', () => {
  const slots = assignToSlots();
  assert.deepEqual(slots.sort(), ['Alice', 'Bob', 'Carol']);
});

test('assignToSlots does not mutate the internal list', () => {
  const before = getNames();
  assignToSlots();
  assert.deepEqual(getNames(), before);
});

test('assignToSlots length matches name count', () => {
  assert.equal(assignToSlots().length, getCount());
});
