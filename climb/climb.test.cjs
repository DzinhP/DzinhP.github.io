const assert = require('node:assert/strict');
const { test } = require('node:test');
const game = require('./climb-logic.js');

const coralHolds = route => route.holds.filter(hold => hold.step !== null).sort((a, b) => a.step - b.step);
const commit = (state, id) => game.move(game.select(state, id));
const finishRest = state => game.advance(game.rest(state).state, game.restDurationMs).state;
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, message || `${actual} should be approximately ${expected}`);

function reachStep(route, step, useRests = true) {
  let state = game.start(route);
  for (const hold of coralHolds(route).slice(1, step + 1)) {
    state = commit(state, hold.id).state;
    if (useRests && game.canRest(state)) state = finishRest(state);
  }
  return state;
}

function keyboardPath(state, targetId) {
  const queue = [{ state, keys: [] }];
  const seen = new Set([state.selected]);
  for (let head = 0; head < queue.length; head++) {
    const entry = queue[head];
    for (const direction of ['up', 'right', 'down', 'left']) {
      const selected = game.selectDirection(entry.state, direction);
      const keys = [...entry.keys, direction];
      if (selected.selected === targetId) return { state: selected, keys };
      if (!seen.has(selected.selected)) {
        seen.add(selected.selected);
        queue.push({ state: selected, keys });
      }
    }
  }
  return null;
}

test('route seeds are deterministic, varied, canonical, and deeply frozen', () => {
  const signatures = new Set();
  const geometries = new Set();
  for (let seed = 0; seed < 300; seed++) {
    const route = game.generateRoute(seed);
    assert.deepEqual(route, game.generateRoute(seed));
    assert.equal(route.seed, seed);
    assert.equal(parseInt(route.code, 36), seed);
    assert.ok(Object.isFrozen(route));
    assert.ok(Object.isFrozen(route.holds));
    assert.ok(route.holds.every(Object.isFrozen));
    signatures.add(JSON.stringify(route.holds));
    geometries.add(coralHolds(route).map(hold => hold.x).join(','));
  }
  assert.ok(signatures.size > 290, `Only ${signatures.size} distinct routes`);
  assert.ok(geometries.size > 30, `Only ${geometries.size} distinct wall paths`);
  assert.deepEqual(game.generateRoute(-1), game.generateRoute(4294967295));
  assert.deepEqual(game.generateRoute(4294967296), game.generateRoute(0));
  assert.throws(() => game.generateRoute('42'), TypeError);
  assert.throws(() => game.generateRoute(1.5), TypeError);
  assert.throws(() => game.generateRoute(NaN), TypeError);
});

test('1000 generated routes remain solvable with one-second decisions, timed rests, and clear mobile targets', () => {
  const seeds = [...Array.from({ length: 1000 }, (_, index) => index), 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff];
  for (const seed of seeds) {
    const route = game.generateRoute(seed);
    const holds = coralHolds(route);
    assert.equal(route.totalSteps, 8);
    assert.equal(holds.length, 9);
    assert.equal(new Set(route.holds.map(hold => hold.id)).size, route.holds.length);
    assert.deepEqual(holds.filter(hold => hold.type === 'jug').map(hold => hold.step), [3, 6]);
    assert.ok(route.holds.filter(hold => hold.type === 'decoy').length >= 2);
    let state = game.start(route);
    for (const hold of holds.slice(1)) {
      state = game.advance(state, 1000).state;
      const current = route.holds.find(item => item.id === state.current);
      assert.notEqual(current.x, hold.x);
      assert.ok(Math.hypot(hold.x - current.x, hold.y - current.y) <= game.reach, `Unreachable seed ${seed}, hold ${hold.step}`);
      assert.deepEqual(game.previewMove(game.select(state, hold.id)), { valid: true, cost: hold.cost, reason: null });
      const result = commit(state, hold.id);
      assert.equal(result.outcome, hold.step === 8 ? 'complete' : 'moved', `Unsolvable seed ${seed}, hold ${hold.step}`);
      state = result.state;
      if (game.canRest(state)) state = finishRest(state);
      assert.ok(state.endurance >= 0 && state.endurance <= 100);
    }
    assert.equal(state.phase, 'complete');
    assert.equal(state.moves, 8);
    assert.equal(state.rested.length, 2);
    assert.equal(state.elapsedMs, 12000);
    for (let a = 0; a < route.holds.length; a++) {
      for (let b = a + 1; b < route.holds.length; b++) {
        const dx = Math.abs(route.holds[a].x - route.holds[b].x) * 2.56;
        const dy = Math.abs(route.holds[a].y - route.holds[b].y) * 3.52;
        assert.ok(dx >= 44 || dy >= 44, `Overlapping mobile targets on seed ${seed}: ${route.holds[a].id}, ${route.holds[b].id}`);
      }
    }
  }
});

