import { showToast } from "./toast.js";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}
// dashboard.js — toggle guest vs. user dashboard and reposition streams link

async function initDashboard() {
  // New dashboard toggling logic
  const guestDashboard = document.getElementById('guest-dashboard');
  const userDashboard = document.getElementById('user-dashboard');
  const userUpload = document.getElementById('user-upload-area');

  // Hide all by default
  if (guestDashboard) guestDashboard.style.display = 'none';
  if (userDashboard) userDashboard.style.display = 'none';
  if (userUpload) userUpload.style.display = 'none';

  const uid = getCookie('uid');
  if (!uid) {
  // Guest view: only nav
  if (guestDashboard) guestDashboard.style.display = '';
  if (userDashboard) userDashboard.style.display = 'none';
  if (userUpload) userUpload.style.display = 'none';
  const mePage = document.getElementById('me-page');
  if (mePage) mePage.style.display = 'none';
  return;
}

  try {
    const res = await fetch(`/me/${uid}`);
    if (!res.ok) throw new Error('Not authorized');
    const data = await res.json();

    // Logged-in view
    // Restore links section and show-me link
    const linksSection = document.getElementById('links');
    if (linksSection) linksSection.style.display = '';
    const showMeLink = document.getElementById('show-me');
    if (showMeLink && showMeLink.parentElement) showMeLink.parentElement.style.display = '';
    // Show me-page for logged-in users
    const mePage = document.getElementById('me-page');
    if (mePage) mePage.style.display = '';
    // Ensure upload area is visible if last_page was me-page
    const userUpload = document.getElementById('user-upload-area');
    if (userUpload && localStorage.getItem('last_page') === 'me-page') {
      // userUpload visibility is now only controlled by nav.js SPA logic
    }

    // Remove guest warning if present
    const guestMsg = document.getElementById('guest-warning-msg');
    if (guestMsg && guestMsg.parentNode) guestMsg.parentNode.removeChild(guestMsg);
    userDashboard.style.display = '';

    // Set audio source
    const meAudio = document.getElementById('me-audio');
    if (meAudio && uid) {
      meAudio.src = `/audio/${encodeURIComponent(uid)}/stream.opus`;
    }

    // Update quota
    const quotaBar = document.getElementById('quota-bar');
    const quotaText = document.getElementById('quota-text');
    if (quotaBar) quotaBar.value = data.quota;
    if (quotaText) quotaText.textContent = `${data.quota} MB used`;

    // Ensure Streams link remains in nav, not moved
    // (No action needed if static)
  } catch (e) {
    console.warn('Dashboard init error, treating as guest:', e);
    
    userUpload.style.display = '';
    userDashboard.style.display = 'none';
    const registerLink = document.getElementById('guest-login');
    const streamsLink = document.getElementById('guest-streams');
    if (registerLink && streamsLink) {
      registerLink.parentElement.insertAdjacentElement('afterend', streamsLink.parentElement);
    }
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);

// Registration form handler for guests
// Handles the submit event on #register-form, sends data to /register, and alerts the user with the result

document.addEventListener('DOMContentLoaded', () => {
  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(regForm);
      try {
        const res = await fetch('/register', {
          method: 'POST',
          body: formData
        });
        let data;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await res.json();
        } else {
          data = { detail: await res.text() };
        }
        if (res.ok) {
          showToast('Confirmation sent! Check your email.');
        } else {
          showToast('Registration failed: ' + (data.detail || res.status));
        }
      } catch (err) {
        showToast('Network error: ' + err);
      }
    });
  }
});


// Connect Login or Register link to register form

document.addEventListener('DOMContentLoaded', () => {
  // Login/Register (guest)
  const loginLink = document.getElementById('guest-login');
  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('main > section').forEach(sec => {
        sec.hidden = sec.id !== 'register-page';
      });
      const reg = document.getElementById('register-page');
      if (reg) reg.hidden = false;
      reg.scrollIntoView({behavior:'smooth'});
    });
  }
  // Terms of Service (all dashboards)
  const termsLinks = [
    document.getElementById('guest-terms'),
    document.getElementById('user-terms')
  ];
  termsLinks.forEach(link => {
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('main > section').forEach(sec => {
          sec.hidden = sec.id !== 'terms-page';
        });
        const terms = document.getElementById('terms-page');
        if (terms) terms.hidden = false;
        terms.scrollIntoView({behavior:'smooth'});
      });
    }
  });

  // Imprint (all dashboards)
  const imprintLinks = [
    document.getElementById('guest-imprint'),
    document.getElementById('user-imprint')
  ];
  imprintLinks.forEach(link => {
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('main > section').forEach(sec => {
          sec.hidden = sec.id !== 'imprint-page';
        });
        const imprint = document.getElementById('imprint-page');
        if (imprint) imprint.hidden = false;
        imprint.scrollIntoView({behavior:'smooth'});
      });
    }
  });

  // Privacy Policy (all dashboards)
  const privacyLinks = [
    document.getElementById('guest-privacy'),
    document.getElementById('user-privacy')
  ];
  privacyLinks.forEach(link => {
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('main > section').forEach(sec => {
          sec.hidden = sec.id !== 'privacy-page';
        });
        const privacy = document.getElementById('privacy-page');
        if (privacy) privacy.hidden = false;
        privacy.scrollIntoView({behavior:'smooth'});
      });
    }
  });
});
