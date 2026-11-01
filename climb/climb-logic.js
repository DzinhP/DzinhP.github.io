(function (root) {
  'use strict';

  const totalSteps = 8;
  const maxEndurance = 100;
  const restRecovery = 35;
  const restDurationMs = 2000;
  const reach = 38;
  const mistakeCost = 12;
  const skipCost = 12;
  const drainRates = Object.freeze({ start: 2.1, jug: 1.15, crimp: 3, sloper: 3.9 });
  const columns = [18, 50, 82];

  function seededRandom(seed) {
    let value = seed;
    return () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let mixed = Math.imul(value ^ (value >>> 15), value | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateRoute(seed = Math.floor(Math.random() * 4294967296)) {
    if (!Number.isSafeInteger(seed)) throw new TypeError('A route seed must be a safe integer.');
    seed = seed >>> 0;
    const random = seededRandom(seed);
    const pick = count => Math.floor(random() * count);
    const holds = [];
    let column = pick(columns.length);

    for (let step = 0; step <= totalSteps; step++) {
      if (step > 0) column = column === 1 ? pick(2) * 2 : 1;
      const type = step === 0 ? 'start' : step === totalSteps ? 'finish' : step === 3 || step === 6 ? 'jug' : pick(2) === 0 ? 'crimp' : 'sloper';
      const cost = type === 'start' ? 0 : type === 'jug' ? 10 : type === 'finish' ? 14 + pick(3) : (type === 'crimp' ? 13 : 16) + pick(3);
      const id = step === 0 ? 'start' : step === totalSteps ? 'finish' : `hold-${step}`;
      const label = type === 'start' ? 'Starting hold' : type === 'finish' ? 'Coral finishing hold' : `Coral hold ${step}, ${type === 'jug' ? 'rest jug' : type}`;
      holds.push({ id, x: columns[column], y: 88 - step * 10, step, type, label, cost });
    }

    // Opposite-edge decoys stay clear of adjacent center holds even when 44px
    // touch targets occupy much of the narrowest mobile wall.
    const decoyRows = holds.filter(hold => hold.step > 0 && hold.step < totalSteps && hold.x !== 50);
    for (let index = decoyRows.length - 1; index > 0; index--) {
      const other = pick(index + 1);
      [decoyRows[index], decoyRows[other]] = [decoyRows[other], decoyRows[index]];
    }
    decoyRows.slice(0, 2 + pick(2)).forEach((row, index) => {
      const x = 100 - row.x;
      holds.push({ id: `mint-${index + 1}`, x, y: row.y, step: null, type: 'decoy', label: `Mint hold ${index + 1}, ${x < 50 ? 'left' : 'right'} side`, cost: 0 });
    });

    return Object.freeze({
      seed,
      code: seed.toString(36).toUpperCase().padStart(7, '0'),
      holds: Object.freeze(holds.map(Object.freeze)),
      totalSteps
    });
  }

  function initialState(route = generateRoute()) {
    return { route, phase: 'ready', current: 'start', selected: null, moves: 0, visited: ['start'], endurance: maxEndurance, rested: [], mistakes: 0, elapsedMs: 0, restRemainingMs: 0, pausedFrom: null };
  }

  function start(route) {
    return { ...initialState(route), phase: 'climbing' };
  }

  function findHold(state, id) {
    return state.route.holds.find(hold => hold.id === id);
  }

  function drainRate(state) {
    return state.phase === 'climbing' ? drainRates[findHold(state, state.current)?.type] || 0 : 0;
  }

  function advance(state, elapsedMs) {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || (state.phase !== 'climbing' && state.phase !== 'resting')) {
      return { state, outcome: 'inactive' };
    }
    let next = state;
    let remainingMs = elapsedMs;
    let completedRest = false;

    if (next.phase === 'resting') {
      const restingMs = Math.min(remainingMs, next.restRemainingMs);
      const restRemainingMs = next.restRemainingMs - restingMs;
      next = {
        ...next,
        endurance: Math.min(maxEndurance, next.endurance + restRecovery * restingMs / restDurationMs),
        elapsedMs: next.elapsedMs + restingMs,
        restRemainingMs,
        phase: restRemainingMs === 0 ? 'climbing' : 'resting'
      };
      remainingMs -= restingMs;
      completedRest = restRemainingMs === 0;
    }

    if (remainingMs > 0 && next.phase === 'climbing') {
      const perMs = drainRate(next) / 1000;
      const untilFallMs = perMs > 0 ? next.endurance / perMs : Infinity;
      const activeMs = Math.min(remainingMs, untilFallMs);
      // This tiny energy tolerance keeps an exact boundary consistent when a
      // browser delivers many fractional frames instead of one large tick.
      const fallen = remainingMs >= untilFallMs || next.endurance - remainingMs * perMs <= 1e-10;
      next = {
        ...next,
        endurance: fallen ? 0 : next.endurance - activeMs * perMs,
        elapsedMs: next.elapsedMs + activeMs,
        phase: fallen ? 'fallen' : 'climbing'
      };
      if (fallen) return { state: next, outcome: 'fell' };
    }

    return { state: next, outcome: completedRest ? 'rest-complete' : 'ticked' };
  }

  function pause(state) {
    if (state.phase !== 'climbing' && state.phase !== 'resting') return state;
    return { ...state, phase: 'paused', pausedFrom: state.phase };
  }

  function resume(state) {
    if (state.phase !== 'paused' || (state.pausedFrom !== 'climbing' && state.pausedFrom !== 'resting')) return state;
    return { ...state, phase: state.pausedFrom, pausedFrom: null };
  }

  function select(state, id) {
    if (state.phase !== 'climbing' || !findHold(state, id) || id === state.current || id === state.selected) return state;
    return { ...state, selected: id };
  }

  function selectDirection(state, direction) {
    if (state.phase !== 'climbing') return state;
    const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const vector = vectors[direction];
    if (!vector) return state;
    const origin = findHold(state, state.selected || state.current);
    const candidates = state.route.holds.filter(hold => !state.visited.includes(hold.id) && hold.id !== origin.id).map(hold => {
      const dx = hold.x - origin.x;
      const dy = hold.y - origin.y;
      const forward = dx * vector[0] + dy * vector[1];
      const sideways = Math.abs(dx * vector[1] - dy * vector[0]);
      return { hold, forward, score: Math.hypot(dx, dy) + sideways * .35 };
    }).filter(item => item.forward > 3).sort((a, b) => a.score - b.score || a.hold.id.localeCompare(b.hold.id));
    return candidates.length ? select(state, candidates[0].hold.id) : state;
  }

  function previewMove(state) {
    const next = findHold(state, state.selected);
    if (state.phase !== 'climbing' || !next) return { valid: false, cost: 0, reason: null };
    if (next.step === null) return { valid: false, cost: mistakeCost, reason: 'off-route' };
    if (state.visited.includes(next.id)) return { valid: false, cost: 0, reason: 'visited' };
    const current = findHold(state, state.current);
    if (next.step <= current.step || Math.hypot(next.x - current.x, next.y - current.y) > reach) {
      return { valid: false, cost: mistakeCost, reason: 'out-of-reach' };
    }
    return { valid: true, cost: next.cost + (next.step - current.step - 1) * skipCost, reason: null };
  }

  function move(state) {
    if (state.phase !== 'climbing') return { state, outcome: 'inactive' };
    const next = findHold(state, state.selected);
    if (!next) return { state, outcome: 'unselected' };
    const preview = previewMove(state);
    if (!preview.valid) {
      if (!preview.cost) return { state, outcome: preview.reason };
      const endurance = Math.max(0, state.endurance - preview.cost);
      return {
        state: { ...state, endurance, mistakes: state.mistakes + 1, phase: endurance === 0 ? 'fallen' : 'climbing' },
        outcome: endurance === 0 ? 'fell' : preview.reason
      };
    }

    const endurance = Math.max(0, state.endurance - preview.cost);
    const won = next.step === state.route.totalSteps;
    if (preview.cost > state.endurance || (endurance === 0 && !won)) {
      return { state: { ...state, endurance: 0, phase: 'fallen' }, outcome: 'fell' };
    }
    return {
      state: { ...state, phase: won ? 'complete' : 'climbing', current: next.id, selected: null, moves: state.moves + 1, visited: [...state.visited, next.id], endurance },
      outcome: won ? 'complete' : 'moved'
    };
  }

  function canRest(state) {
    return state.phase === 'climbing' && state.endurance > 0 && findHold(state, state.current)?.type === 'jug' && !state.rested.includes(state.current);
  }

  function rest(state) {
    if (state.phase !== 'climbing' || state.endurance <= 0) return { state, outcome: 'inactive' };
    if (findHold(state, state.current)?.type !== 'jug') return { state, outcome: 'not-restable' };
    if (state.rested.includes(state.current)) return { state, outcome: 'already-rested' };
    return {
      state: { ...state, phase: 'resting', restRemainingMs: restDurationMs, rested: [...state.rested, state.current] },
      outcome: 'resting'
    };
  }

  const api = Object.freeze({ generateRoute, initialState, start, select, selectDirection, previewMove, move, rest, canRest, advance, drainRate, pause, resume, maxEndurance, restRecovery, restDurationMs, reach, mistakeCost, skipCost });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BasecampClimb = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
