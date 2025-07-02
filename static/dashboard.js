import { showToast } from "./toast.js";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}
// dashboard.js — toggle guest vs. user dashboard and reposition streams link

// Logout function
let isLoggingOut = false;

async function handleLogout(event) {
  // Prevent multiple simultaneous logout attempts
  if (isLoggingOut) return;
  isLoggingOut = true;
  
  // Prevent default button behavior
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  try {
    console.log('[LOGOUT] Starting logout process');
    
    // Clear user data from localStorage
    localStorage.removeItem('uid');
    localStorage.removeItem('uid_time');
    localStorage.removeItem('confirmed_uid');
    localStorage.removeItem('last_page');
    
    // Clear cookie
    document.cookie = 'uid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    
    // Update UI state immediately
    const userDashboard = document.getElementById('user-dashboard');
    const guestDashboard = document.getElementById('guest-dashboard');
    const logoutButton = document.getElementById('logout-button');
    const deleteAccountButton = document.getElementById('delete-account-button');
    
    if (userDashboard) userDashboard.style.display = 'none';
    if (guestDashboard) guestDashboard.style.display = 'block';
    if (logoutButton) logoutButton.style.display = 'none';
    if (deleteAccountButton) deleteAccountButton.style.display = 'none';
    
    // Show success message (only once)
    if (window.showToast) {
      showToast('Logged out successfully');
    } else {
      console.log('Logged out successfully');
    }
    
    // Navigate to register page
    if (window.showOnly) {
      window.showOnly('register-page');
    } else {
      // Fallback to URL change if showOnly isn't available
      window.location.href = '/#register-page';
    }
    
    console.log('[LOGOUT] Logout completed');
    
  } catch (error) {
    console.error('[LOGOUT] Logout failed:', error);
    if (window.showToast) {
      showToast('Logout failed. Please try again.');
    }
  } finally {
    isLoggingOut = false;
  }
}

