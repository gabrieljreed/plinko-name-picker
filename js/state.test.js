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
  assert.equal(state.entrants.filter((entrant) => entrant.label === 'Alice').length, 1);
  assert.ok(state.entrants.every((entrant) => entrant.id !== winnerId));
});

test('cancelPendingWinner clears the pending winner without removing entrants', () => {
  let state = createInitialState();
  state = setEntrantsFromText(state, 'Alice\nBob');
  state = beginRound(state, () => [1, 0]);
  state = markPendingWinner(state, state.slotOrder[0]);
  state = cancelPendingWinner(state);

  assert.equal(state.pendingWinnerId, null);
  assert.deepEqual(state.entrants.map((entrant) => entrant.label), ['Alice', 'Bob']);
});

test('restartRound restores the original entrant set from the first drop', () => {
  let state = createInitialState();
  state = setEntrantsFromText(state, 'Alice\nBob');
  state = beginRound(state, () => [1, 0]);
  state = markPendingWinner(state, state.slotOrder[0]);
  state = confirmPendingWinner(state);
  state = restartRound(state);

  assert.deepEqual(state.entrants.map((entrant) => entrant.label), ['Alice', 'Bob']);
  assert.equal(state.pendingWinnerId, null);
});
