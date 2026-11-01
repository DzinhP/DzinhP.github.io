(() => {
  const scene = document.querySelector('.climb-scene');
  if (!scene) return;

  const stops = [
    {
      category: '01 / Selected work',
      title: 'Ideas, made real.',
      description: 'Education, interview practice, and a little more community.',
      link: '#work',
      action: 'Explore the projects'
    },
    {
      category: '02 / Field notes',
      title: 'The notebook stays open.',
      description: 'Longer thoughts, small things learned, and updates along the way.',
      link: 'writing/',
      action: 'Open the notebook'
    },
    {
      category: '03 / About me',
      title: 'Curiosity is the common thread.',
      description: 'A little about the person behind the code, and beyond the screen.',
      link: '#about',
      action: 'Get to know me'
    },
    {
      category: '04 / Say hello',
      title: 'Good things start with a hello.',
      description: 'A project, a question, or a good climbing story. I’m all ears.',
      link: '#contact',
      action: 'Let’s talk'
    }
  ];

  const controls = scene.querySelector('.route-controls');
  const holds = [...scene.querySelectorAll('.route-hold')];
  const traces = [...scene.querySelectorAll('.route-trace')];
  const markers = [...scene.querySelectorAll('.route-panel-markers i')];
  const category = scene.querySelector('.route-panel-category');
  const title = scene.querySelector('.route-panel-title');
  const description = scene.querySelector('.route-panel-description');
  const links = [...scene.querySelectorAll('[data-route-link]')];
  const invitation = scene.querySelector('.route-invitation');
  let pulseTimer;

  if (!controls || holds.length !== stops.length || !category || !title || !description) return;

  function selectStop(index) {
    const stop = stops[index];
    holds.forEach((hold, position) => {
      hold.setAttribute('aria-pressed', String(position === index));
      hold.classList.remove('is-pulsing');
    });
    traces.forEach((trace, position) => trace.classList.toggle('is-lit', position < index));
    markers.forEach((marker, position) => marker.classList.toggle('is-current', position === index));
    category.textContent = stop.category;
    title.textContent = stop.title;
    description.textContent = stop.description;
    links.forEach((link) => {
      link.href = stop.link;
      if (link.classList.contains('route-destination')) {
        link.querySelector('.route-destination-label').textContent = stop.action;
      } else {
        link.textContent = stop.action;
      }
    });
    clearTimeout(pulseTimer);
    holds[index].classList.add('is-pulsing');
    pulseTimer = setTimeout(() => holds[index].classList.remove('is-pulsing'), 700);
  }

  holds.forEach((hold, index) => {
    hold.addEventListener('click', () => selectStop(index));
    hold.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = (index + 1) % holds.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = (index - 1 + holds.length) % holds.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = holds.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      holds[next].focus();
      selectStop(next);
    });
  });

  invitation.innerHTML = '<span aria-hidden="true">↖</span> Pick a hold. Find your next move.';
  controls.hidden = false;
  scene.classList.add('route-ready');
})();
