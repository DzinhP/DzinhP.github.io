(function (root) {
  'use strict';

  const holds = Object.freeze([
    { id: 'start', x: 32, y: 83, step: 0, label: 'Starting hold' },
    { id: 'one', x: 48, y: 70, step: 1, label: 'Coral hold 1' },
    { id: 'two', x: 29, y: 57, step: 2, label: 'Coral hold 2' },
    { id: 'three', x: 47, y: 44, step: 3, label: 'Coral hold 3' },
    { id: 'four', x: 67, y: 34, step: 4, label: 'Coral hold 4' },
    { id: 'five', x: 50, y: 20, step: 5, label: 'Coral hold 5' },
    { id: 'finish', x: 66, y: 8, step: 6, label: 'Coral finishing hold' },
    { id: 'mint-one', x: 73, y: 76, step: null, label: 'Mint hold, lower right' },
    { id: 'mint-two', x: 15, y: 37, step: null, label: 'Mint hold, middle left' },
    { id: 'mint-three', x: 80, y: 54, step: null, label: 'Mint hold, middle right' },
    { id: 'mint-four', x: 26, y: 16, step: null, label: 'Mint hold, upper left' },
    { id: 'mint-five', x: 11, y: 75, step: null, label: 'Mint hold, lower left' }
  ].map(Object.freeze));
  const byId = new Map(holds.map(hold => [hold.id, hold]));
  const totalMoves = 6;
  const reach = 25;

  function initialState() {
    return { phase: 'ready', current: 'start', selected: null, moves: 0, visited: ['start'] };
  }

  function start() {
    return { ...initialState(), phase: 'climbing' };
  }

  function select(state, id) {
    if (state.phase !== 'climbing' || !byId.has(id) || id === state.current) return state;
    return { ...state, selected: id };
  }

  function selectDirection(state, direction) {
    if (state.phase !== 'climbing') return state;
    const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const vector = vectors[direction];
    if (!vector) return state;
    const origin = byId.get(state.selected || state.current);
    const candidates = holds.filter(hold => !state.visited.includes(hold.id) && hold.id !== origin.id).map(hold => {
      const dx = hold.x - origin.x;
      const dy = hold.y - origin.y;
      const forward = dx * vector[0] + dy * vector[1];
      const sideways = Math.abs(dx * vector[1] - dy * vector[0]);
      return { hold, forward, score: Math.hypot(dx, dy) + sideways * .35 };
    }).filter(item => item.forward > 3).sort((a, b) => a.score - b.score);
    return candidates.length ? select(state, candidates[0].hold.id) : state;
  }

  function move(state) {
    if (state.phase !== 'climbing') return { state, outcome: 'inactive' };
    const next = byId.get(state.selected);
    const current = byId.get(state.current);
    if (!next) return { state, outcome: 'unselected' };
    if (next.step === null) return { state, outcome: 'off-route' };
    if (state.visited.includes(next.id)) return { state, outcome: 'visited' };
    if (Math.hypot(next.x - current.x, next.y - current.y) > reach || next.step !== current.step + 1) {
      return { state, outcome: 'out-of-reach' };
    }
    const won = next.step === totalMoves;
    return {
      state: { phase: won ? 'complete' : 'climbing', current: next.id, selected: null, moves: state.moves + 1, visited: [...state.visited, next.id] },
      outcome: won ? 'complete' : 'moved'
    };
  }

  const api = Object.freeze({ holds, totalMoves, initialState, start, select, selectDirection, move });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BasecampClimb = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
