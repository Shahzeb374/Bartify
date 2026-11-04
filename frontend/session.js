// Roles are always fetched from the server; localStorage is only a UI cache.
window.BartifySession = (() => {
  const api = API_BASE_URL;
  const nativeFetch = window.fetch.bind(window);
  let checking = false;
  let leaving = false;
  function clear() {
    ['barterToken', 'barterUser', 'bartifyUser'].forEach(key => localStorage.removeItem(key));
  }
  function revoke() {
    if (leaving) return;
    leaving = true;
    clear();
    window.location.replace('login.html?reason=session-ended');
  }
  async function checkSession() {
    const token = localStorage.getItem('barterToken');
    if (!token || checking) return;
    checking = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await nativeFetch(`${api}/users/me`, {
        headers: {Authorization: `Bearer ${token}`}, signal: controller.signal,
      });
      if (token === localStorage.getItem('barterToken') && [401, 403].includes(response.status)) revoke();
    } catch (_) { /* A connection failure must not sign out a valid account. */ }
    finally { clearTimeout(timeout); checking = false; }
  }
  window.fetch = async function(input, options) {
    const token = localStorage.getItem('barterToken');
    const response = await nativeFetch(input, options);
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    const base = new URL(api, location.href);
    const headers = new Headers(options?.headers || (input instanceof Request ? input.headers : undefined));
    if (token && token === localStorage.getItem('barterToken') && url.origin === base.origin &&
        headers.get('Authorization') === `Bearer ${token}` && [401, 403].includes(response.status)) {
      const data = await response.clone().json().catch(() => ({}));
      if (['Account is inactive', 'Session revoked'].includes(data.detail)) revoke();
    }
    return response;
  };
  setInterval(checkSession, 15000);
  window.addEventListener('focus', checkSession);
  window.addEventListener('pageshow', checkSession);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSession(); });
  window.addEventListener('storage', event => {
    if ((event.key === 'barterToken' || event.key === null) && !localStorage.getItem('barterToken')) revoke();
  });
  async function resolve({adminOnly = false, memberOnly = false, optional = false} = {}) {
    const token = localStorage.getItem('barterToken');
    if (!token) {
      clear();
      if (!optional) window.location.replace('login.html');
      return null;
    }
    const response = await fetch(`${api}/users/me`, {headers: {Authorization: `Bearer ${token}`}});
    if (token !== localStorage.getItem('barterToken')) return null;
    if (response.status === 401 || response.status === 403) {
      clear();
      if (!optional) window.location.replace('login.html');
      return null;
    }
    if (!response.ok) throw new Error('Could not verify your account. Please retry.');
    const user = await response.json();
    if (token !== localStorage.getItem('barterToken')) return null;
    user.phone = user.contact || '';
    ['barterUser', 'bartifyUser'].forEach(key => localStorage.setItem(key, JSON.stringify(user)));
    if (adminOnly && user.role_id !== 2) {
      window.location.replace('dashboard.html');
      return null;
    }
    if (memberOnly && user.role_id === 2) {
      window.location.replace('adminDashboard.html');
      return null;
    }
    return user;
  }
  return {api, clear, resolve, revoke};
})();
