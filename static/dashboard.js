import { showToast } from "./toast.js";

// Utility function to get cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}
// dashboard.js — toggle guest vs. user dashboard and reposition streams link

// Global state
let isLoggingOut = false;

async function handleLogout(event) {
  console.log('[LOGOUT] Logout initiated');
  // Prevent multiple simultaneous logout attempts
  if (isLoggingOut) {
    console.log('[LOGOUT] Logout already in progress');
    return;
  }
  isLoggingOut = true;
  
  // Prevent default button behavior
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  // Get auth token before we clear it
  const authToken = localStorage.getItem('authToken');
  
  // 1. First try to invalidate the server session (but don't block on it)
  if (authToken) {
    try {
      // We'll use a timeout to prevent hanging on the server request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      try {
        await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
        });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        // Silently handle any errors during server logout
      }
    } catch (error) {
      // Silently handle any unexpected errors
    }
  }
  
  // 2. Clear all client-side state
  function clearClientState() {
    console.log('[LOGOUT] Clearing client state');
    
    // Clear all authentication-related data from localStorage
    const keysToRemove = [
      'uid', 'uid_time', 'confirmed_uid', 'last_page',
      'isAuthenticated', 'authToken', 'user', 'token', 'sessionid'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    // Get current cookies for debugging
    const cookies = document.cookie.split(';');
    console.log('[LOGOUT] Current cookies before clearing:', cookies);
    
    // Function to clear a cookie by name
    const clearCookie = (name) => {
      console.log(`[LOGOUT] Attempting to clear cookie: ${name}`);
      const baseOptions = 'Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
      // Try with current domain
      document.cookie = `${name}=; ${baseOptions}`;
      // Try with domain
      document.cookie = `${name}=; ${baseOptions}; domain=${window.location.hostname}`;
      // Try with leading dot for subdomains
      document.cookie = `${name}=; ${baseOptions}; domain=.${window.location.hostname}`;
    };
    
    // Clear all authentication-related cookies
    const authCookies = [
      'uid', 'authToken', 'isAuthenticated', 'sessionid', 'session_id',
      'token', 'remember_token', 'auth', 'authentication'
    ];
    
    // Clear specific auth cookies
    authCookies.forEach(clearCookie);
    
    // Also clear any existing cookies that match our patterns
    cookies.forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (name && authCookies.some(authName => name.trim() === authName)) {
        clearCookie(name.trim());
      }
    });
    
    // Clear all cookies by setting them to expire in the past
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (name) {
        clearCookie(name.trim());
      }
    });
    
    console.log('[LOGOUT] Cookies after clearing:', document.cookie);
    
    // Update UI state
    document.body.classList.remove('authenticated');
    document.body.classList.add('guest');
    
    // Force a hard reload to ensure all state is reset
    setTimeout(() => {
      // Clear all storage again before redirecting
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // Redirect to home with a cache-busting parameter
      window.location.href = '/?logout=' + Date.now();
    }, 100);
  }
  
  try {
    // Clear client state immediately to prevent any race conditions
    clearClientState();
    
    // 2. Try to invalidate the server session (but don't block on it)
    console.log('[LOGOUT] Auth token exists:', !!authToken);
    if (authToken) {
      try {
        console.log('[LOGOUT] Attempting to invalidate server session');
        
        const response = await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
        });
        
        if (!response.ok && response.status !== 401) {
          console.warn(`[LOGOUT] Server returned ${response.status} during logout`);
          // Don't throw - we've already cleared client state
        } else {
          console.log('[LOGOUT] Server session invalidated successfully');
        }
      } catch (error) {
        console.warn('[LOGOUT] Error during server session invalidation (non-critical):', error);
        // Continue with logout process
      }
    }
    
    // 3. Update navigation if the function exists
    if (typeof injectNavigation === 'function') {
      injectNavigation(false);
    }
    
    console.log('[LOGOUT] Logout completed');
    
  } catch (error) {
    console.error('[LOGOUT] Logout failed:', error);
    if (window.showToast) {
      showToast('Logout failed. Please try again.');
    }
  } finally {
    isLoggingOut = false;
    
    // 4. Redirect to home page after a short delay to ensure state is cleared
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
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

// Debug function to check element visibility and styles
function debugElementVisibility(elementId) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`[DEBUG] Element ${elementId} not found`);
    return {};
  }
  const style = window.getComputedStyle(el);
  return {
    id: elementId,
    exists: true,
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    hidden: el.hidden,
    classList: Array.from(el.classList),
    parentDisplay: el.parentElement ? window.getComputedStyle(el.parentElement).display : 'no-parent',
    parentVisibility: el.parentElement ? window.getComputedStyle(el.parentElement).visibility : 'no-parent',
    rect: el.getBoundingClientRect()
  };
}

