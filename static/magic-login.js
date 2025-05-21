// static/magic-login.js — handles magic‑link token UI
import { showOnly } from './router.js';

let magicLoginSubmitted = false;

export async function initMagicLogin() {
  console.debug('[magic-login] initMagicLogin called');
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  if (!token) {
    console.debug('[magic-login] No token in URL');
    return;
  }
  // Remove token from URL immediately to prevent loops
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  window.history.replaceState({}, document.title, url.pathname + url.search);
  try {
    const formData = new FormData();
    formData.append('token', token);
    const res = await fetch('/magic-login', {
      method: 'POST',
      body: formData,
    });
    if (res.redirected) {
      // If redirected, backend should set cookie; but set localStorage for SPA
      const url = new URL(res.url);
      const confirmedUid = url.searchParams.get('confirmed_uid');
      if (confirmedUid) {
        document.cookie = "uid=" + encodeURIComponent(confirmedUid) + "; path=/";
        // Set localStorage for SPA session logic instantly
        localStorage.setItem('uid', confirmedUid);
        localStorage.setItem('confirmed_uid', confirmedUid);
        localStorage.setItem('uid_time', Date.now().toString());
      }
      window.location.href = res.url;
      return;
    }
    // If not redirected, show error (shouldn't happen in normal flow)
    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
      if (data && data.confirmed_uid) {
        document.cookie = "uid=" + encodeURIComponent(data.confirmed_uid) + "; path=/";
        // Set localStorage for SPA session logic
        localStorage.setItem('uid', data.confirmed_uid);
        localStorage.setItem('confirmed_uid', data.confirmed_uid);
        localStorage.setItem('uid_time', Date.now().toString());
        import('./toast.js').then(({ showToast }) => showToast('✅ Login successful!'));
        // Optionally reload or navigate
        setTimeout(() => location.reload(), 700);
        return;
      }
      alert(data.detail || 'Login failed.');
    } else {
      const text = await res.text();
      alert(text || 'Login failed.');
    }
  } catch (err) {
    alert('Network error: ' + err);
  }
}