test('the ready state has no active controls or passive endurance loss', () => {
  const state = game.initialState(game.generateRoute(42));
  assert.equal(state.phase, 'ready');
  assert.equal(state.endurance, 100);
  assert.equal(game.select(state, 'hold-1'), state);
  assert.equal(game.selectDirection(state, 'up'), state);
  assert.equal(game.move(state).outcome, 'inactive');
  assert.equal(game.rest(state).outcome, 'inactive');
  assert.equal(game.canRest(state), false);
  assert.deepEqual(game.previewMove(state), { valid: false, cost: 0, reason: null });
  const climbing = game.start(state.route);
  assert.equal(game.move(climbing).outcome, 'unselected');
  assert.equal(game.select(climbing, 'unknown'), climbing);
  assert.equal(game.selectDirection(climbing, 'diagonal'), climbing);
});

test('rests recover 35 gradually over two seconds, block actions, preserve selection, and cap at 100', () => {
  const route = game.generateRoute(12);
  assert.equal(game.rest(game.start(route)).outcome, 'not-restable');
  const atJug = reachStep(route, 3, false);
  const selected = game.select(atJug, 'hold-4');
  assert.equal(game.canRest(selected), true);
  const result = game.rest(selected);
  assert.equal(result.outcome, 'resting');
  assert.equal(result.state.endurance, selected.endurance);
  assert.equal(result.state.restRemainingMs, 2000);
  assert.equal(result.state.selected, 'hold-4');
  assert.deepEqual(result.state.rested, ['hold-3']);
  assert.deepEqual(atJug.rested, []);
  assert.equal(game.canRest(result.state), false);
  assert.equal(game.rest(result.state).outcome, 'inactive');
  assert.equal(game.rest(result.state).state, result.state);
  assert.equal(game.select(result.state, 'hold-5'), result.state);
  assert.equal(game.selectDirection(result.state, 'up'), result.state);
  assert.equal(game.move(result.state).outcome, 'inactive');
  assert.equal(game.drainRate(result.state), 0);
  const halfway = game.advance(result.state, 1000);
  assert.equal(halfway.outcome, 'ticked');
  assert.equal(halfway.state.phase, 'resting');
  assert.equal(halfway.state.restRemainingMs, 1000);
  assert.equal(halfway.state.endurance, selected.endurance + 17.5);
  const finished = game.advance(halfway.state, 1000);
  assert.equal(finished.outcome, 'rest-complete');
  assert.equal(finished.state.phase, 'climbing');
  assert.equal(finished.state.endurance, selected.endurance + 35);
  assert.equal(finished.state.restRemainingMs, 0);
  assert.equal(finished.state.elapsedMs, 2000);
  assert.equal(game.rest(finished.state).outcome, 'already-rested');
  assert.equal(game.canRest(finished.state), false);
  assert.equal(finishRest({ ...atJug, endurance: 90 }).endurance, 100);
});

