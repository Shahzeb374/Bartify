// Roles are always fetched from the server; localStorage is only a UI cache.
window.BartifySession = (() => {
  const api = 'http://127.0.0.1:8000';
  function clear() {
    ['barterToken', 'barterUser', 'bartifyUser'].forEach(key => localStorage.removeItem(key));
  }
  async function resolve({adminOnly = false, memberOnly = false, optional = false} = {}) {
    const token = localStorage.getItem('barterToken');
    if (!token) {
      clear();
      if (!optional) window.location.replace('login.html');
      return null;
    }
    const response = await fetch(`${api}/users/me`, {headers: {Authorization: `Bearer ${token}`}});
    if (response.status === 401 || response.status === 403) {
      clear();
      if (!optional) window.location.replace('login.html');
      return null;
    }
    if (!response.ok) throw new Error('Could not verify your account. Please retry.');
    const user = await response.json();
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
  return {api, clear, resolve};
})();
