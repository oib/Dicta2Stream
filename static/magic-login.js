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
        // Generate a simple auth token (in a real app, this would come from the server)
        const authToken = 'token-' + Math.random().toString(36).substring(2, 15);
        
        // Set cookies and localStorage for SPA session logic
        document.cookie = `uid=${encodeURIComponent(confirmedUid)}; path=/`;
        document.cookie = `authToken=${authToken}; path=/`;
        
        // Store in localStorage for client-side access
        localStorage.setItem('uid', confirmedUid);
        localStorage.setItem('confirmed_uid', confirmedUid);
        localStorage.setItem('authToken', authToken);
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
        // Generate a simple auth token (in a real app, this would come from the server)
        const authToken = 'token-' + Math.random().toString(36).substring(2, 15);
        
        // Set cookies and localStorage for SPA session logic
        document.cookie = `uid=${encodeURIComponent(data.confirmed_uid)}; path=/`;
        document.cookie = `authToken=${authToken}; path=/`;
        
        // Store in localStorage for client-side access
        localStorage.setItem('uid', data.confirmed_uid);
        localStorage.setItem('confirmed_uid', data.confirmed_uid);
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('uid_time', Date.now().toString());
        import('./toast.js').then(({ showToast }) => {
          showToast('✅ Login successful!');
          // Update UI state after login
          const guestDashboard = document.getElementById('guest-dashboard');
          const userDashboard = document.getElementById('user-dashboard');
          const registerPage = document.getElementById('register-page');
          
          if (guestDashboard) guestDashboard.style.display = 'none';
          if (userDashboard) userDashboard.style.display = 'block';
          if (registerPage) registerPage.style.display = 'none';
          
          // Show the user's stream page
          if (window.showOnly) {
            window.showOnly('me-page');
          }
        });
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
