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
  window.matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
  document.getElementById('year').textContent = String(new Date().getFullYear());

  // The saved profile is used only to choose the navbar link. It grants no access.
  // Account permissions continue to be checked by the existing dashboard/backend.
  function updateAccountLink() {
    let user = null;
    try {
      const token = localStorage.getItem('barterToken');
      if (token) {
        let expired = false;
        try {
          const segment = token.split('.')[1];
          if (segment) {
            const payload = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')));
            expired = payload.exp != null && Date.now() >= Number(payload.exp) * 1000;
          }
        } catch (_) { /* Non-JWT session formats remain the main app's concern. */ }
        if (!expired) user = JSON.parse(localStorage.getItem('barterUser') || localStorage.getItem('bartifyUser') || 'null');
      }
    } catch (_) { /* Public content remains usable when storage is unavailable. */ }
    const signedIn = Boolean(user && typeof user === 'object');
    document.getElementById('guestActions').hidden = signedIn;
    document.getElementById('memberActions').hidden = !signedIn;
    if (signedIn) {
      document.getElementById('accountLink').href = user.role_id === 2 ? 'adminDashboard.html' : 'dashboard.html';
      const name = String(user.firstName || user.name || 'User');
      document.getElementById('accountInitial').textContent = name.charAt(0).toUpperCase();
      document.getElementById('accountLink').setAttribute('aria-label', `${name}'s dashboard`);
    }
  }
  updateAccountLink();
  window.addEventListener('storage', updateAccountLink);
  window.addEventListener('pageshow', updateAccountLink);
})();
