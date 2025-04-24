// dashboard.js — toggle guest vs. user dashboard and reposition streams link

async function initDashboard() {
  const uploadArea = document.querySelector('#upload-area');
  const userDashboard = document.querySelector('#me-page');
  const meAudio = document.querySelector('#me-audio');
  const quotaBar = document.querySelector('#quota-bar');
  const quotaText = document.querySelector('#quota-text');
  const streamsLink = document.querySelector('#show-streams');
  const registerLink = document.querySelector('#show-register');

  // Default state: hide both
  uploadArea.hidden = true;
  userDashboard.hidden = true;

  const uid = localStorage.getItem('uid');
  if (!uid) {
    // Guest: only upload area and move Streams next to Register
    uploadArea.hidden = false;
    userDashboard.hidden = true;
    if (registerLink && streamsLink) {
      registerLink.parentElement.insertAdjacentElement('afterend', streamsLink.parentElement);
    }
    return;
  }

  try {
    const res = await fetch(`/me/${uid}`);
    if (!res.ok) throw new Error('Not authorized');
    const data = await res.json();

    // Logged-in view
    uploadArea.hidden = false;
    userDashboard.hidden = false;

    // Set audio source
    meAudio.src = data.stream_url;
    // Update quota
    quotaBar.value = data.quota;
    quotaText.textContent = `${data.quota} MB used`;

    // Ensure Streams link remains in nav, not moved
    // (No action needed if static)
  } catch (e) {
    console.warn('Dashboard init error, treating as guest:', e);
    localStorage.removeItem('uid');
    uploadArea.hidden = false;
    userDashboard.hidden = true;
    if (registerLink && streamsLink) {
      registerLink.parentElement.insertAdjacentElement('afterend', streamsLink.parentElement);
    }
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);
