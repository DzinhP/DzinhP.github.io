(() => {
  const routes = Array.from(document.querySelectorAll('[data-learning-route]'));
  const picker = document.querySelector('.learning-route-picker');
  const choices = Array.from(picker?.querySelectorAll('a') || []);
  const status = document.querySelector('[data-learning-status]');
  if (!routes.length || routes.length !== choices.length || !status) return;

  const states = routes.map((route) => {
    const holds = Array.from(route.querySelectorAll('[data-checkpoint]'));
    return {
      route,
      holds,
      notes: holds.map((hold) => document.getElementById(hold.dataset.checkpoint)),
      controls: route.querySelector('.learning-note-controls'),
      previous: route.querySelector('[data-note-step="-1"]'),
      next: route.querySelector('[data-note-step="1"]'),
      position: route.querySelector('[data-note-position]'),
      selected: 0
    };
  });
  if (states.some((state) => !state.holds.length || state.notes.some((note) => !note) || !state.controls || !state.previous || !state.next || !state.position)) return;

  const pad = (number) => String(number).padStart(2, '0');
  let activeRoute = 0;

  function updateHash(hash) {
    try {
      history.replaceState(null, '', `#${hash}`);
    } catch {
      // Selection still works in preview contexts that block URL updates.
    }
  }

  function selectNote(state, index, { announce = true, writeHash = false } = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= state.holds.length) return;
    state.selected = index;
    state.holds.forEach((hold, holdIndex) => {
      if (holdIndex === index) hold.setAttribute('aria-current', 'true');
      else hold.removeAttribute('aria-current');
      state.notes[holdIndex].hidden = holdIndex !== index;
    });
    state.position.textContent = `${pad(index + 1)} / ${pad(state.holds.length)}`;
    state.previous.disabled = index === 0;
    state.next.disabled = index === state.holds.length - 1;
    if (announce) {
      const title = state.notes[index].querySelector('h3').innerText.trim().replace(/\s+/g, ' ');
      status.textContent = `${state.route.dataset.routeName}, note ${index + 1} of ${state.holds.length}: ${title}`;
    }
    if (writeHash) updateHash(state.holds[index].dataset.checkpoint);
  }

  function selectRoute(index, { announce = true, writeHash = false } = {}) {
    if (index < 0 || index >= states.length) return;
    activeRoute = index;
    states.forEach((state, position) => { state.route.hidden = position !== index; });
    choices.forEach((choice, position) => {
      if (position === index) choice.setAttribute('aria-current', 'true');
      else choice.removeAttribute('aria-current');
    });
    const state = states[index];
    selectNote(state, state.selected, { announce });
    if (writeHash) updateHash(state.route.id);
  }

  function selectFromHash({ announce = true } = {}) {
    const aliases = { '#forecasting': '#forecasting-models', '#statistics': '#practical-statistics', '#slab': '#slab-climbing' };
    const hash = aliases[window.location.hash] || window.location.hash;
    for (let index = 0; index < states.length; index++) {
      const state = states[index];
      const checkpoint = state.holds.findIndex((hold) => `#${hold.dataset.checkpoint}` === hash);
      if (`#${state.route.id}` === hash || checkpoint >= 0) {
        if (checkpoint >= 0) state.selected = checkpoint;
        selectRoute(index, { announce });
        return true;
      }
    }
    return false;
  }

  // The owner records completion in the HTML. Reading never changes progress.
  let completedRoutes = 0;
  let completedCheckpoints = 0;
  let checkpointTotal = 0;
  states.forEach((state) => {
    const { route, holds } = state;
    const complete = holds.filter((hold) => hold.dataset.state === 'complete').length;
    const routeComplete = complete === holds.length;
    completedRoutes += Number(routeComplete);
    completedCheckpoints += complete;
    checkpointTotal += holds.length;
    route.querySelector('[data-route-state]').textContent = routeComplete ? 'Route complete' : 'In progress';
    route.querySelector('[data-progress-label]').textContent = `${complete} of ${holds.length} checkpoints complete`;
    route.querySelector('.learning-progress-line').style.setProperty('--progress', `${complete / holds.length * 100}%`);

    holds.forEach((hold, index) => {
      hold.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        selectNote(state, index, { writeHash: true });
      });
      hold.addEventListener('keydown', (event) => {
        let target;
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') target = Math.min(index + 1, holds.length - 1);
        if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') target = Math.max(index - 1, 0);
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = holds.length - 1;
        if (target === undefined) return;
        event.preventDefault();
        holds[target].focus();
        selectNote(state, target, { writeHash: true });
      });
    });

    [state.previous, state.next].forEach((button) => {
      button.addEventListener('click', () => {
        selectNote(state, state.selected + Number(button.dataset.noteStep), { writeHash: true });
        if (button.disabled) {
          (button === state.next ? state.previous : state.next).focus();
        }
      });
    });
    route.querySelector('[data-map-instruction]').textContent = 'Pick a hold. Read the note.';
    state.controls.hidden = false;
    route.classList.add('learning-ready');
    selectNote(state, 0, { announce: false });
  });

  choices.forEach((choice, index) => {
    choice.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      selectRoute(index, { writeHash: true });
    });
    choice.addEventListener('keydown', (event) => {
      let target;
      if (event.key === 'ArrowRight') target = Math.min(index + 1, choices.length - 1);
      if (event.key === 'ArrowLeft') target = Math.max(index - 1, 0);
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = choices.length - 1;
      if (target === undefined) return;
      event.preventDefault();
      choices[target].focus();
      selectRoute(target, { writeHash: true });
    });
  });

  document.querySelector('[data-route-total]').textContent = pad(completedRoutes);
  document.querySelector('[data-checkpoint-total]').textContent = `${completedCheckpoints} of ${checkpointTotal} checkpoints`;
  document.querySelector('.learning-stamp').setAttribute('aria-label', `${completedRoutes} of ${states.length} routes completed, with ${completedCheckpoints} of ${checkpointTotal} checkpoints complete`);
  document.querySelector('.learning-stamp p').textContent = completedRoutes === 1 ? 'route completed' : 'routes completed';
  window.addEventListener('hashchange', () => {
    if (!selectFromHash()) selectRoute(activeRoute, { announce: false });
  });
  if (!selectFromHash({ announce: false })) selectRoute(0, { announce: false });
})();