/**
 * Initialize the dashboard and handle authentication state
 */
async function initDashboard() {
  console.log('[DASHBOARD] Initializing dashboard...');
  
  // Get all dashboard elements
  const guestDashboard = document.getElementById('guest-dashboard');
  const userDashboard = document.getElementById('user-dashboard');
  const userUpload = document.getElementById('user-upload-area');
  const logoutButton = document.getElementById('logout-button');
  const deleteAccountButton = document.getElementById('delete-account-button');
  const fileList = document.getElementById('file-list');
  
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
  
  // Check authentication state - consolidated to avoid duplicate declarations
  const hasAuthCookie = document.cookie.includes('isAuthenticated=true');
  const hasUidCookie = document.cookie.includes('uid=');
  const hasLocalStorageAuth = localStorage.getItem('isAuthenticated') === 'true';
  const hasAuthToken = localStorage.getItem('authToken') !== null;
  const isAuthenticated = hasAuthCookie || hasUidCookie || hasLocalStorageAuth || hasAuthToken;
  
  // Ensure body class reflects authentication state
  if (isAuthenticated) {
    document.body.classList.add('authenticated');
    document.body.classList.remove('guest-mode');
  } else {
    document.body.classList.remove('authenticated');
    document.body.classList.add('guest-mode');
  }
  
  // Debug authentication state
  console.log('[AUTH] Authentication state:', {
    hasAuthCookie,
    hasUidCookie,
    hasLocalStorageAuth,
    hasAuthToken,
    isAuthenticated,
    cookies: document.cookie,
    localStorage: {
      isAuthenticated: localStorage.getItem('isAuthenticated'),
      uid: localStorage.getItem('uid'),
      authToken: localStorage.getItem('authToken') ? 'present' : 'not present'
    },
    bodyClasses: document.body.className
  });
  
  // Handle authenticated user
  if (isAuthenticated) {
    console.log('[DASHBOARD] User is authenticated, showing user dashboard');
    if (userDashboard) userDashboard.style.display = 'block';
    if (userUpload) userUpload.style.display = 'block';
    if (guestDashboard) guestDashboard.style.display = 'none';
    
    // Add authenticated class to body if not present
    document.body.classList.add('authenticated');
    
    // Get UID from cookies or localStorage
    let uid = getCookie('uid') || localStorage.getItem('uid');
    
    if (!uid) {
      console.warn('[DASHBOARD] No UID found in cookies or localStorage');
      // Try to get UID from the URL or hash fragment
      const urlParams = new URLSearchParams(window.location.search);
      uid = urlParams.get('uid') || window.location.hash.substring(1);
      
      if (uid) {
        console.log(`[DASHBOARD] Using UID from URL/hash: ${uid}`);
        localStorage.setItem('uid', uid);
      } else {
        console.error('[DASHBOARD] No UID available for file listing');
        if (fileList) {
          fileList.innerHTML = `
            <li class="error-message">
              Error: Could not determine user account. Please <a href="/#login" class="login-link">log in</a> again.
            </li>`;
        }
        return;
      }
    }
    
    // Initialize file listing if we have a UID
    if (window.fetchAndDisplayFiles) {
      console.log(`[DASHBOARD] Initializing file listing for UID: ${uid}`);
      try {
        await window.fetchAndDisplayFiles(uid);
      } catch (error) {
        console.error('[DASHBOARD] Error initializing file listing:', error);
        if (fileList) {
          fileList.innerHTML = `
            <li class="error-message">
              Error loading files: ${error.message || 'Unknown error'}. 
              Please <a href="/#login" class="login-link">log in</a> again.
            </li>`;
        }
      }
    }
  } else {
    // Guest view
    console.log('[DASHBOARD] User not authenticated, showing guest dashboard');
    if (guestDashboard) guestDashboard.style.display = 'block';
    if (userDashboard) userDashboard.style.display = 'none';
    if (userUpload) userUpload.style.display = 'none';
    
    // Remove authenticated class if present
    document.body.classList.remove('authenticated');
    
    // Show login prompt
    if (fileList) {
      fileList.innerHTML = `
        <li class="error-message">
          Please <a href="/#login" class="login-link">log in</a> to view your files.
        </li>`;
    }
  }

  // Log authentication details for debugging
  console.log('[DASHBOARD] Authentication details:', {
    uid: getCookie('uid') || localStorage.getItem('uid'),
    cookies: document.cookie,
    localStorage: {
      uid: localStorage.getItem('uid'),
      isAuthenticated: localStorage.getItem('isAuthenticated'),
      authToken: localStorage.getItem('authToken') ? 'present' : 'not present'
    }
  });
  
  // If not authenticated, show guest view and return early
  if (!isAuthenticated) {
    console.log('[DASHBOARD] User not authenticated, showing guest dashboard');
    if (guestDashboard) guestDashboard.style.display = 'block';
    if (userDashboard) userDashboard.style.display = 'none';
    if (userUpload) userUpload.style.display = 'none';
    
    // Remove authenticated class if present
    document.body.classList.remove('authenticated');
    
    // Show login prompt
    if (fileList) {
      fileList.innerHTML = `
        <li class="error-message">
          Please <a href="/#login" class="login-link">log in</a> to view your files.
        </li>`;
    }
    return;
  }
  
  // Logged-in view - show user dashboard
  console.log('[DASHBOARD] User is logged in, showing user dashboard');
  
  // Get all page elements
  const mePage = document.getElementById('me-page');
  
  // Log current display states for debugging
  console.log('[DASHBOARD] Updated display states:', {
    guestDashboard: guestDashboard ? window.getComputedStyle(guestDashboard).display : 'not found',
    userDashboard: userDashboard ? window.getComputedStyle(userDashboard).display : 'not found',
    userUpload: userUpload ? window.getComputedStyle(userUpload).display : 'not found',
    logoutButton: logoutButton ? window.getComputedStyle(logoutButton).display : 'not found',
    deleteAccountButton: deleteAccountButton ? window.getComputedStyle(deleteAccountButton).display : 'not found',
    mePage: mePage ? window.getComputedStyle(mePage).display : 'not found'
  });
  
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
    
    // Log final visibility state after changes
    console.log('[DEBUG] Final visibility state after showing user dashboard:', {
      userDashboard: debugElementVisibility('user-dashboard'),
      guestDashboard: debugElementVisibility('guest-dashboard'),
      computedDisplay: window.getComputedStyle(userDashboard).display,
      computedVisibility: window.getComputedStyle(userDashboard).visibility
    });
    
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
  if (mePage) {
    console.log('[DASHBOARD] Showing me-page');
    mePage.style.display = 'block';
  }

  try {
    // Try to get UID from various sources
    let uid = getCookie('uid') || localStorage.getItem('uid');
    
    // If we have a valid UID, try to fetch user data
    if (uid && uid !== 'welcome-page' && uid !== 'undefined' && uid !== 'null') {
      console.log('[DASHBOARD] Found valid UID:', uid);
      console.log(`[DEBUG] Fetching user data for UID: ${uid}`);
      const response = await fetch(`/me/${uid}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ERROR] Failed to fetch user data: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Parse and handle the response data
      const data = await response.json();
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
      const username = data?.username || '';
      
      if (meAudio) {
        if (username) {
          // Use username for the audio file path if available
          meAudio.src = `/audio/${encodeURIComponent(username)}/stream.opus?t=${Date.now()}`;
          console.log('Setting audio source to:', meAudio.src);
        } else if (uid) {
          // Fallback to UID if username is not available
          meAudio.src = `/audio/${encodeURIComponent(uid)}/stream.opus?t=${Date.now()}`;
          console.warn('Using UID fallback for audio source:', meAudio.src);
        }
      }

      // Update quota and ensure quota meter is visible if data is available
      const quotaMeter = document.getElementById('quota-meter');
      const quotaBar = document.getElementById('quota-bar');
      const quotaText = document.getElementById('quota-text');
      
      if (quotaBar && data.quota !== undefined) {
        quotaBar.value = data.quota;
      }
      
      if (quotaText && data.quota !== undefined) {
        quotaText.textContent = `${data.quota} MB`;
      }
      
      if (quotaMeter) {
        quotaMeter.hidden = false;
        quotaMeter.style.display = 'block'; // Ensure it's not hidden by display:none
      }
      
      // Fetch and display the list of uploaded files if the function is available
      if (window.fetchAndDisplayFiles) {
        console.log('[DASHBOARD] Calling fetchAndDisplayFiles with UID:', uid);
        // Ensure we have the most up-to-date UID from the response data if available
        const effectiveUid = data?.uid || uid;
        console.log('[DASHBOARD] Using effective UID:', effectiveUid);
        window.fetchAndDisplayFiles(effectiveUid);
      } else {
        console.error('[DASHBOARD] fetchAndDisplayFiles function not found!');
      }
    } else {
      // No valid UID found, ensure we're in guest mode
      console.log('[DASHBOARD] No valid UID found, showing guest dashboard');
      userDashboard.style.display = 'none';
      guestDashboard.style.display = 'block';
      userUpload.style.display = 'none';
      document.body.classList.remove('authenticated');
      return; // Exit early for guest users
    }

    // Ensure Streams link remains in nav, not moved
    // (No action needed if static)
  } catch (e) {
    console.warn('Dashboard init error, falling back to guest mode:', e);
    
    // Ensure guest UI is shown
    userUpload.style.display = 'none';
    userDashboard.style.display = 'none';
    if (guestDashboard) guestDashboard.style.display = 'block';
    
    // Update body classes
    document.body.classList.remove('authenticated');
    document.body.classList.add('guest-mode');
    
    // Ensure navigation is in correct state
    const registerLink = document.getElementById('guest-login');
    const streamsLink = document.getElementById('guest-streams');
    if (registerLink && streamsLink) {
      registerLink.parentElement.insertAdjacentElement('afterend', streamsLink.parentElement);
    }
  }
}

// Delete file function is defined below with more complete implementation

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Function to fetch and display user's uploaded files
async function fetchAndDisplayFiles(uid) {
  const fileList = document.getElementById('file-list');
  
  if (!fileList) {
    console.error('[FILES] File list element not found');
    return;
  }
  
  console.log(`[FILES] Fetching files for user: ${uid}`);
  fileList.innerHTML = '<li class="loading-message">Loading your files...</li>';
  
  // Prepare headers with auth token if available
  const authToken = localStorage.getItem('authToken');
  const headers = { 
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  console.log('[FILES] Making request to /me with headers:', headers);
  
  try {
    // The backend should handle authentication via session cookies
    // We include the auth token in headers if available, but don't rely on it for auth
    console.log(`[FILES] Making request to /me/${uid} with credentials...`);
    const response = await fetch(`/me/${uid}`, {
      method: 'GET',
      credentials: 'include',  // Important: include cookies for session auth
      headers: headers
    });
    
    console.log('[FILES] Response status:', response.status);
    console.log('[FILES] Response headers:', Object.fromEntries([...response.headers.entries()]));
    
    // Get response as text first to handle potential JSON parsing errors
    const responseText = await response.text();
    console.log('[FILES] Raw response text:', responseText);
    
    // Parse the JSON response
    let responseData = {};
    if (responseText && responseText.trim() !== '') {
      try {
        responseData = JSON.parse(responseText);
        console.log('[FILES] Successfully parsed JSON response:', responseData);
      } catch (e) {
        console.error('[FILES] Failed to parse JSON response. Response text:', responseText);
        console.error('[FILES] Error details:', e);
        
        // If we have a non-JSON response but the status is 200, try to handle it
        if (response.ok) {
          console.warn('[FILES] Non-JSON response with 200 status, treating as empty response');
        } else {
          throw new Error(`Invalid JSON response from server: ${e.message}`);
        }
      }
    } else {
      console.log('[FILES] Empty response received, using empty object');
    }
    
    // Note: Authentication is handled by the parent component
    // We'll just handle the response status without clearing auth state
    
    if (response.ok) {
      // Check if the response has the expected format
      if (!responseData || !Array.isArray(responseData.files)) {
        console.error('[FILES] Invalid response format, expected {files: [...]}:', responseData);
        fileList.innerHTML = '<li>Error: Invalid response from server</li>';
        return;
      }
      
      const files = responseData.files;
      console.log('[FILES] Files array:', files);
      
      if (files.length === 0) {
        fileList.innerHTML = '<li class="no-files">No files uploaded yet.</li>';
        return;
      }
      
      // Clear the loading message
      fileList.innerHTML = '';
      
      // Track displayed files to prevent duplicates using stored filenames as unique identifiers
      const displayedFiles = new Set();
      
      // Add each file to the list
      files.forEach(file => {
        // Get the stored filename (with UUID) - this is our unique identifier
        const storedFileName = file.stored_name || file.name || file;
        
        // Skip if we've already displayed this file
        if (displayedFiles.has(storedFileName)) {
          console.log(`[FILES] Skipping duplicate file with stored name: ${storedFileName}`);
          return;
        }
        
        displayedFiles.add(storedFileName);
        
        const fileExt = storedFileName.split('.').pop().toLowerCase();
        const fileUrl = `/data/${uid}/${encodeURIComponent(storedFileName)}`;
        const fileSize = file.size ? formatFileSize(file.size) : 'N/A';
        
        const listItem = document.createElement('li');
        listItem.className = 'file-item';
        listItem.setAttribute('data-uid', uid);
        
        // Create file icon based on file extension
        let fileIcon = '📄'; // Default icon
        if (['mp3', 'wav', 'ogg', 'm4a', 'opus'].includes(fileExt)) {
          fileIcon = '🎵';
        } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
          fileIcon = '🖼️';
        } else if (['pdf', 'doc', 'docx', 'txt'].includes(fileExt)) {
          fileIcon = '📄';
        }
        
        // Use original_name if available, otherwise use the stored filename for display
        const displayName = file.original_name || storedFileName;
        
        listItem.innerHTML = `
          <div class="file-info">
            <span class="file-icon">${fileIcon}</span>
            <a href="${fileUrl}" class="file-name" target="_blank" rel="noopener noreferrer">
              ${displayName}
            </a>
            <span class="file-size">${fileSize}</span>
          </div>
          <div class="file-actions">
            <a href="${fileUrl}" class="download-button" download>
              <span class="button-icon">⬇️</span>
              <span class="button-text">Download</span>
            </a>
            <button class="delete-file" data-filename="${storedFileName}" data-original-name="${displayName}">
              <span class="button-icon">🗑️</span>
              <span class="button-text">Delete</span>
            </button>
          </div>
        `;
        
        // Delete button handler will be handled by event delegation
        // No need to add individual event listeners here
        
        fileList.appendChild(listItem);
      });
    } else {
      // Handle non-OK responses
      if (response.status === 401) {
        // Parent component will handle authentication state
        fileList.innerHTML = `
          <li class="error-message">
            Please <a href="/#login" class="login-link">log in</a> to view your files.
          </li>`;
      } else {
        fileList.innerHTML = `
          <li class="error-message">
            Error loading files (${response.status}). Please try again later.
          </li>`;
      }
      console.error('[FILES] Server error:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('[FILES] Error fetching files:', error);
    const fileList = document.getElementById('file-list');
    if (fileList) {
      fileList.innerHTML = `
        <li class="error-message">
          Error loading files: ${error.message || 'Unknown error'}
        </li>`;
    }
  }
}

// Function to handle file deletion
async function deleteFile(uid, fileName, listItem, displayName = '') {
  const fileToDelete = displayName || fileName;
  if (!confirm(`Are you sure you want to delete "${fileToDelete}"?`)) {
    return;
  }
  
  // Show loading state
  if (listItem) {
    listItem.style.opacity = '0.6';
    listItem.style.pointerEvents = 'none';
    const deleteButton = listItem.querySelector('.delete-file');
    if (deleteButton) {
      deleteButton.disabled = true;
      deleteButton.innerHTML = '<span class="button-icon">⏳</span><span class="button-text">Deleting...</span>';
    }
  }
  
  try {
    if (!uid) {
      throw new Error('User not authenticated. Please log in again.');
    }
    
    console.log(`[DELETE] Attempting to delete file: ${fileName} for user: ${uid}`);
    const authToken = localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Use the provided UID in the URL
    const response = await fetch(`/uploads/${uid}/${encodeURIComponent(fileName)}`, {
      method: 'DELETE',
      headers: headers,
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    // Remove the file from the UI immediately
    if (listItem && listItem.parentNode) {
      listItem.parentNode.removeChild(listItem);
    }
    
    // Show success message
    showToast(`Successfully deleted "${fileToDelete}"`, 'success');
    
    // If the file list is now empty, show a message
    const fileList = document.getElementById('file-list');
    if (fileList && fileList.children.length === 0) {
      fileList.innerHTML = '<li class="no-files">No files uploaded yet.</li>';
    }
  } catch (error) {
    console.error('[DELETE] Error deleting file:', error);
    showToast(`Error deleting "${fileToDelete}": ${error.message}`, 'error');
    
    // Reset the button state if there was an error
    if (listItem) {
      listItem.style.opacity = '';
      listItem.style.pointerEvents = '';
      const deleteButton = listItem.querySelector('.delete-file');
      if (deleteButton) {
        deleteButton.disabled = false;
        deleteButton.innerHTML = '🗑️';
      }
    }
  }
}

// Initialize file upload functionality
function initFileUpload() {
  const uploadArea = document.getElementById('user-upload-area');
  const fileInput = document.getElementById('fileInputUser');
  
  if (!uploadArea || !fileInput) {
    console.warn('[UPLOAD] Required elements not found for file upload');
    return;
  }
  
  // Handle click on upload area
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });
  
  // Handle file selection
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      showToast('File is too large. Maximum size is 100MB.', 'error');
      return;
    }
    
    // Show loading state
    const originalText = uploadArea.innerHTML;
    uploadArea.innerHTML = 'Uploading...';
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Get UID from localStorage (parent UI ensures we're authenticated)
      const uid = localStorage.getItem('uid');
      formData.append('uid', uid);
      
      // Proceed with the upload
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',  // Include cookies for authentication
        headers: {
          'Accept': 'application/json'  // Explicitly accept JSON response
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }
      
      const result = await response.json();
      
      // Refresh file list
      if (window.fetchAndDisplayFiles) {
        window.fetchAndDisplayFiles(uid);
      }
      
    } catch (error) {
      console.error('[UPLOAD] Error uploading file:', error);
      showToast(`Upload failed: ${error.message}`, 'error');
    } finally {
      // Reset file input and restore upload area text
      fileInput.value = '';
      uploadArea.innerHTML = originalText;
    }
  });
  
  // Handle drag and drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, unhighlight, false);
  });
  
  function highlight() {
    uploadArea.classList.add('highlight');
  }
  
  function unhighlight() {
    uploadArea.classList.remove('highlight');
  }
  
  // Handle dropped files
  uploadArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length) {
      fileInput.files = files;
      const event = new Event('change');
      fileInput.dispatchEvent(event);
    }
  });
}

// Main initialization when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize dashboard components
  initDashboard();  // initFileUpload is called from within initDashboard
  
  // Add event delegation for delete buttons
  document.addEventListener('click', (e) => {
    const deleteButton = e.target.closest('.delete-file');
    if (!deleteButton) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const listItem = deleteButton.closest('.file-item');
    if (!listItem) return;
    
    // Get UID from localStorage
    const uid = localStorage.getItem('uid') || localStorage.getItem('confirmed_uid');
    if (!uid) {
      showToast('You need to be logged in to delete files', 'error');
      console.error('[DELETE] No UID found in localStorage');
      return;
    }
    
    const fileName = deleteButton.getAttribute('data-filename');
    const displayName = deleteButton.getAttribute('data-original-name') || fileName;
    
    // Pass the UID to deleteFile
    deleteFile(uid, fileName, listItem, displayName);
  });
  
  // Make fetchAndDisplayFiles available globally
  window.fetchAndDisplayFiles = fetchAndDisplayFiles;
  
  // Login/Register (guest)
  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(regForm);
      const submitButton = regForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.textContent;
      
      try {
        // Disable button during submission
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
        
        const res = await fetch('/register', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });

        let data;
        const contentType = res.headers.get('content-type');

        try {
          if (contentType && contentType.includes('application/json')) {
            data = await res.json();
          } else {
            const text = await res.text();
            data = { detail: text };
          }

          if (res.ok) {
            showToast('Check your email for a magic login link!', 'success');
            // Clear the form on success
            regForm.reset();
          } else {
            showToast(`Error: ${data.detail || 'Unknown error occurred'}`, 'error');
            console.error('Registration failed:', data);
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          showToast('Error processing the response. Please try again.', 'error');
        }
      } catch (err) {
        console.error('Network error:', err);
        showToast('Network error. Please check your connection and try again.', 'error');
      } finally {
        // Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    });
  }
  // Connect Login or Register link to register form
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

  // Back to top button functionality
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    backToTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Mobile menu functionality
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const mainNav = document.getElementById('main-navigation');
  
  if (menuToggle && mainNav) {
    // Toggle mobile menu
    menuToggle.addEventListener('click', () => {
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true' || false;
      menuToggle.setAttribute('aria-expanded', !isExpanded);
      mainNav.setAttribute('aria-hidden', isExpanded);
      
      // Toggle mobile menu visibility
      if (isExpanded) {
        mainNav.classList.remove('mobile-visible');
        document.body.style.overflow = '';
      } else {
        mainNav.classList.add('mobile-visible');
        document.body.style.overflow = 'hidden';
      }
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      const isClickInsideNav = mainNav.contains(e.target);
      const isClickOnToggle = menuToggle === e.target || menuToggle.contains(e.target);
      
      if (mainNav.classList.contains('mobile-visible') && !isClickInsideNav && !isClickOnToggle) {
        mainNav.classList.remove('mobile-visible');
        menuToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  // Handle navigation link clicks
  const navLinks = document.querySelectorAll('nav a[href^="#"]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        
        // Close mobile menu if open
        if (mainNav && mainNav.classList.contains('mobile-visible')) {
          mainNav.classList.remove('mobile-visible');
          if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', 'false');
          }
          document.body.style.overflow = '';
        }
        
        // Smooth scroll to target
        targetElement.scrollIntoView({ behavior: 'smooth' });
        
        // Update URL without page reload
        if (history.pushState) {
          history.pushState(null, '', targetId);
        } else {
          location.hash = targetId;
        }
      }
    });
  });

  // Helper function to handle page section navigation
  const setupPageNavigation = (linkIds, pageId) => {
    const links = linkIds
      .map(id => document.getElementById(id))
      .filter(Boolean);
    
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('main > section').forEach(sec => {
          sec.hidden = sec.id !== pageId;
        });
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
          targetPage.hidden = false;
          targetPage.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  };

  // Setup navigation for different sections
  setupPageNavigation(['guest-terms', 'user-terms'], 'terms-page');
  setupPageNavigation(['guest-imprint', 'user-imprint'], 'imprint-page');
  setupPageNavigation(['guest-privacy', 'user-privacy'], 'privacy-page');

  // Registration form handler for guests - removed duplicate declaration
  // The form submission is already handled earlier in the file

  // Login link handler - removed duplicate declaration
  // The login link is already handled by the setupPageNavigation function

  // Handle drag and drop
  const uploadArea = document.getElementById('upload-area');
  if (uploadArea) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    function highlight() {
      uploadArea.classList.add('highlight');
    }
    
    function unhighlight() {
      uploadArea.classList.remove('highlight');
    }
    
    // Handle dropped files
    uploadArea.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      
      if (files.length) {
        const fileInput = document.getElementById('file-input');
        fileInput.files = files;
        const event = new Event('change');
        fileInput.dispatchEvent(event);
      }
    });
  }
}); // End of DOMContentLoaded
