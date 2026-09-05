import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  parseSave,
  pickUp,
  deliver,
  purchase,
  costs,
  deliveries,
  canWalk,
  isLand,
  POST,
  DOCK,
  FAR_DOCK,
} from '../lib/game/state.ts';

test('complete all five deliveries exactly once and retain the completed save', () => {
  let state = initialState();
  for (let i = 0; i < 5; i++) {
    assert.equal(state.delivered, i);
    assert.equal(deliver(state), state);
    state = pickUp(state);
    assert.equal(pickUp(state), state);
    state = deliver(state);
    assert.equal(state.stamps, (i + 1) * 3);
    assert.equal(state.carrying, false);
  }
  assert.equal(pickUp(state), state);
  assert.equal(deliver(state), state);
  assert.deepEqual(parseSave(JSON.stringify(state)), state);
});
test('route improvements spend stamps once, never overdraw, and never mutate the previous state', () => {
  let state = initialState();
  assert.equal(purchase(state, 'bridge'), state);
  for (let i = 0; i < 5; i++) state = deliver(pickUp(state));
  for (const id of Object.keys(costs)) {
    const before = state;
    state = purchase(state, id);
    assert.equal(before.upgrades[id], false);
    assert.equal(state.upgrades[id], true);
    assert.equal(state.stamps, before.stamps - costs[id]);
    assert.equal(purchase(state, id), state);
  }
  assert.equal(state.stamps, 5);
});
test('bad, truncated and incompatible saves safely start a fresh round', () => {
  for (const value of [
    null,
    '',
    '{',
    'null',
    '[]',
    '{"version":2}',
    JSON.stringify({ ...initialState(), delivered: 9 }),
    JSON.stringify({ ...initialState(), stamps: -1 }),
    JSON.stringify({ ...initialState(), elapsed: 'forever' }),
    JSON.stringify({ ...initialState(), upgrades: {} }),
  ])
    assert.deepEqual(parseSave(value), initialState());
});
test('water and locked remote-island saves cannot strand the courier', () => {
  for (const [x, z] of [
    [60, 20],
    [80, -15],
    [6, 0],
    [999, 999],
  ]) {
    const s = parseSave(JSON.stringify({ ...initialState(), x, z }));
    assert.equal(s.x, -18);
    assert.equal(s.z, 17);
  }
  const unlocked = parseSave(
    JSON.stringify({ ...initialState(), delivered: 3, x: 80, z: -15 }),
  );
  assert.equal(unlocked.x, 80);
});
test('the bridge opens the creek, while the southern detour is always available', () => {
  const state = initialState();
  assert.equal(canWalk(6, 0, state), false);
  assert.equal(canWalk(6, 21, state), true);
  assert.equal(
    canWalk(6, 0, { ...state, upgrades: { ...state.upgrades, bridge: true } }),
    true,
  );
  assert.equal(
    canWalk(6, -12, {
      ...state,
      upgrades: { ...state.upgrades, bridge: true },
    }),
    false,
  );
});
test('clearing the woodland gate creates a real shortcut', () => {
  const state = initialState();
  assert.equal(canWalk(-20, -18, state), false);
  assert.equal(
    canWalk(-20, -18, {
      ...state,
      upgrades: { ...state.upgrades, shortcut: true },
    }),
    true,
  );
});
function reachable(start, target, state) {
  const queue = [[...start]],
    seen = new Set([start.join(',')]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    if (Math.hypot(x - target[0], z - target[1]) < 1.5) return true;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        key = `${nx},${nz}`;
      if (!seen.has(key) && canWalk(nx, nz, state)) {
        seen.add(key);
        queue.push([nx, nz]);
      }
    }
  }
  return false;
}
test('every home-island delivery and dock is reachable without spending any stamps', () => {
  const state = initialState();
  for (const target of [
    deliveries[0].position,
    deliveries[1].position,
    deliveries[2].position,
    deliveries[4].position,
    DOCK,
  ])
    assert.ok(reachable(POST, target, state), `No path to ${target.join(',')}`);
});
test('Gull landing connects to Pip and the sea endpoints are actually water', () => {
  assert.ok(reachable(FAR_DOCK, deliveries[3].position, initialState()));
  assert.equal(isLand(44, 9), false);
  assert.equal(isLand(59, -15), false);
  assert.equal(isLand(...DOCK), true);
  assert.equal(isLand(...FAR_DOCK), true);
});
