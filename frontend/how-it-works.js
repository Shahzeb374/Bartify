/* How It Works navigation only. Existing application session and API behavior are untouched. */
(() => {
  'use strict';
  const menu = document.getElementById('primaryNavigation');
  const toggle = document.getElementById('menuToggle');
  const setMenu = open => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('click', event => {
    if (!menu.contains(event.target) && !toggle.contains(event.target)) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });
  menu.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  window.matchMedia('(min-width: 851px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
  document.getElementById('year').textContent = String(new Date().getFullYear());

  function updateGuestActions() {
    let signedIn = false;
    try {
      signedIn = Boolean(localStorage.getItem('barterToken'));
    } catch (_) { /* Public navigation remains available if storage is blocked. */ }
    document.getElementById('guestActions').hidden = signedIn;
  }
  updateGuestActions();
  window.addEventListener('pageshow', updateGuestActions);
  window.addEventListener('storage', event => {
    if (event.key === 'barterToken' || event.key === null) updateGuestActions();
  });
})();
