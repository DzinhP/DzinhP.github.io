const assert = require('node:assert/strict');
const { test } = require('node:test');
const game = require('./climb-logic.js');

test('the route starts only when explicitly started', () => {
  const state = game.initialState();
  assert.equal(state.phase, 'ready');
  assert.equal(game.select(state, 'one'), state);
  assert.equal(game.move(state).outcome, 'inactive');
});

test('every intended move is reachable and completing the route wins once', () => {
  let state = game.start();
  for (const id of ['one', 'two', 'three', 'four', 'five', 'finish']) {
    const result = game.move(game.select(state, id));
    assert.equal(result.outcome, id === 'finish' ? 'complete' : 'moved');
    state = result.state;
  }
  assert.equal(state.phase, 'complete');
  assert.equal(state.moves, 6);
  assert.deepEqual(state.visited, ['start', 'one', 'two', 'three', 'four', 'five', 'finish']);
  assert.equal(game.move(state).outcome, 'inactive');
});

test('mint holds, skipped holds, and already visited holds never advance progress', () => {
  const original = game.start();
  const offRoute = game.move(game.select(original, 'mint-five'));
  assert.equal(offRoute.outcome, 'off-route');
  assert.equal(offRoute.state.moves, 0);
  const tooFar = game.move(game.select(original, 'finish'));
  assert.equal(tooFar.outcome, 'out-of-reach');
  assert.equal(tooFar.state.current, 'start');
  const firstMove = game.move(game.select(original, 'one')).state;
  const backtrack = game.move(game.select(firstMove, 'start'));
  assert.equal(backtrack.outcome, 'visited');
  assert.equal(backtrack.state.moves, 1);
  assert.equal(game.move(original).outcome, 'unselected');
});

test('directional arrows can follow every turn of the coral route', () => {
  let state = game.start();
  for (const [direction, expected] of [['up', 'one'], ['left', 'two'], ['up', 'three'], ['right', 'four'], ['left', 'five'], ['up', 'finish']]) {
    state = game.selectDirection(state, direction);
    assert.equal(state.selected, expected);
    state = game.move(state).state;
  }
  assert.equal(state.phase, 'complete');
});

test('restarting clears selected holds, visited progress, and completion', () => {
  let state = game.start();
  for (const id of ['one', 'two', 'three', 'four', 'five', 'finish']) state = game.move(game.select(state, id)).state;
  const replay = game.start();
  assert.equal(replay.phase, 'climbing');
  assert.equal(replay.current, 'start');
  assert.equal(replay.moves, 0);
  assert.equal(replay.selected, null);
  assert.deepEqual(replay.visited, ['start']);
  replay.visited.push('one');
  assert.deepEqual(game.start().visited, ['start']);
});
