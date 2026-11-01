(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const projectVisuals = [...document.querySelectorAll('.project-visual')];
  const revealTargets = [...document.querySelectorAll(
    '.section-heading, .project, .notebook-intro, .notebook-latest, ' +
    '.about-heading, .about-copy, .elsewhere-grid, .contact'
  )];
  const resetPointers = [];
  let revealObserver;

  // Prepare everything before enabling the CSS that hides unrevealed content.
  function startReveals() {
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return;

    try {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          target.classList.add('is-visible');
          revealObserver.unobserve(target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

      revealTargets.forEach((target) => {
        target.classList.add('reveal');
        const bounds = target.getBoundingClientRect();
        if (bounds.top < window.innerHeight && bounds.bottom > 0) {
          target.classList.add('is-visible');
        }
        if (!target.classList.contains('is-visible')) revealObserver.observe(target);
      });
      root.classList.add('motion-ready');
    } catch {
      root.classList.remove('motion-ready');
      revealObserver?.disconnect();
    }
  }

  document.addEventListener('focusin', (event) => {
    const target = event.target.closest('.reveal');
    if (!target) return;
    target.classList.add('is-visible');
    revealObserver?.unobserve(target);
  });

  projectVisuals.forEach((visual) => {
    let frame = 0;
    let bounds;
    let position;

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      bounds = null;
      position = null;
      visual.classList.remove('has-pointer');
      ['--tilt-x', '--tilt-y', '--spotlight-x', '--spotlight-y'].forEach((property) => {
        visual.style.removeProperty(property);
      });
    }

    function updatePointer(event) {
      if (reducedMotion.matches || !finePointer.matches || event.pointerType === 'touch') return;
      bounds ||= visual.getBoundingClientRect();
      position = { x: event.clientX, y: event.clientY };
      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!bounds || !position) return;
        const x = Math.max(-1, Math.min(1, ((position.x - bounds.left) / bounds.width) * 2 - 1));
        const y = Math.max(-1, Math.min(1, ((position.y - bounds.top) / bounds.height) * 2 - 1));
        visual.style.setProperty('--tilt-x', `${(-y * 4).toFixed(2)}deg`);
        visual.style.setProperty('--tilt-y', `${(x * 4).toFixed(2)}deg`);
        visual.style.setProperty('--spotlight-x', `${((x + 1) * 50).toFixed(1)}%`);
        visual.style.setProperty('--spotlight-y', `${((y + 1) * 50).toFixed(1)}%`);
        visual.classList.add('has-pointer');
      });
    }

    visual.addEventListener('pointerenter', updatePointer);
    visual.addEventListener('pointermove', updatePointer);
    visual.addEventListener('pointerleave', reset);
    visual.addEventListener('pointercancel', reset);
    visual.addEventListener('blur', reset);
    resetPointers.push(reset);
  });

  function resetAllPointers() {
    resetPointers.forEach((reset) => reset());
  }

  reducedMotion.addEventListener('change', () => {
    resetAllPointers();
    root.classList.remove('motion-ready');
    revealObserver?.disconnect();
    // Once seen, content stays visible when the motion preference changes.
    revealTargets.forEach((target) => target.classList.add('is-visible'));
    if (!reducedMotion.matches) startReveals();
  });
  finePointer.addEventListener('change', resetAllPointers);
  window.addEventListener('blur', resetAllPointers);

  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);

  const sectionLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const sections = [...document.querySelectorAll('main > section[id]')];
  let scrollFrame = 0;
  let activeSection;

  function updateScroll() {
    scrollFrame = 0;
    const scrollRange = root.scrollHeight - window.innerHeight;
    const scrollPosition = Math.max(0, window.scrollY);
    const progressValue = scrollRange > 0 ? Math.min(1, scrollPosition / scrollRange) : 0;
    progress.style.setProperty('--scroll-progress', progressValue.toFixed(4));

    const readingLine = Math.min(220, window.innerHeight * 0.32);
    const visibleSections = sections.map((section) => ({ section, bounds: section.getBoundingClientRect() }));
    let current = visibleSections.find(({ bounds }) => bounds.top <= readingLine && bounds.bottom > readingLine);
    if (scrollRange > 0 && scrollPosition >= scrollRange - 2) {
      current = visibleSections.filter(({ bounds }) => bounds.top < window.innerHeight && bounds.bottom > 0).at(-1);
    }
    const currentId = current?.section.id || null;
    if (currentId === activeSection) return;
    activeSection = currentId;
    sectionLinks.forEach((link) => {
      if (currentId !== 'home' && link.getAttribute('href') === `#${currentId}`) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function scheduleScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }

  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', () => {
    resetAllPointers();
    scheduleScroll();
  });
  window.addEventListener('load', scheduleScroll, { once: true });
  startReveals();
  updateScroll();
})();
