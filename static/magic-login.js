// static/magic-login.js — handles magic‑link token UI
import { showOnly } from './router.js';

export function initMagicLogin() {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  if (token) {
    const tokenInput = document.getElementById('magic-token');
    if (tokenInput) tokenInput.value = token;
    showOnly('magic-login-page');
    const err = params.get('error');
    if (err) {
      const box = document.getElementById('magic-error');
      box.textContent = decodeURIComponent(err);
      box.style.display = 'block';
    }
  }
}