test('reachable shortcuts charge the destination cost plus 12 per skipped hold', () => {
  let shortcuts = 0;
  for (let seed = 0; seed < 100; seed++) {
    const route = game.generateRoute(seed);
    const holds = coralHolds(route);
    for (let step = 0; step < 7; step++) {
      const current = holds[step];
      const next = holds[step + 2];
      if (Math.hypot(next.x - current.x, next.y - current.y) > game.reach) continue;
      shortcuts++;
      const state = reachStep(route, step);
      const selected = game.select(state, next.id);
      const preview = game.previewMove(selected);
      assert.deepEqual(preview, { valid: true, cost: next.cost + 12, reason: null });
      if (state.endurance > preview.cost) {
        const result = game.move(selected);
        assert.equal(result.state.current, next.id);
        assert.equal(result.state.endurance, state.endurance - preview.cost);
        assert.equal(result.state.moves, state.moves + 1);
        assert.equal(result.state.visited.includes(holds[step + 1].id), false);
      }
    }
  }
  assert.ok(shortcuts > 300);
});

test('off-route and unreachable attempts cost endurance each time and eventually cause a fall', () => {
  const route = game.generateRoute(92);
  const decoy = route.holds.find(hold => hold.type === 'decoy');
  const initial = game.start(route);
  const snapshot = JSON.stringify(initial);
  for (const [id, reason] of [[decoy.id, 'off-route'], ['finish', 'out-of-reach']]) {
    let state = game.select(initial, id);
    assert.deepEqual(game.previewMove(state), { valid: false, cost: 12, reason });
    for (let attempt = 1; attempt <= 9; attempt++) {
      const result = game.move(state);
      state = result.state;
      assert.equal(result.outcome, attempt === 9 ? 'fell' : reason);
      assert.equal(state.endurance, Math.max(0, 100 - 12 * attempt));
      assert.equal(state.mistakes, attempt);
      assert.equal(state.current, 'start');
      assert.equal(state.moves, 0);
      assert.deepEqual(state.visited, ['start']);
    }
    assert.equal(state.phase, 'fallen');
    assert.equal(game.move(state).state, state);
    assert.equal(game.rest(state).state, state);
    assert.equal(game.select(state, 'hold-1'), state);
    assert.equal(game.selectDirection(state, 'up'), state);
  }
  assert.equal(JSON.stringify(initial), snapshot);
});

test('visited holds do not advance or charge and skipped lower holds are unreachable', () => {
  const route = game.generateRoute(23);
  const afterMove = commit(game.start(route), 'hold-1').state;
  const selected = game.select(afterMove, 'start');
  assert.deepEqual(game.previewMove(selected), { valid: false, cost: 0, reason: 'visited' });
  assert.equal(game.move(selected).outcome, 'visited');
  assert.equal(game.move(selected).state, selected);
  const higher = { ...afterMove, current: 'hold-3', visited: ['start', 'hold-3'], selected: 'hold-2' };
  assert.deepEqual(game.previewMove(higher), { valid: false, cost: 12, reason: 'out-of-reach' });
});

test('zero endurance falls before summit, succeeds exactly at summit, and never permits an underfunded finish', () => {
  const route = game.generateRoute(31);
  const first = route.holds.find(hold => hold.step === 1);
  const fall = game.move(game.select({ ...game.start(route), endurance: first.cost }, first.id));
  assert.equal(fall.outcome, 'fell');
  assert.equal(fall.state.phase, 'fallen');
  assert.equal(fall.state.current, 'start');
  assert.equal(fall.state.endurance, 0);
  const finish = route.holds.find(hold => hold.type === 'finish');
  const nearTop = reachStep(route, 7);
  const exact = game.select({ ...nearTop, endurance: finish.cost }, finish.id);
  const win = game.move(exact);
  assert.equal(win.outcome, 'complete');
  assert.equal(win.state.current, 'finish');
  assert.equal(win.state.endurance, 0);
  const short = game.move({ ...exact, endurance: finish.cost - 1 });
  assert.equal(short.outcome, 'fell');
  assert.equal(short.state.current, nearTop.current);
  assert.equal(short.state.endurance, 0);
  assert.equal(game.move(win.state).outcome, 'inactive');
  assert.equal(game.rest(win.state).outcome, 'inactive');
});

