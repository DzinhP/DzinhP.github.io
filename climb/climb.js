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
  const pauseButton = find('climb-pause');
  const directionButtons = [...document.querySelectorAll('[data-direction]')];
  let state = game.initialState();
  let holdButtons = [];
  let celebrationTimer;
  let clockTimer = null;
  let lastTick = null;
  let announcedWarnings = new Set();

  const grip = () => Math.ceil(state.endurance);
  const elapsed = () => `${Math.floor(state.elapsedMs / 60000)}:${String(Math.floor(state.elapsedMs / 1000) % 60).padStart(2, '0')}`;
  const clockRunning = () => state.phase === 'climbing' || state.phase === 'resting';

  function stopClock() {
    clearInterval(clockTimer);
    clockTimer = null;
    lastTick = null;
  }

  function updateClock() {
    if (lastTick === null) return;
    const now = performance.now();
    const result = game.advance(state, now - lastTick);
    state = result.state;
    lastTick = now;
    if (result.outcome === 'fell') {
      stopClock();
      render();
      status.textContent = 'Your grip ran out! The clock got you. Retry, move faster, and plan your jug rests.';
      finishAttempt('fell');
    } else if (result.outcome === 'rest-complete') {
      render();
      status.textContent = `Rest complete. ${grip()} endurance left. The drain is back on — keep climbing.`;
    } else {
      renderVitals();
      if (state.phase === 'climbing') {
        const warning = state.endurance <= 8 ? 8 : state.endurance <= 20 ? 20 : null;
        if (warning && !announcedWarnings.has(warning)) {
          announcedWarnings.add(warning);
          status.textContent = warning === 8 ? 'Almost out of grip! Rest on a jug or make the finish now.' : 'Low endurance. Keep moving and watch for your next jug rest.';
        }
      }
    }
  }

  function startClock() {
    stopClock();
    lastTick = performance.now();
    clockTimer = setInterval(updateClock, 100);
  }

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
        updateClock();
        if (state.phase !== 'climbing') return;
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
      status.textContent = `Mint is off-route. Attempting this hold costs ${game.mistakeCost} endurance without advancing.`;
    } else if (preview.reason === 'out-of-reach') {
      status.textContent = `That hold is beyond your reach. An attempt costs ${game.mistakeCost} endurance. Try a closer coral hold above you.`;
    } else if (preview.reason === 'visited') {
      status.textContent = 'You’ve been there already. Choose a coral hold above you.';
    } else {
      const next = hold.type === 'jug' ? ' You can shake out there for 2 seconds.' : '';
      status.textContent = preview.cost >= state.endurance && !(hold.type === 'finish' && preview.cost === state.endurance)
        ? `${hold.label}. Costs ${preview.cost}, but you have only ${state.endurance.toFixed(1)}. This move will use up your grip; find a cheaper move or rest.`
        : `${hold.label}. Costs ${preview.cost} endurance.${next} Space or Enter to move.`;
    }
  }

  function renderVitals() {
    const rate = game.drainRate(state);
    const resting = state.phase === 'resting';
    const paused = state.phase === 'paused';
    const terminal = state.phase === 'complete' || state.phase === 'fallen';
    find('climb-stat-time').textContent = elapsed();
    find('climb-endurance-value').textContent = `${grip()}%`;
    find('climb-endurance-fill').style.width = `${state.endurance}%`;
    find('climb-endurance-meter').setAttribute('aria-valuenow', state.endurance.toFixed(1));
    find('climb-endurance-note').textContent = paused ? 'Paused' : resting ? 'Recovering' : state.phase === 'fallen' ? 'Grip gone' : state.phase === 'complete' ? 'Sent!' : state.phase === 'ready' ? 'Ready' : state.endurance <= 25 ? 'Running on fumes' : state.endurance <= 50 ? 'Getting pumped' : 'On the clock';
    find('climb-endurance').classList.toggle('is-low', state.endurance <= 35 && !resting);
    find('climb-endurance').classList.toggle('is-empty', state.endurance === 0);
    find('climb-endurance').classList.toggle('is-resting', resting);
    find('climb-drain-rate').textContent = rate ? `−${rate} grip/sec` : resting ? 'Recovering +35' : paused || terminal ? 'Clock stopped' : 'Timed challenge';
    find('climb-seconds-left').textContent = rate ? `~${Math.ceil(state.endurance / rate)}s on this hold` : resting ? `${(state.restRemainingMs / 1000).toFixed(1)}s rest left` : paused ? 'Resume to continue' : terminal ? `Climb time ${elapsed()}` : 'Starts when you climb';
    find('climb-rest-fill').style.width = `${(1 - state.restRemainingMs / game.restDurationMs) * 100}%`;
  }

  function render() {
    const current = currentHold();
    const active = state.phase === 'climbing';
    const complete = state.phase === 'complete';
    const fallen = state.phase === 'fallen';
    const paused = state.phase === 'paused';
    const resting = state.phase === 'resting';
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
    stage.classList.toggle('is-paused', paused);
    stage.classList.toggle('is-resting', resting);
    stage.dataset.phase = state.phase;
    find('climb-progress-label').textContent = `${progress}% of the wall`;
    find('climb-progress-fill').style.width = `${progress}%`;
    find('climb-phase').textContent = complete ? 'Topped out!' : fallen ? 'Back on the mat' : paused ? 'Paused' : resting ? 'Shaking out' : active ? 'On the clock' : 'At the start';
    find('climb-stat-moves').textContent = state.moves;
    find('climb-stat-mistakes').textContent = state.mistakes;
    find('climb-stat-rests').textContent = `${state.rested.length} / 2`;
    renderVitals();
    find('climb-board-selection').textContent = active ? selected ? selected.label : game.canRest(state) ? 'A good place to shake out' : 'Pick your next coral hold' : paused ? 'The wall can wait a moment' : resting ? 'Shake out. You’ve got two seconds.' : complete ? 'That’s a send.' : fallen ? 'Shake it off. Try again.' : 'Read the coral route';
    find('climb-move-cost').textContent = active && selected && preview.cost ? `−${preview.cost} grip` : '';
    boardAction.disabled = resting || (active && !selected);
    boardAction.innerHTML = `${paused ? 'Resume climb' : resting ? 'Shaking out…' : active ? 'Make the move' : complete || fallen ? 'Try this route again' : 'Start climbing'} <span aria-hidden="true">↗</span>`;
    restButton.disabled = !game.canRest(state);
    restButton.textContent = resting ? 'Resting…' : state.rested.includes(state.current) ? 'Rest used' : `Rest +${game.restRecovery}`;
    restButton.title = game.canRest(state) ? 'Recover up to 35 endurance over two seconds. One rest per jug.' : 'Rest once at each J hold.';
    find('climb-rest-progress').hidden = !resting;
    pauseButton.disabled = !(active || resting || paused);
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    directionButtons.forEach(button => { button.disabled = !active; });
    find('climb-result').hidden = !complete && !fallen && !paused;
    if (complete || fallen || paused) {
      find('climb-result-kicker').textContent = paused ? 'Clock stopped' : complete ? state.mistakes ? 'Found your way' : 'Clean send' : 'The wall wins this one';
      find('climb-result-title').textContent = paused ? 'Take a breather.' : complete ? 'Topped out.' : 'Out of grip.';
      find('climb-result-summary').textContent = paused ? 'Resume when you’re ready. Your grip and rest timer are saved.' : complete ? `${elapsed()} · ${state.moves} moves · ${grip()}% left` : `Climb time ${elapsed()}. Move faster, and make those jug rests count.`;
    }
  }

  function showWall() {
    document.querySelector('.climb-wall-panel').scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start'
    });
  }

  function startClimb() {
    stopClock();
    clearCelebration();
    announcedWarnings = new Set();
    state = game.start(state.route);
    render();
    status.textContent = 'The clock is running. Pick coral, move quickly, and shake out on the J holds.';
    stage.focus({ preventScroll: true });
    showWall();
    startClock();
  }

  function shuffleRoute() {
    stopClock();
    clearCelebration();
    announcedWarnings = new Set();
    let route = game.generateRoute();
    if (route.seed === state.route.seed) route = game.generateRoute((route.seed + 1) >>> 0);
    state = game.initialState(route);
    buildWall();
    render();
    status.textContent = `New route ${route.code}. Study the holds first; the clock starts when you climb.`;
    boardAction.focus({ preventScroll: true });
    showWall();
  }

  function chooseDirection(direction) {
    updateClock();
    if (state.phase !== 'climbing') return;
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
    if ((outcome === 'complete' || outcome === 'fell') && document.querySelector('.climb-game').contains(document.activeElement)) {
      boardAction.focus({ preventScroll: true });
    }
  }

  function makeMove() {
    updateClock();
    if (state.phase !== 'climbing') return;
    const result = game.move(state);
    state = result.state;
    render();
    const restHint = game.canRest(state) ? ' Jug reached. Press R or Rest +35 for a two-second shakeout.' : '';
    const messages = {
      unselected: 'Choose a hold first. Use an arrow key on the wall or pick a hold.',
      'off-route': `Wrong route. −${game.mistakeCost} endurance; ${grip()} left. Follow the coral holds.`,
      visited: 'You’ve already climbed that hold. Choose a coral hold above you.',
      'out-of-reach': `Too far. −${game.mistakeCost} endurance; ${grip()} left. Find a closer coral hold.`,
      moved: `Nice move. ${grip()} endurance left.${restHint}`,
      complete: `Topped out in ${elapsed()} with ${grip()}% endurance left. Beat your time or shuffle a new route.`,
      fell: 'Out of grip! You’re back on the mat. Retry this route and use the J holds to recover.'
    };
    if (messages[result.outcome]) status.textContent = messages[result.outcome];
    if (!clockRunning()) stopClock();
    finishAttempt(result.outcome);
  }

  function rest() {
    updateClock();
    if (state.phase !== 'climbing') return;
    const result = game.rest(state);
    state = result.state;
    render();
    if (result.outcome === 'resting') status.textContent = 'Shaking out for two seconds. Recovering 35 grip; moves unlock when the rest finishes.';
    else if (result.outcome === 'already-rested') status.textContent = 'You’ve used this rest. Find the next jug or move toward the finish.';
    else if (result.outcome === 'not-restable') status.textContent = 'Find a coral J hold to rest. Crimps and slopers need both hands on.';
  }

  function togglePause(automatic = false) {
    updateClock();
    if (clockRunning()) {
      state = game.pause(state);
      stopClock();
      render();
      status.textContent = automatic ? 'Paused while you were away. Resume when you return; your grip is saved.' : 'Paused. The route is hidden and the clock is stopped. Press P or Resume to continue.';
    } else if (state.phase === 'paused' && !automatic && !document.hidden) {
      state = game.resume(state);
      render();
      status.textContent = state.phase === 'resting' ? 'Finishing your shakeout. The clock is running again.' : 'Back on the wall. The clock is running — make your next move.';
      stage.focus({ preventScroll: true });
      startClock();
    }
  }

  boardAction.addEventListener('click', () => {
    if (state.phase === 'paused') togglePause();
    else if (state.phase === 'climbing') {
      makeMove();
      if (state.phase === 'climbing') stage.focus({ preventScroll: true });
    } else startClimb();
  });
  restButton.addEventListener('click', () => {
    rest();
    if (clockRunning()) stage.focus({ preventScroll: true });
  });
  pauseButton.addEventListener('click', () => togglePause());
  find('climb-reset').addEventListener('click', startClimb);
  find('climb-shuffle').addEventListener('click', shuffleRoute);
  directionButtons.forEach(button => button.addEventListener('click', () => {
    chooseDirection(button.dataset.direction);
    if (state.phase === 'climbing') stage.focus({ preventScroll: true });
  }));
  stage.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key.toLowerCase() === 'p' || event.key === 'Escape') {
      if (clockRunning() || state.phase === 'paused') {
        event.preventDefault();
        if (!event.repeat) togglePause();
      }
      return;
    }
    if (state.phase !== 'climbing' && state.phase !== 'resting') return;
    const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const handled = directions[event.key] || event.key === ' ' || event.key === 'Enter' || event.key.toLowerCase() === 'r';
    if (handled) event.preventDefault();
    if (event.repeat || state.phase === 'resting') return;
    if (directions[event.key]) {
      chooseDirection(directions[event.key]);
    } else if (event.key === ' ' || event.key === 'Enter') {
      makeMove();
    } else if (event.key.toLowerCase() === 'r') {
      rest();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && clockRunning()) togglePause(true);
  });
  window.addEventListener('pagehide', () => {
    if (clockRunning()) togglePause(true);
  });

  buildWall();
  render();
  stage.hidden = false;
  find('climb-controls').hidden = false;
  find('climb-board-toolbar').hidden = false;
  find('climb-endurance').hidden = false;
  find('climb-nojs').hidden = true;
})();
