(() => {
  'use strict';
  const game = window.BasecampClimb;
  const stage = document.querySelector('#climb-stage');
  if (!game || !stage) return;

  const status = document.querySelector('#climb-status');
  const holdContainer = document.querySelector('#climb-holds');
  const figure = document.querySelector('#mini-climber');
  const trail = document.querySelector('#climb-trail');
  const startButton = document.querySelector('#climb-start');
  const playControls = document.querySelector('#climb-play-controls');
  const moveButton = document.querySelector('#climb-move');
  const selectionLabel = document.querySelector('#climb-selection-label');
  const celebration = document.querySelector('#climb-celebration');
  const boardAction = document.querySelector('#climb-board-action');
  const boardSelection = document.querySelector('#climb-board-selection');
  let state = game.initialState();
  let celebrationTimer;

  const holdButtons = game.holds.map((hold, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `game-hold ${hold.step === null ? 'game-hold-mint' : 'game-hold-coral'}`;
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
    shape.textContent = hold.step === 0 ? 'S' : hold.step === 6 ? '↗' : hold.step === null ? '' : String(hold.step);
    button.append(shape);
    button.addEventListener('click', () => {
      if (state.phase !== 'climbing') return;
      state = game.select(state, hold.id);
      render();
      announceSelection();
    });
    holdContainer.append(button);
    return button;
  });

  function announceSelection() {
    if (state.selected) status.textContent = `${game.holds.find(hold => hold.id === state.selected).label} selected. Press Space or Enter on the wall, or Make the move.`;
  }

  function render() {
    const current = game.holds.find(hold => hold.id === state.current);
    figure.style.left = `${current.x}%`;
    figure.style.top = `${current.y}%`;
    trail.setAttribute('points', state.visited.map(id => {
      const hold = game.holds.find(item => item.id === id);
      return `${hold.x},${hold.y}`;
    }).join(' '));
    holdButtons.forEach(button => {
      const selected = button.dataset.hold === state.selected;
      const currentHold = button.dataset.hold === state.current;
      button.classList.toggle('is-selected', selected);
      button.classList.toggle('is-current', currentHold);
      button.classList.toggle('is-visited', state.visited.includes(button.dataset.hold));
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = state.phase !== 'climbing' || currentHold;
    });
    document.querySelector('#climb-progress-label').textContent = `${state.moves} of ${game.totalMoves} moves`;
    document.querySelector('#climb-progress-fill').style.width = `${state.moves / game.totalMoves * 100}%`;
    document.querySelector('#climb-phase').textContent = state.phase === 'complete' ? 'Topped out!' : state.phase === 'ready' ? 'At the start' : 'On the wall';
    stage.classList.toggle('is-complete', state.phase === 'complete');
    selectionLabel.textContent = state.selected ? game.holds.find(hold => hold.id === state.selected).label : 'Choose a hold on the wall';
    moveButton.disabled = !state.selected || state.phase !== 'climbing';
    boardAction.disabled = state.phase === 'climbing' && !state.selected;
    boardAction.innerHTML = `${state.phase === 'ready' ? 'Start the route' : state.phase === 'complete' ? 'Climb again' : 'Move to this hold'} <span aria-hidden="true">↗</span>`;
    boardSelection.textContent = state.phase === 'ready' ? 'Coral route · six moves' : state.phase === 'complete' ? 'Six moves. Nicely done.' : state.selected ? `${selectionLabel.textContent} selected` : 'Pick your next coral hold';
    startButton.hidden = state.phase === 'climbing';
    playControls.hidden = state.phase !== 'climbing';
    startButton.innerHTML = `${state.phase === 'complete' ? 'Climb it again' : 'Start climbing'} <span aria-hidden="true">↗</span>`;
  }

  function startClimb() {
    clearTimeout(celebrationTimer);
    celebration.classList.remove('is-celebrating');
    state = game.start();
    render();
    status.textContent = 'You’re on the wall. Choose coral hold 1, just above and to the right.';
    stage.focus({ preventScroll: true });
  }

  function chooseDirection(direction) {
    const previous = state.selected;
    state = game.selectDirection(state, direction);
    render();
    if (state.selected !== previous) announceSelection();
    else status.textContent = 'No more holds in that direction. Try another arrow or pick a hold on the wall.';
  }

  function makeMove() {
    const result = game.move(state);
    state = result.state;
    render();
    const messages = {
      unselected: 'Choose a hold first. Use an arrow key on the wall or pick a hold.',
      'off-route': 'That mint hold belongs to another route. Look for a coral hold nearby.',
      visited: 'You’ve already climbed that hold. Look for the next coral hold above you.',
      'out-of-reach': 'A little too far! Find the next coral hold closer to your climber.',
      moved: `Nice move. ${state.moves} of ${game.totalMoves} down. Take a moment to find the next coral hold.`,
      complete: 'Topped out! All six moves, one at a time. Take the little win — or climb it again.'
    };
    if (messages[result.outcome]) status.textContent = messages[result.outcome];
    if (result.outcome === 'complete') {
      celebration.classList.add('is-celebrating');
      celebrationTimer = setTimeout(() => celebration.classList.remove('is-celebrating'), 1800);
      boardAction.focus({ preventScroll: true });
    }
  }

  startButton.addEventListener('click', startClimb);
  boardAction.addEventListener('click', () => state.phase === 'climbing' ? makeMove() : startClimb());
  document.querySelector('#climb-reset').addEventListener('click', startClimb);
  moveButton.addEventListener('click', makeMove);
  document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => chooseDirection(button.dataset.direction)));
  stage.addEventListener('keydown', event => {
    if (state.phase !== 'climbing' || event.altKey || event.ctrlKey || event.metaKey) return;
    const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (directions[event.key]) {
      event.preventDefault();
      chooseDirection(directions[event.key]);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      makeMove();
    }
  });

  render();
  stage.hidden = false;
  document.querySelector('#climb-controls').hidden = false;
  document.querySelector('#climb-board-toolbar').hidden = false;
  document.querySelector('#climb-nojs').hidden = true;
})();
