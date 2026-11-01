const filterGroup = document.querySelector('.note-filters');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const noteEntries = [...document.querySelectorAll('.note-entry')];
const emptyState = document.querySelector('.notes-empty');
const filterStatus = document.querySelector('.filter-status');
const categoryLabels = { all: 'All', writing: 'Writing', learning: 'Learning notes', updates: 'Updates' };
const emptyTitles = { writing: 'No writing yet.', learning: 'No learning notes yet.', updates: 'No updates yet.', all: 'No notes yet.' };

function applyFilter(category, updateUrl = false) {
  const selected = Object.hasOwn(categoryLabels, category) ? category : 'all';
  let visibleCount = 0;

  for (const entry of noteEntries) {
    const visible = selected === 'all' || entry.dataset.category === selected;
    entry.hidden = !visible;
    if (visible) visibleCount += 1;
  }
  for (const button of filterButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === selected));
  }

  emptyState.hidden = visibleCount > 0;
  emptyState.querySelector('h2').textContent = emptyTitles[selected];
  filterStatus.textContent = `${visibleCount} ${visibleCount === 1 ? 'note' : 'notes'}${selected === 'all' ? '' : ` in ${categoryLabels[selected]}`}`;

  if (updateUrl) {
    const url = new URL(window.location.href);
    if (selected === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', selected);
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
  }
}

filterGroup.hidden = false;
applyFilter(new URLSearchParams(window.location.search).get('category'));

for (const button of filterButtons) {
  button.addEventListener('click', () => applyFilter(button.dataset.filter, true));
}

document.querySelector('[data-reset-filter]').addEventListener('click', () => {
  applyFilter('all', true);
  filterButtons[0].focus();
});

window.addEventListener('popstate', () => {
  applyFilter(new URLSearchParams(window.location.search).get('category'));
});
