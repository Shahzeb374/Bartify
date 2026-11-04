// Each field controls its own visibility; passwords remain hidden by default.
document.querySelectorAll('.password-toggle').forEach(button => {
  const input = document.getElementById(button.getAttribute('aria-controls'));
  if (!input) return;
  const label = input.id === 'confirmPassword' ? 'confirm password' : 'password';
  function setVisible(visible) {
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Hide' : 'Show';
    button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${label}`);
    button.setAttribute('aria-pressed', String(visible));
  }
  button.addEventListener('click', () => setVisible(input.type === 'password'));
  input.form?.addEventListener('reset', () => setVisible(false));
});