// Delete account function
async function handleDeleteAccount() {
  try {
    const uid = localStorage.getItem('uid');
    if (!uid) {
      showToast('No user session found. Please log in again.');
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm('⚠️ WARNING: This will permanently delete your account and all your data. This action cannot be undone.\n\nAre you sure you want to delete your account?');
    
    if (!confirmed) {
      return; // User cancelled the deletion
    }

    // Show loading state
    const deleteButton = document.getElementById('delete-account-button');
    const originalText = deleteButton.textContent;
    deleteButton.disabled = true;
    deleteButton.textContent = 'Deleting...';

    // Call the delete account endpoint
    const response = await fetch(`/api/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid }),
    });

    const result = await response.json();

    if (response.ok) {
      showToast('Account deleted successfully');
      
      // Clear user data
      localStorage.removeItem('uid');
      localStorage.removeItem('uid_time');
      localStorage.removeItem('confirmed_uid');
      document.cookie = 'uid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      
      // Redirect to home page
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } else {
      throw new Error(result.detail || 'Failed to delete account');
    }
  } catch (error) {
    console.error('Delete account failed:', error);
    showToast(`Failed to delete account: ${error.message}`);
    
    // Reset button state
    const deleteButton = document.getElementById('delete-account-button');
    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.textContent = '🗑️ Delete Account';
    }
  }
}

async function initDashboard() {
  console.log('[DASHBOARD] Initializing dashboard...');
  
  // Get all dashboard elements
  const guestDashboard = document.getElementById('guest-dashboard');
  const userDashboard = document.getElementById('user-dashboard');
  const userUpload = document.getElementById('user-upload-area');
  const logoutButton = document.getElementById('logout-button');
  const deleteAccountButton = document.getElementById('delete-account-button');
  
  console.log('[DASHBOARD] Elements found:', {
    guestDashboard: !!guestDashboard,
    userDashboard: !!userDashboard,
    userUpload: !!userUpload,
    logoutButton: !!logoutButton,
    deleteAccountButton: !!deleteAccountButton
  });
  
  // Add click event listeners for logout and delete account buttons
  if (logoutButton) {
    console.log('[DASHBOARD] Adding logout button handler');
    logoutButton.addEventListener('click', handleLogout);
  }
  
  if (deleteAccountButton) {
    console.log('[DASHBOARD] Adding delete account button handler');
    deleteAccountButton.addEventListener('click', (e) => {
      e.preventDefault();
      handleDeleteAccount();
    });
  }

  const uid = getCookie('uid');
  console.log('[DASHBOARD] UID from cookie:', uid);
  
  // Guest view
  if (!uid) {
    console.log('[DASHBOARD] No UID found, showing guest dashboard');
    if (guestDashboard) guestDashboard.style.display = 'block';
    if (userDashboard) userDashboard.style.display = 'none';
    if (userUpload) userUpload.style.display = 'none';
    if (logoutButton) logoutButton.style.display = 'none';
    if (deleteAccountButton) deleteAccountButton.style.display = 'none';
    const mePage = document.getElementById('me-page');
    if (mePage) mePage.style.display = 'none';
    return;
  }
  
  // Logged-in view - show user dashboard by default
  console.log('[DASHBOARD] User is logged in, showing user dashboard');
  
  // Log current display states
  console.log('[DASHBOARD] Current display states:', {
    guestDashboard: guestDashboard ? window.getComputedStyle(guestDashboard).display : 'not found',
    userDashboard: userDashboard ? window.getComputedStyle(userDashboard).display : 'not found',
    userUpload: userUpload ? window.getComputedStyle(userUpload).display : 'not found',
    logoutButton: logoutButton ? window.getComputedStyle(logoutButton).display : 'not found',
    deleteAccountButton: deleteAccountButton ? window.getComputedStyle(deleteAccountButton).display : 'not found'
  });
  
  // Show delete account button for logged-in users
  if (deleteAccountButton) {
    deleteAccountButton.style.display = 'block';
    console.log('[DASHBOARD] Showing delete account button');
  }
  
  // Hide guest dashboard
  if (guestDashboard) {
    console.log('[DASHBOARD] Hiding guest dashboard');
    guestDashboard.style.display = 'none';
  }
  
  // Show user dashboard
  if (userDashboard) {
    console.log('[DASHBOARD] Showing user dashboard');
    userDashboard.style.display = 'block';
    userDashboard.style.visibility = 'visible';
    userDashboard.hidden = false;
    
    // Debug: Check if the element is actually in the DOM
    console.log('[DASHBOARD] User dashboard parent:', userDashboard.parentElement);
    console.log('[DASHBOARD] User dashboard computed display:', window.getComputedStyle(userDashboard).display);
  } else {
    console.error('[DASHBOARD] userDashboard element not found!');
  }
  
  // Show essential elements for logged-in users
  const linksSection = document.getElementById('links');
  if (linksSection) {
    console.log('[DASHBOARD] Showing links section');
    linksSection.style.display = 'block';
  }
  
  const showMeLink = document.getElementById('show-me');
  if (showMeLink && showMeLink.parentElement) {
    console.log('[DASHBOARD] Showing show-me link');
    showMeLink.parentElement.style.display = 'block';
  }
  
  // Show me-page for logged-in users
  const mePage = document.getElementById('me-page');
  if (mePage) {
    console.log('[DASHBOARD] Showing me-page');
    mePage.style.display = 'block';
  }

  try {
    console.log(`[DEBUG] Fetching user data for UID: ${uid}`);
    const res = await fetch(`/me/${uid}`);
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[ERROR] Failed to fetch user data: ${res.status} ${res.statusText}`, errorText);
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('[DEBUG] User data loaded:', data);
    
    // Ensure upload area is visible if last_page was me-page
    if (userUpload && localStorage.getItem('last_page') === 'me-page') {
      // userUpload visibility is now only controlled by nav.js SPA logic
    }

    // Remove guest warning if present
    const guestMsg = document.getElementById('guest-warning-msg');
    if (guestMsg && guestMsg.parentNode) guestMsg.parentNode.removeChild(guestMsg);
    // Show user dashboard and logout button
    if (userDashboard) userDashboard.style.display = '';
    if (logoutButton) {
      logoutButton.style.display = 'block';
      logoutButton.onclick = handleLogout;
    }

    // Set audio source
    const meAudio = document.getElementById('me-audio');
    if (meAudio && data && data.username) {
      // Use username instead of UID for the audio file path
      meAudio.src = `/audio/${encodeURIComponent(data.username)}/stream.opus?t=${Date.now()}`;
      console.log('Setting audio source to:', meAudio.src);
    } else if (meAudio && uid) {
      // Fallback to UID if username is not available
      meAudio.src = `/audio/${encodeURIComponent(uid)}/stream.opus?t=${Date.now()}`;
      console.warn('Using UID fallback for audio source:', meAudio.src);
    }

    // Update quota and ensure quota meter is visible
    const quotaMeter = document.getElementById('quota-meter');
    const quotaBar = document.getElementById('quota-bar');
    const quotaText = document.getElementById('quota-text');
    if (quotaBar) quotaBar.value = data.quota;
    if (quotaText) quotaText.textContent = `${data.quota} MB used`;
    if (quotaMeter) {
      quotaMeter.hidden = false;
      quotaMeter.style.display = 'block'; // Ensure it's not hidden by display:none
    }
    
    // Fetch and display the list of uploaded files if the function is available
    if (window.fetchAndDisplayFiles) {
      window.fetchAndDisplayFiles(uid);
    }

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
