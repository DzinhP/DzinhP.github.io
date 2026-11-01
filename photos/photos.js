(() => {
  'use strict';

  const notebook = document.querySelector('.photo-notebook');
  if (!notebook) return;

  const categories = { all: 'All', climbing: 'Climbing', hackathons: 'Hackathons', everyday: 'Everyday' };
  const entries = notebook.querySelector('.photo-entries');
  const filters = notebook.querySelector('.photo-filters');
  const count = notebook.querySelector('.photos-count');
  const empty = notebook.querySelector('.photos-empty');
  const emptyHeading = empty.querySelector('h2');
  const emptyCopy = empty.querySelector('.photos-empty-copy');
  const reset = empty.querySelector('.photos-reset');
  const error = notebook.querySelector('.photos-error');
  const retry = error.querySelector('.photos-retry');
  const dialog = document.querySelector('.photo-lightbox');
  const canUseDialog = dialog && typeof dialog.showModal === 'function';
  const viewerTitle = dialog.querySelector('#lightbox-title');
  const viewerStage = dialog.querySelector('.lightbox-stage');
  const viewerCaption = dialog.querySelector('.lightbox-caption');
  const viewerUnavailable = dialog.querySelector('.lightbox-unavailable');
  const viewerCounter = dialog.querySelector('.lightbox-counter');
  const previous = dialog.querySelector('.lightbox-previous');
  const next = dialog.querySelector('.lightbox-next');
  let viewerImage = dialog.querySelector('.lightbox-image');
  let notes = [];
  let activeNote = null;
  let activeImageIndex = 0;
  let returnFocus = null;
  let savedOverflow = '';
  let swipeStart = null;

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function categoryFromURL() {
    const category = new URL(location.href).searchParams.get('category');
    return Object.hasOwn(categories, category) ? category : 'all';
  }

  function isText(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function validateNotes(data) {
    if (!Array.isArray(data)) throw new Error('Photo notes must be an array.');
    const ids = new Set();
    const imageDirectory = new URL('images/', document.baseURI);
    return data.map((note) => {
      if (!note || typeof note !== 'object' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(note.id || '') || ids.has(note.id)) {
        throw new Error('Each photo note needs a unique, lowercase id.');
      }
      ids.add(note.id);
      if (!isText(note.title) || !isText(note.paragraph) || !Object.hasOwn(categories, note.category) || note.category === 'all') {
        throw new Error(`Invalid title, paragraph, or category for ${note.id}.`);
      }
      const date = typeof note.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(note.date) ? new Date(`${note.date}T12:00:00Z`) : null;
      if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== note.date) {
        throw new Error(`Invalid date for ${note.id}.`);
      }
      if (!Array.isArray(note.images) || note.images.length === 0) throw new Error(`Add at least one photo to ${note.id}.`);
      const images = note.images.map((photo) => {
        if (!photo || !isText(photo.src) || !photo.src.startsWith('images/') || !isText(photo.alt)) {
          throw new Error(`Each image in ${note.id} needs a local images/ path and alt text.`);
        }
        const url = new URL(photo.src, document.baseURI);
        if (url.origin !== imageDirectory.origin || !url.pathname.startsWith(imageDirectory.pathname) || url.search || url.hash) {
          throw new Error(`Image paths must stay inside photos/images/ for ${note.id}.`);
        }
        if (photo.caption !== undefined && typeof photo.caption !== 'string') throw new Error(`Invalid image caption for ${note.id}.`);
        return { src: url.href, alt: photo.alt.trim(), caption: photo.caption?.trim() || '' };
      });
      return { id: note.id, title: note.title.trim(), paragraph: note.paragraph.trim(), date: note.date, category: note.category, images };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }

  function makePhotoFrame(note, photo, index) {
    const frame = makeElement(canUseDialog ? 'button' : 'a', 'photo-frame');
    frame.setAttribute('aria-label', `View photo ${index + 1} of ${note.images.length}: ${photo.alt}`);
    if (canUseDialog) {
      frame.type = 'button';
      frame.setAttribute('aria-haspopup', 'dialog');
      frame.addEventListener('click', () => openViewer(note, index, frame));
    } else {
      frame.href = photo.src;
      frame.target = '_blank';
      frame.rel = 'noopener noreferrer';
    }
    const image = makeElement('img');
    image.alt = photo.alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      frame.classList.add('is-unavailable');
      const fallback = makeElement('span', '', 'Photo unavailable');
      fallback.setAttribute('aria-hidden', 'true');
      frame.append(fallback);
    }, { once: true });
    image.src = photo.src;
    frame.append(image);
    if (index === 0 || (index === 2 && note.images.length > 3)) {
      const label = makeElement('span', 'photo-view-label', index === 2 ? `+${note.images.length - 3} more` : 'View photos ↗');
      label.setAttribute('aria-hidden', 'true');
      frame.append(label);
    }
    return frame;
  }

  function makeEntry(note) {
    const article = makeElement('article', 'photo-entry');
    article.id = note.id;
    article.setAttribute('aria-labelledby', `${note.id}-title`);
    const sheet = makeElement('div', 'photo-contact-sheet');
    note.images.slice(0, 3).forEach((photo, index) => sheet.append(makePhotoFrame(note, photo, index)));
    const copy = makeElement('div', 'photo-entry-copy');
    const meta = makeElement('div', 'photo-entry-meta');
    const time = makeElement('time', '', new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${note.date}T12:00:00Z`)));
    time.dateTime = note.date;
    meta.append(makeElement('span', 'photo-category', categories[note.category]), time);
    const heading = makeElement('h2', '', note.title);
    heading.id = `${note.id}-title`;
    copy.append(meta, heading, makeElement('p', '', note.paragraph), makeElement('p', 'photo-entry-count', `${note.images.length} ${note.images.length === 1 ? 'photograph' : 'photographs'} / ${categories[note.category].toLowerCase()}`));
    article.append(sheet, copy);
    return article;
  }

  function renderNotes(category) {
    const visible = notes.filter((note) => category === 'all' || note.category === category);
    entries.replaceChildren(...visible.map(makeEntry));
    for (const button of filters.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.category === category));
    count.textContent = `${visible.length} photo ${visible.length === 1 ? 'note' : 'notes'}${category === 'all' ? '' : ` · ${categories[category]}`}`;
    empty.hidden = visible.length > 0;
    reset.hidden = category === 'all';
    if (category === 'all') {
      emptyHeading.replaceChildren(document.createTextNode('No photo notes '), makeElement('em', '', 'yet.'));
      emptyCopy.textContent = 'The first frame is still ahead. Photos and the little stories behind them will find a home here.';
    } else {
      emptyHeading.textContent = `No ${category === 'hackathons' ? 'hackathon' : categories[category].toLowerCase()} notes yet.`;
      emptyCopy.textContent = 'A little space for a future story. Explore the rest of the notebook in the meantime.';
    }
  }

  function selectCategory(category) {
    const url = new URL(location.href);
    if (category === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', category);
    if (url.href !== location.href) history.pushState(null, '', url);
    renderNotes(category);
  }

  async function loadNotes() {
    entries.setAttribute('aria-busy', 'true');
    count.textContent = 'Opening the notebook…';
    retry.disabled = true;
    error.hidden = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(new URL('notes.json', document.baseURI), { cache: 'no-cache', signal: controller.signal });
      if (!response.ok) throw new Error(`Photo notes returned ${response.status}.`);
      notes = validateNotes(await response.json());
      renderNotes(categoryFromURL());
      filters.hidden = false;
    } catch (cause) {
      entries.replaceChildren();
      empty.hidden = true;
      filters.hidden = true;
      error.hidden = false;
      count.textContent = 'Photo notes unavailable';
      console.warn('Photo notebook:', cause.message);
    } finally {
      clearTimeout(timeout);
      entries.setAttribute('aria-busy', 'false');
      retry.disabled = false;
    }
  }

  function displayPhoto(index) {
    if (!activeNote || index < 0 || index >= activeNote.images.length) return;
    const focusedControl = document.activeElement;
    activeImageIndex = index;
    const photo = activeNote.images[index];
    const image = makeElement('img', 'lightbox-image');
    image.alt = photo.alt;
    image.decoding = 'async';
    image.addEventListener('error', () => {
      if (viewerImage !== image) return;
      image.hidden = true;
      viewerUnavailable.hidden = false;
      viewerUnavailable.textContent = `This photo couldn't load. ${photo.alt}`;
    }, { once: true });
    viewerUnavailable.hidden = true;
    viewerImage.replaceWith(image);
    viewerImage = image;
    image.src = photo.src;
    viewerCaption.textContent = photo.caption;
    viewerCounter.textContent = `${index + 1} / ${activeNote.images.length}`;
    viewerCounter.setAttribute('aria-label', `Photo ${index + 1} of ${activeNote.images.length}`);
    previous.disabled = index === 0;
    next.disabled = index === activeNote.images.length - 1;
    // Keep focus in the viewer when the button just used reaches a boundary.
    if (focusedControl === next && next.disabled) previous.focus();
    else if (focusedControl === previous && previous.disabled) next.focus();
  }

  function openViewer(note, index, trigger) {
    activeNote = note;
    returnFocus = trigger;
    viewerTitle.textContent = note.title;
    displayPhoto(index);
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
  }

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-category]');
    if (button && filters.contains(button)) selectCategory(button.dataset.category);
  });
  reset.addEventListener('click', () => {
    selectCategory('all');
    filters.querySelector('[data-category="all"]').focus();
  });
  retry.addEventListener('click', loadNotes);
  window.addEventListener('popstate', () => {
    if (!filters.hidden) renderNotes(categoryFromURL());
  });

  if (canUseDialog) {
    dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
    previous.addEventListener('click', () => displayPhoto(activeImageIndex - 1));
    next.addEventListener('click', () => displayPhoto(activeImageIndex + 1));
    dialog.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        displayPhoto(activeImageIndex + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.style.overflow = savedOverflow;
      swipeStart = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    });
    viewerStage.addEventListener('pointerdown', (event) => {
      swipeStart = event.pointerType === 'touch' && event.isPrimary ? { x: event.clientX, y: event.clientY } : null;
    });
    viewerStage.addEventListener('pointerup', (event) => {
      if (!swipeStart) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) displayPhoto(activeImageIndex + (dx < 0 ? 1 : -1));
    });
    viewerStage.addEventListener('pointercancel', () => { swipeStart = null; });
  }

  loadNotes();
})();
