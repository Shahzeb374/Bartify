// ── FastAPI URL ────────────────────────────────────────────
const API_BASE_URL = 'http://127.0.0.1:8000';
const SIGNUP_PATH = '/users/signup';
const LOGIN_PATH = '/users/login';

function resolveProfileImageUrl(src) {
  if (!src) return null;
  if (/^data:|^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/uploads/')) return `${API_BASE_URL}${src}`;
  return src;
}

// ── State ─────────────────────────────────────────────────
let profilePictureFile = null;

// ── Helpers ───────────────────────────────────────────────
function showError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (input) input.classList.add('is-error');
  if (error) error.textContent = message;
}

function clearError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (input) input.classList.remove('is-error');
  if (error) error.textContent = '';
}

function clearAll() {
  clearError('fullName', 'fullNameError');
  clearError('email', 'emailError');
  clearError('password', 'passwordError');
  clearError('confirmPassword', 'confirmPasswordError');
  clearError('photoInput', 'photoError');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{6,}$/.test(password);
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signupForm');
  // if (form) form.addEventListener('submit', validateForm);

  const fullName = document.getElementById('fullName');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const photoInput = document.getElementById('photoInput');

  if (fullName) fullName.addEventListener('input', () => clearError('fullName', 'fullNameError'));
  if (email) email.addEventListener('input', () => clearError('email', 'emailError'));
  if (password) password.addEventListener('input', () => clearError('password', 'passwordError'));
  if (confirmPassword) confirmPassword.addEventListener('input', () => clearError('confirmPassword', 'confirmPasswordError'));

  if (photoInput) {
    photoInput.addEventListener('change', function () {
      const file = this.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        showError('photoInput', 'photoError', 'Image size must be less than 2MB.');
        this.value = '';
        profilePictureFile = null;
        return;
      }

      if (!file.type.startsWith('image/')) {
        showError('photoInput', 'photoError', 'Only image files are allowed.');
        this.value = '';
        profilePictureFile = null;
        return;
      }

      clearError('photoInput', 'photoError');
      profilePictureFile = file;

      const reader = new FileReader();
      reader.onload = function (e) {
        const wrap = document.getElementById('previewWrap');
        if (wrap) {
          wrap.innerHTML = `<img src="${e.target.result}" alt="Preview" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"/>`;
        }
      };
      reader.readAsDataURL(file);
    });
  }
});

// ── Main Validation & Signup ──────────────────────────────
async function validateForm(event) {
  event?.preventDefault();

  clearAll();
  let isValid = true;

  const fullNameEl = document.getElementById('fullName');
  const emailEl = document.getElementById('email');
  const passwordEl = document.getElementById('password');
  const confirmPasswordEl = document.getElementById('confirmPassword');
  const contactEl = document.getElementById('contact');

  const fullName = fullNameEl ? fullNameEl.value.trim() : '';
  const email = emailEl ? emailEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';
  const confirmPassword = confirmPasswordEl ? confirmPasswordEl.value : '';
  const contact = contactEl ? contactEl.value.trim() : '';

  if (fullName === '') {
    showError('fullName', 'fullNameError', 'Full name is required.');
    isValid = false;
  } else if (!/^[a-zA-Z\s]+$/.test(fullName)) {
    showError('fullName', 'fullNameError', 'Full name can only contain letters.');
    isValid = false;
  }

  if (email === '') {
    showError('email', 'emailError', 'Email is required.');
    isValid = false;
  } else if (!isValidEmail(email)) {
    showError('email', 'emailError', 'Please enter a valid email address.');
    isValid = false;
  }

  if (password === '') {
    showError('password', 'passwordError', 'Password is required.');
    isValid = false;
  } else if (!isStrongPassword(password)) {
    showError(
      'password',
      'passwordError',
      'Password must be 6+ characters with uppercase, number & special character.'
    );
    isValid = false;
  }

  if (confirmPassword === '') {
    showError('confirmPassword', 'confirmPasswordError', 'Please confirm your password.');
    isValid = false;
  } else if (password !== confirmPassword) {
    showError('confirmPassword', 'confirmPasswordError', 'Passwords do not match.');
    isValid = false;
  }

  if (!isValid) return false;

  try {
    const formData = new FormData();
    formData.append('name', fullName);
    formData.append('email', email);
    formData.append('password', password);
    formData.append('contact', contact || '');
    if (profilePictureFile) formData.append('user_image', profilePictureFile);

    const signupRes = await fetch(`${API_BASE_URL}${SIGNUP_PATH}`, {
      method: 'POST',
      body: formData
    });

    let signupData = {};
    try {
      signupData = await signupRes.json();
    } catch (_) {
      // JSON parse failed — surface a clear message instead of hiding it
      throw new Error('Unexpected server response. Please try again.');
    }


    if (!signupRes.ok) {
      throw new Error(signupData?.detail || signupData?.message || 'Signup failed');
    }

    localStorage.setItem('barterToken', signupData.access_token);
  const user = signupData.user || {};
  const avatar = resolveProfileImageUrl(user.avatar || user.picture || user.user_image || null);
  user.avatar = avatar;
  user.picture = resolveProfileImageUrl(user.picture || avatar);
  user.user_image = resolveProfileImageUrl(user.user_image || avatar);
  localStorage.setItem('barterUser', JSON.stringify(user));
  localStorage.setItem('bartifyUser', JSON.stringify(user));

    window.location.replace('index.html');
  } catch (err) {
    showError('email', 'emailError', err.message || 'Server error. Please try again.');
  }

  return false;
}