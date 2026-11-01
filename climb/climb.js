(() => {
  'use strict';
  const game = window.BasecampClimb;
  const stage = document.querySelector('#climb-stage');
  if (!game || !stage) return;

  const find = id => document.getElementById(id);
  const status = find('climb-status');
  const holdContainer = find('climb-holds');
  const figure = find('mini-climber');
  const trail = find('climb-trail');
  const celebration = find('climb-celebration');
  const boardAction = find('climb-board-action');
  const restButton = find('climb-rest');
  const directionButtons = [...document.querySelectorAll('[data-direction]')];
  let state = game.initialState();
  let holdButtons = [];
  let celebrationTimer;

  function currentHold() {
    return state.route.holds.find(hold => hold.id === state.current);
  }

  function clearCelebration() {
    clearTimeout(celebrationTimer);
    celebration.classList.remove('is-celebrating');
  }

  function buildWall() {
    holdContainer.replaceChildren();
    holdButtons = state.route.holds.map((hold, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `game-hold game-hold-${hold.step === null ? 'mint' : 'coral'} game-hold-${hold.type}`;
      button.style.setProperty('--hold-x', `${hold.x}%`);
      button.style.setProperty('--hold-y', `${hold.y}%`);
      button.style.setProperty('--hold-angle', `${[-14, 12, -8, 18, -20, 7][index % 6]}deg`);
      button.setAttribute('aria-label', hold.label);
      button.setAttribute('aria-pressed', 'false');
      button.dataset.hold = hold.id;
      button.tabIndex = -1;
      const shape = document.createElement('span');
      shape.className = 'game-hold-shape';
      shape.setAttribute('aria-hidden', 'true');
      shape.textContent = { start: '↑', jug: 'J', crimp: 'C', sloper: 'S', finish: '↗', decoy: '×' }[hold.type];
      button.append(shape);
      button.addEventListener('click', () => {
        state = game.select(state, hold.id);
        render();
        announceSelection();
        stage.focus({ preventScroll: true });
      });
      holdContainer.append(button);
      return button;
    });
    const finish = state.route.holds.find(hold => hold.type === 'finish');
    celebration.style.setProperty('--summit-x', `${finish.x}%`);
    celebration.style.setProperty('--summit-y', `${finish.y}%`);
    document.querySelector('.wall-finish-label').style.left = finish.x === 18 ? '64%' : '7%';
    find('climb-route-code').textContent = `#${state.route.code}`;
    find('climb-route-name').textContent = `The coral route / ${state.route.code}`;
  }

  function announceSelection() {
    const hold = state.route.holds.find(item => item.id === state.selected);
    if (!hold) return;
    const preview = game.previewMove(state);
    if (preview.reason === 'off-route') {
      status.textContent = 'Mint is off-route. Attempting this hold costs 8 endurance without advancing.';
    } else if (preview.reason === 'out-of-reach') {
      status.textContent = 'That hold is beyond your reach. An attempt costs 8 endurance. Try a closer coral hold above you.';
    } else if (preview.reason === 'visited') {
      status.textContent = 'You’ve been there already. Choose a coral hold above you.';
    } else {
      const next = hold.type === 'jug' ? ' You can rest there once.' : '';
      status.textContent = preview.cost >= state.endurance && !(hold.type === 'finish' && preview.cost === state.endurance)
        ? `${hold.label}. Costs ${preview.cost}, but you have ${state.endurance}. This move will use up your grip; look for a cheaper move or rest on a jug.`
        : `${hold.label}. Costs ${preview.cost} endurance.${next} Space or Enter to move.`;
    }
  }

  function render() {
    const current = currentHold();
    const active = state.phase === 'climbing';
    const complete = state.phase === 'complete';
    const fallen = state.phase === 'fallen';
    const selected = state.route.holds.find(hold => hold.id === state.selected);
    const preview = game.previewMove(state);
    const progress = Math.round(current.step / state.route.totalSteps * 100);
    figure.style.left = `${current.x}%`;
    figure.style.top = `${fallen ? 88 : current.y}%`;
    trail.setAttribute('points', state.visited.map(id => {
      const hold = state.route.holds.find(item => item.id === id);
      return `${hold.x},${hold.y}`;
    }).join(' '));
    holdButtons.forEach(button => {
      const id = button.dataset.hold;
      button.classList.toggle('is-selected', id === state.selected);
      button.classList.toggle('is-current', id === state.current);
      button.classList.toggle('is-visited', state.visited.includes(id));
      button.classList.toggle('is-rested', state.rested.includes(id));
      button.setAttribute('aria-pressed', String(id === state.selected));
      button.disabled = !active || id === state.current;
    });
    stage.classList.toggle('is-complete', complete);
    stage.classList.toggle('is-fallen', fallen);
    find('climb-progress-label').textContent = `${progress}% of the wall`;
    find('climb-progress-fill').style.width = `${progress}%`;
    find('climb-phase').textContent = complete ? 'Topped out!' : fallen ? 'Back on the mat' : active ? 'On the wall' : 'At the start';
    find('climb-stat-moves').textContent = state.moves;
    find('climb-stat-mistakes').textContent = state.mistakes;
    find('climb-stat-rests').textContent = `${state.rested.length} / 2`;
    find('climb-endurance-value').textContent = `${state.endurance}%`;
    find('climb-endurance-fill').style.width = `${state.endurance}%`;
    find('climb-endurance-meter').setAttribute('aria-valuenow', state.endurance);
    find('climb-endurance-note').textContent = fallen ? 'Grip gone' : complete ? 'Sent!' : state.endurance <= 25 ? 'Running on fumes' : state.endurance <= 50 ? 'Getting pumped' : 'Fresh arms';
    find('climb-endurance').classList.toggle('is-low', state.endurance <= 35);
    find('climb-endurance').classList.toggle('is-empty', state.endurance === 0);
    find('climb-board-selection').textContent = active ? selected ? selected.label : game.canRest(state) ? 'A good place to shake out' : 'Pick your next coral hold' : complete ? 'That’s a send.' : fallen ? 'Shake it off. Try again.' : 'Read the coral route';
    find('climb-move-cost').textContent = active && selected && preview.cost ? `−${preview.cost} grip` : '';
    boardAction.disabled = active && !selected;
    boardAction.innerHTML = `${active ? 'Make the move' : complete || fallen ? 'Try this route again' : 'Start climbing'} <span aria-hidden="true">↗</span>`;
    restButton.disabled = !game.canRest(state);
    restButton.textContent = state.rested.includes(state.current) ? 'Rest used' : 'Rest +45';
    restButton.title = game.canRest(state) ? 'Recover up to 45 endurance. One rest per jug.' : 'Rest once at each J hold.';
    directionButtons.forEach(button => { button.disabled = !active; });
    find('climb-result').hidden = !complete && !fallen;
    if (complete || fallen) {
      find('climb-result-kicker').textContent = complete ? state.mistakes ? 'Found your way' : 'Clean send' : 'The wall wins this one';
      find('climb-result-title').textContent = complete ? 'Topped out.' : 'Out of grip.';
      find('climb-result-summary').textContent = complete ? `${state.moves} moves · ${state.rested.length} rests · ${state.endurance}% left` : 'Try a different sequence. Save some strength for the top.';
    }
  }

  function showWall() {
    document.querySelector('.climb-wall-panel').scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start'
    });
  }

  function startClimb() {
    clearCelebration();
    state = game.start(state.route);
    render();
    status.textContent = 'You’re on. Pick a coral hold above you. Plan a stop at a J hold to recover.';
    stage.focus({ preventScroll: true });
    showWall();
  }

  function shuffleRoute() {
    clearCelebration();
    let route = game.generateRoute();
    if (route.seed === state.route.seed) route = game.generateRoute((route.seed + 1) >>> 0);
    state = game.initialState(route);
    buildWall();
    render();
    status.textContent = `New route ${route.code} is set. Read the holds, then start with a full grip.`;
    boardAction.focus({ preventScroll: true });
    showWall();
  }

  function chooseDirection(direction) {
    const previous = state.selected;
    state = game.selectDirection(state, direction);
    render();
    if (state.selected !== previous) announceSelection();
    else status.textContent = 'No more holds in that direction. Try another arrow or pick a hold on the wall.';
  }

  function finishAttempt(outcome) {
    if (outcome === 'complete') {
      celebration.classList.add('is-celebrating');
      celebrationTimer = setTimeout(() => celebration.classList.remove('is-celebrating'), 1800);
    }
    if (outcome === 'complete' || outcome === 'fell') boardAction.focus({ preventScroll: true });
  }

  function makeMove() {
    const result = game.move(state);
    state = result.state;
    render();
    const restHint = game.canRest(state) ? ' You’re on a jug. Press R or Rest +45 to shake out.' : '';
    const messages = {
      unselected: 'Choose a hold first. Use an arrow key on the wall or pick a hold.',
      'off-route': `Wrong route. −8 endurance; ${state.endurance} left. Follow the coral holds.`,
      visited: 'You’ve already climbed that hold. Choose a coral hold above you.',
      'out-of-reach': `Too far. −8 endurance; ${state.endurance} left. Look for a closer coral hold above you.`,
      moved: `Nice move. ${state.endurance} endurance left.${restHint}`,
      complete: `Topped out in ${state.moves} moves with ${state.endurance}% endurance left. Try a new sequence or shuffle the wall.`,
      fell: 'Out of grip! You’re back on the mat. Retry this route and use the J holds to recover.'
    };
    if (messages[result.outcome]) status.textContent = messages[result.outcome];
    finishAttempt(result.outcome);
  }

  function rest() {
    const before = state.endurance;
    const result = game.rest(state);
    state = result.state;
    render();
    if (result.outcome === 'rested') status.textContent = `Shake it out. +${state.endurance - before} endurance; ${state.endurance} left. This jug’s rest is used.`;
    else if (result.outcome === 'already-rested') status.textContent = 'You’ve used this rest. Find the next jug or move toward the finish.';
    else if (result.outcome === 'not-restable') status.textContent = 'Find a coral J hold to rest. Crimps and slopers need both hands on.';
  }

  boardAction.addEventListener('click', () => {
    if (state.phase === 'climbing') {
      makeMove();
      if (state.phase === 'climbing') stage.focus({ preventScroll: true });
    } else startClimb();
  });
  restButton.addEventListener('click', () => { rest(); stage.focus({ preventScroll: true }); });
  find('climb-reset').addEventListener('click', startClimb);
  find('climb-shuffle').addEventListener('click', shuffleRoute);
  directionButtons.forEach(button => button.addEventListener('click', () => {
    chooseDirection(button.dataset.direction);
    stage.focus({ preventScroll: true });
  }));
  stage.addEventListener('keydown', event => {
    if (state.phase !== 'climbing' || event.altKey || event.ctrlKey || event.metaKey) return;
    const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const handled = directions[event.key] || event.key === ' ' || event.key === 'Enter' || event.key.toLowerCase() === 'r';
    if (handled) event.preventDefault();
    if (event.repeat) return;
    if (directions[event.key]) {
      chooseDirection(directions[event.key]);
    } else if (event.key === ' ' || event.key === 'Enter') {
      makeMove();
    } else if (event.key.toLowerCase() === 'r') {
      rest();
    }
  });

  buildWall();
  render();
  stage.hidden = false;
  find('climb-controls').hidden = false;
  find('climb-board-toolbar').hidden = false;
  find('climb-endurance').hidden = false;
  find('climb-nojs').hidden = true;
})();
