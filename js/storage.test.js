import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadAppSnapshot, saveAppSnapshot } from './storage.js';

test('loadAppSnapshot returns default settings when keys are missing', () => {
  const store = new Map();
  const snapshot = loadAppSnapshot({
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
  });

  assert.equal(snapshot.namesText, '');
  assert.equal(snapshot.settings.bumperPads, true);
  assert.equal(snapshot.settings.ballSize, 30);
});

test('saveAppSnapshot persists textarea text and settings in one place', () => {
  const writes = new Map();

  saveAppSnapshot({
    setItem(key, value) {
      writes.set(key, value);
    },
  }, {
    namesText: 'Alice\nBob',
    settings: {
      physicsMode: true,
      fullBoard: false,
      aimingMode: false,
      bumperPads: true,
      slidingBumper: false,
      ballSize: 24,
    },
  });

  assert.equal(writes.get('plinko-names'), 'Alice\nBob');
  assert.equal(writes.get('plinko-physics-mode'), 'true');
  assert.equal(writes.get('plinko-ball-size'), '24');
});
