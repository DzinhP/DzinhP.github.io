document.documentElement.classList.add('js');

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#site-nav');

function closeMenu() {
  if (!navigation || !menuButton) return;
  navigation.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.querySelector('span').textContent = '+';
}

menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  navigation.classList.toggle('is-open', !expanded);
  menuButton.setAttribute('aria-expanded', String(!expanded));
  menuButton.querySelector('span').textContent = expanded ? '+' : '−';
});

navigation?.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});

window.matchMedia('(min-width: 601px)').addEventListener('change', closeMenu);
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const copyButton = document.querySelector('.copy-email');
const copyStatus = document.querySelector('#copy-status');
let resetCopyStatus;

copyButton?.addEventListener('click', async () => {
  if (!copyStatus) return;
  clearTimeout(resetCopyStatus);
  try {
    await navigator.clipboard.writeText(copyButton.dataset.email);
    copyStatus.textContent = 'Email address copied. Say hello anytime.';
  } catch {
    copyStatus.textContent = 'Select the email address to copy it, or click it to open your mail app.';
  }
  resetCopyStatus = setTimeout(() => { copyStatus.textContent = ''; }, 6000);
});