test('all sequential holds can be selected with directional keys across 250 seeds', () => {
  for (let seed = 0; seed < 250; seed++) {
    const route = game.generateRoute(seed);
    let state = game.start(route);
    for (const target of coralHolds(route).slice(1)) {
      const path = keyboardPath(state, target.id);
      assert.ok(path, `Keyboard cannot reach ${target.id} on seed ${seed}`);
      assert.ok(path.keys.length <= route.holds.length);
      assert.equal(path.state.endurance, state.endurance);
      const result = game.move(path.state);
      assert.equal(result.outcome, target.type === 'finish' ? 'complete' : 'moved');
      state = result.state;
      if (game.canRest(state)) state = finishRest(state);
    }
    assert.equal(state.phase, 'complete');
  }
});

test('same-route retry resets progress without changing the wall or mutating prior state', () => {
  const route = game.generateRoute(456789);
  const completed = reachStep(route, 8);
  const snapshot = JSON.stringify(completed);
  const retry = game.start(completed.route);
  assert.equal(retry.route, route);
  assert.equal(retry.route.code, completed.route.code);
  assert.equal(retry.phase, 'climbing');
  assert.equal(retry.current, 'start');
  assert.equal(retry.selected, null);
  assert.equal(retry.endurance, 100);
  assert.equal(retry.moves, 0);
  assert.equal(retry.mistakes, 0);
  assert.equal(retry.elapsedMs, 0);
  assert.equal(retry.restRemainingMs, 0);
  assert.equal(retry.pausedFrom, null);
  assert.deepEqual(retry.visited, ['start']);
  assert.deepEqual(retry.rested, []);
  assert.equal(JSON.stringify(completed), snapshot);
  retry.visited.push('hold-1');
  retry.rested.push('hold-3');
  assert.deepEqual(game.start(route).visited, ['start']);
  assert.deepEqual(game.start(route).rested, []);
  assert.notDeepEqual(game.generateRoute(route.seed + 1).holds, route.holds);
});

test('drain rates depend on the current hold and a slow attempt falls at the exact exhaustion moment', () => {
  const route = game.generateRoute(31);
  const start = game.start(route);
  assert.equal(game.drainRate(start), 1.8);
  const activeSecond = game.advance(start, 1000);
  assert.equal(activeSecond.outcome, 'ticked');
  near(activeSecond.state.endurance, 98.2);
  assert.equal(activeSecond.state.elapsedMs, 1000);
  assert.equal(start.endurance, 100);
  assert.equal(start.elapsedMs, 0);
  const expired = game.advance(start, 120000);
  assert.equal(expired.outcome, 'fell');
  assert.equal(expired.state.phase, 'fallen');
  assert.equal(expired.state.endurance, 0);
  near(expired.state.elapsedMs, 100 / 1.8 * 1000);
  assert.equal(game.advance(expired.state, 120000).state, expired.state);
  for (const [type, rate] of [['jug', 1], ['crimp', 2.6], ['sloper', 3.4]]) {
    const hold = route.holds.find(item => item.type === type);
    assert.ok(hold, `${type} fixture hold is present`);
    const held = { ...start, current: hold.id };
    assert.equal(game.drainRate(held), rate);
    near(game.advance(held, 250.5).state.endurance, 100 - rate * .2505);
  }
  for (const phase of ['ready', 'paused', 'resting', 'fallen', 'complete']) assert.equal(game.drainRate({ ...start, phase }), 0);
});

test('one long tick and many short ticks agree while climbing, crossing rest boundaries, and falling', () => {
  const route = game.generateRoute(72);
  const atJug = reachStep(route, 3, false);
  const fixtures = [game.start(route), game.rest(atJug).state, { ...game.start(route), endurance: 6 }, { ...game.rest(atJug).state, endurance: .1 }];
  for (const state of fixtures) {
    const single = game.advance(state, 10000).state;
    let sliced = state;
    for (let slice = 0; slice < 100; slice++) sliced = game.advance(sliced, 100).state;
    assert.equal(sliced.phase, single.phase);
    near(sliced.endurance, single.endurance);
    near(sliced.elapsedMs, single.elapsedMs);
    near(sliced.restRemainingMs, single.restRemainingMs);
    assert.deepEqual(sliced.rested, single.rested);
    assert.equal(sliced.current, single.current);
  }
});

