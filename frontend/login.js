// FastAPI URL
// const API_BASE_URL = 'http://127.0.0.1:8000';
const API_BASE_URL = 'http://192.168.100.6:8000';

// ── Helpers ───────────────────────────────────────────────
function showError(inputId, errorId, message) {
  document.getElementById(inputId).classList.add('is-error');
  document.getElementById(errorId).textContent = message;
}
function clearError(inputId, errorId) {
  document.getElementById(inputId).classList.remove('is-error');
  document.getElementById(errorId).textContent = '';
}

// ── Live clear ────────────────────────────────────────────
document.getElementById('email').addEventListener('input', () => clearError('email', 'emailError'));
document.getElementById('password').addEventListener('input', () => clearError('password', 'passwordError'));

// ── Email validation ──────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// Agar app.include_router(users.router, prefix="/users") use ho raha hai,
// to '/users/login' kar do.
const LOGIN_PATH = '/users/login';

function resolveProfileImageUrl(src) {
  if (!src) return null;
  if (/^data:|^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/uploads/')) return `${API_BASE_URL}${src}`;
  return src;
}

// ── Validate & Login ──────────────────────────────────────
async function validateLogin() {
  clearError('email', 'emailError');
  clearError('password', 'passwordError');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  let isValid = true;

  if (email === '') {
    showError('email', 'emailError', 'Email is required.');
    isValid = false;
  } else if (!isValidEmail(email)) {
    showError('email', 'emailError', 'Please enter a valid email address (e.g. user@example.com).');
    isValid = false;
  }

  if (password === '') {
    showError('password', 'passwordError', 'Password is required.');
    isValid = false;
  } else if (password.length < 6) {
    showError('password', 'passwordError', 'Password must be at least 6 characters.');
    isValid = false;
  }

  if (!isValid) return false;

  try {
    const response = await fetch(`${API_BASE_URL}${LOGIN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    let data = {};
    try { data = await response.json(); }
    catch (_) { throw new Error('Unexpected server response.'); }

    if (!response.ok) {
      throw new Error(data?.detail || 'Invalid credentials');
    }

    // backend se token + user
    if (!data.access_token) throw new Error('Login failed. Please try again.');
    localStorage.setItem('barterToken', data.access_token);
    const user = data.user || { email, name: email.split('@')[0], picture: null, avatar: null };
    const avatar = resolveProfileImageUrl(user.avatar || user.picture || user.user_image || null);
    user.avatar = avatar;
    user.picture = resolveProfileImageUrl(user.picture || avatar);
    user.user_image = resolveProfileImageUrl(user.user_image || avatar);
    localStorage.setItem('barterUser', JSON.stringify(user));
    localStorage.setItem('bartifyUser', JSON.stringify(user));

    window.location.href = 'index.html';
  } catch (err) {
    showError('password', 'passwordError', err.message || 'Server error. Please try again.');
  }

  // form submit reload rokne ke liye
  return false;
}