test('rest boundary leftovers drain immediately and huge ticks never add elapsed time past a fall', () => {
  const atJug = reachStep(game.generateRoute(65), 3, false);
  const resting = game.rest(atJug).state;
  const crossing = game.advance(resting, 2500);
  assert.equal(crossing.outcome, 'rest-complete');
  assert.equal(crossing.state.phase, 'climbing');
  assert.equal(crossing.state.restRemainingMs, 0);
  near(crossing.state.endurance, atJug.endurance + 35 - .5);
  assert.equal(crossing.state.elapsedMs, 2500);
  const huge = game.advance(resting, Number.MAX_VALUE);
  assert.equal(huge.outcome, 'fell');
  assert.equal(huge.state.endurance, 0);
  near(huge.state.elapsedMs, 2000 + (atJug.endurance + 35) * 1000);
  assert.equal(Number.isFinite(huge.state.elapsedMs), true);
  const fractional = game.advance(resting, 1999.75).state;
  near(fractional.restRemainingMs, .25);
  const lastFraction = game.advance(fractional, .5);
  assert.equal(lastFraction.outcome, 'rest-complete');
  near(lastFraction.state.endurance, atJug.endurance + 35 - .00025);
  near(lastFraction.state.elapsedMs, 2000.25);
});

test('pausing preserves elapsed time, rest progress, and energy without grants or hidden drain', () => {
  const route = game.generateRoute(48);
  const halfwayRest = game.advance(game.rest(reachStep(route, 3, false)).state, 500).state;
  for (const active of [game.advance(game.start(route), 1240.75).state, halfwayRest]) {
    const original = JSON.stringify(active);
    const paused = game.pause(active);
    assert.equal(paused.phase, 'paused');
    assert.equal(paused.pausedFrom, active.phase);
    assert.equal(paused.endurance, active.endurance);
    assert.equal(paused.restRemainingMs, active.restRemainingMs);
    assert.equal(game.advance(paused, 600000).state, paused);
    assert.equal(game.move(paused).state, paused);
    assert.equal(game.rest(paused).state, paused);
    assert.equal(game.select(paused, 'hold-7'), paused);
    assert.equal(game.pause(paused), paused);
    const resumed = game.resume(paused);
    assert.equal(resumed.phase, active.phase);
    assert.equal(resumed.pausedFrom, null);
    assert.equal(game.resume(resumed), resumed);
    assert.deepEqual(resumed, active);
    assert.equal(JSON.stringify(active), original);
    const uninterrupted = game.advance(active, 2000);
    const continued = game.advance(resumed, 2000);
    assert.deepEqual(continued, uninterrupted);
  }
  for (const phase of ['ready', 'fallen', 'complete']) {
    const state = { ...game.initialState(route), phase };
    assert.equal(game.pause(state), state);
    assert.equal(game.resume(state), state);
  }
});

test('invalid time inputs are harmless and zero-time rest spam cannot recover endurance', () => {
  const route = game.generateRoute(57);
  const resting = game.rest(reachStep(route, 3, false)).state;
  for (const state of [game.start(route), resting, game.pause(resting), game.initialState(route)]) {
    for (const invalid of [NaN, Infinity, -Infinity, -1000, -Number.MIN_VALUE, 0, -0, '1000', null, undefined, {}, []]) {
      const result = game.advance(state, invalid);
      assert.equal(result.state, state);
      assert.equal(result.outcome, 'inactive');
    }
    assert.ok(Number.isFinite(state.endurance));
    assert.ok(Number.isFinite(state.elapsedMs));
    assert.ok(Number.isFinite(state.restRemainingMs));
  }
  let repeated = resting;
  for (let attempt = 0; attempt < 30; attempt++) {
    repeated = game.resume(game.pause(game.rest(repeated).state));
    repeated = game.advance(repeated, 0).state;
  }
  assert.deepEqual(repeated, resting);
});
