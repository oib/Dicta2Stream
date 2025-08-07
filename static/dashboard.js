import { showToast } from "./toast.js";
import { showSection } from './nav.js';

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
let dashboardInitialized = false;

async function handleLogout(event) {
  // Debug messages disabled
  
  // Prevent multiple simultaneous logout attempts
  if (isLoggingOut) {
    // Debug messages disabled
    return;
  }
  isLoggingOut = true;
  
  // Prevent default button behavior
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  try {
    // Get auth token before we clear it
    const authToken = localStorage.getItem('authToken');
    
    // 1. Clear all client-side state first (most important)
    // Debug messages disabled
    
    // Clear localStorage and sessionStorage
    const storageKeys = [
      'uid', 'uid_time', 'last_page',
      'isAuthenticated', 'authToken', 'user', 'token', 'sessionid', 'sessionId'
    ];
    
    storageKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    // Get all current cookies for debugging
    const allCookies = document.cookie.split(';');
    // Debug messages disabled
    
    // Clear ALL cookies (aggressive approach)
    allCookies.forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (name) {
        const cookieName = name.trim();
        // Debug messages disabled
        
        // Try multiple clearing strategies to ensure cookies are removed
        const clearStrategies = [
          `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;`,
          `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}; SameSite=Lax;`,
          `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}; SameSite=Lax;`,
          `${cookieName}=; max-age=0; path=/; SameSite=Lax;`,
          `${cookieName}=; max-age=0; path=/; domain=${window.location.hostname}; SameSite=Lax;`
        ];
        
        clearStrategies.forEach(strategy => {
          document.cookie = strategy;
        });
      }
    });
    
    // Verify cookies are cleared
    const remainingCookies = document.cookie.split(';').filter(c => c.trim());
    // Debug messages disabled
    
    // Update UI state
    document.body.classList.remove('authenticated', 'logged-in');
    document.body.classList.add('guest');
    
    // 2. Try to invalidate server session (non-blocking)
    if (authToken) {
      try {
        // Debug messages disabled
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
        });
        
        clearTimeout(timeoutId);
        // Debug messages disabled
      } catch (error) {
        // Debug messages disabled
      }
    }
    
    // 3. Final redirect
    // Debug messages disabled
    window.location.href = '/?logout=' + Date.now();

  } catch (error) {
    // Debug messages disabled
    if (window.showToast) {
      showToast('Logout failed. Please try again.');
    }
    // Even if there's an error, force redirect to clear state
    window.location.href = '/?logout=error-' + Date.now();
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
    const deleteButton = document.getElementById('delete-account-from-privacy');
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
      
      // Use comprehensive logout logic to clear all cookies and storage
      console.log('🧹 Account deleted - clearing all authentication data...');
      
      // Clear all authentication-related data from localStorage
      const keysToRemove = [
        'uid', 'uid_time', 'last_page',
        'isAuthenticated', 'authToken', 'user', 'token', 'sessionid'
      ];
      
      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          console.log(`Removing localStorage key: ${key}`);
          localStorage.removeItem(key);
        }
      });
      
      // Clear sessionStorage completely
      sessionStorage.clear();
      console.log('Cleared sessionStorage');
      
      // Clear all cookies using multiple strategies
      const clearCookie = (cookieName) => {
        const clearStrategies = [
          `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;`,
          `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}; SameSite=Lax;`,
          `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}; SameSite=Lax;`,
          `${cookieName}=; max-age=0; path=/; SameSite=Lax;`,
          `${cookieName}=; max-age=0; path=/; domain=${window.location.hostname}; SameSite=Lax;`
        ];
        
        clearStrategies.forEach(strategy => {
          document.cookie = strategy;
        });
        console.log(`Cleared cookie: ${cookieName}`);
      };
      
      // Clear all cookies by setting them to expire in the past
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name) {
          clearCookie(name.trim());
        }
      });
      
      // Also specifically clear known authentication cookies
      const authCookies = ['authToken', 'isAuthenticated', 'sessionId', 'uid', 'token'];
      authCookies.forEach(clearCookie);
      
      // Log remaining cookies for verification
      console.log('Remaining cookies after deletion cleanup:', document.cookie);
      
      // Update UI state
      document.body.classList.remove('authenticated');
      document.body.classList.add('guest');
      
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
    const deleteButton = document.getElementById('delete-account-from-privacy');
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
  }
}

// Make updateQuotaDisplay available globally
window.updateQuotaDisplay = updateQuotaDisplay;

/**
 * Initialize the dashboard and handle authentication state
 */
async function initDashboard(uid = null) {
  // Debug messages disabled
  try {
    const guestDashboard = document.getElementById('guest-dashboard');
    const userDashboard = document.getElementById('user-dashboard');
    const userUpload = document.getElementById('user-upload-area');
    const logoutButton = document.getElementById('logout-button');
    const deleteAccountButton = document.getElementById('delete-account-from-privacy');
    const fileList = document.getElementById('file-list');

    // Only attach event listeners once to prevent duplicates
    if (!dashboardInitialized) {
      if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
      }
      // Delete account button is handled by auth.js delegated event listener
      // Removed duplicate event listener to prevent double confirmation dialogs
      dashboardInitialized = true;
    }

    const effectiveUid = uid || getCookie('uid') || localStorage.getItem('uid');
    const isAuthenticated = !!effectiveUid;

    if (isAuthenticated) {
      document.body.classList.add('authenticated');
      document.body.classList.remove('guest-mode');
      if (userDashboard) userDashboard.style.display = 'block';
      if (userUpload) userUpload.style.display = 'block';
      if (guestDashboard) guestDashboard.style.display = 'none';

      if (window.fetchAndDisplayFiles) {
        // Use email-based UID for file operations if available, fallback to effectiveUid
        const fileOperationUid = localStorage.getItem('uid') || effectiveUid;  // uid is now email-based
        // Debug messages disabled
        await window.fetchAndDisplayFiles(fileOperationUid);
      }
    } else {
      document.body.classList.remove('authenticated');
      document.body.classList.add('guest-mode');
      if (guestDashboard) guestDashboard.style.display = 'block';
      if (userDashboard) userDashboard.style.display = 'none';
      if (userUpload) userUpload.style.display = 'none';
      if (fileList) {
        fileList.innerHTML = `<li>Please <a href="/#login" class="login-link">log in</a> to view your files.</li>`;
      }
    }
  } catch (e) {
    console.error('Dashboard initialization failed:', e);
    const guestDashboard = document.getElementById('guest-dashboard');
    const userDashboard = document.getElementById('user-dashboard');
    if (userDashboard) userDashboard.style.display = 'none';
    if (guestDashboard) guestDashboard.style.display = 'block';
    document.body.classList.remove('authenticated');
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
    // Debug messages disabled
    return;
  }
  
  // Debug messages disabled
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
  
  // Debug messages disabled
  
  try {
    // The backend should handle authentication via session cookies
    // We include the auth token in headers if available, but don't rely on it for auth
    // Debug messages disabled
    const response = await fetch(`/user-files/${uid}`, {
      method: 'GET',
      credentials: 'include',  // Important: include cookies for session auth
      headers: headers
    });
    
    // Debug messages disabled
    // Debug messages disabled
    
    // Get response as text first to handle potential JSON parsing errors
    const responseText = await response.text();
    // Debug messages disabled
    
    // Parse the JSON response
    let responseData = {};
    if (responseText && responseText.trim() !== '') {
      try {
        responseData = JSON.parse(responseText);
        // Debug messages disabled
      } catch (e) {
        // Debug messages disabled
        // Debug messages disabled
        
        // If we have a non-JSON response but the status is 200, try to handle it
        if (response.ok) {
          // Debug messages disabled
        } else {
          throw new Error(`Invalid JSON response from server: ${e.message}`);
        }
      }
    } else {
      // Debug messages disabled
    }
    
    // Note: Authentication is handled by the parent component
    // We'll just handle the response status without clearing auth state
    
    if (response.ok) {
      // Check if the response has the expected format
      if (!responseData || !Array.isArray(responseData.files)) {
        // Debug messages disabled
        fileList.innerHTML = '<li>Error: Invalid response from server</li>';
        return;
      }
      
      const files = responseData.files;
      // Debug messages disabled
      
      if (files.length === 0) {
        fileList.innerHTML = '<li class="no-files">No files uploaded yet.</li>';
        return;
      }
      
      // Clear the loading message
      fileList.innerHTML = '';
      
    // Use the new global function to render the files
    window.displayUserFiles(uid, files);

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
      // Debug messages disabled
    }
  } catch (error) {
    // Debug messages disabled
    const fileList = document.getElementById('file-list');
    if (fileList) {
      fileList.innerHTML = `
        <li class="error-message">
          Error loading files: ${error.message || 'Unknown error'}
        </li>`;
    }
  }
}

// Function to update the quota display
async function updateQuotaDisplay(uid) {
  // Debug messages disabled
  try {
    const authToken = localStorage.getItem('authToken');
    const headers = { 
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Debug messages disabled
    // Fetch user info which includes quota
    const response = await fetch(`/me/${uid}`, {
      method: 'GET',
      credentials: 'include',
      headers: headers
    });
    
    // Debug messages disabled
    if (response.ok) {
      const userData = await response.json();
      // Debug messages disabled
      
      // Update the quota display
      const quotaText = document.getElementById('quota-text');
      const quotaBar = document.getElementById('quota-bar');
      
      // Debug messages disabled
      // Debug messages disabled
      
      if (quotaText && userData.quota) {
        const usedMB = (userData.quota.used_bytes / (1024 * 1024)).toFixed(2);
        const maxMB = (userData.quota.max_bytes / (1024 * 1024)).toFixed(2);
        const percentage = userData.quota.percentage || 0;
        
        // Debug messages disabled
        
        const quotaDisplayText = `${usedMB} MB of ${maxMB} MB (${percentage}%)`;
        quotaText.textContent = quotaDisplayText;
        // Debug messages disabled
        
        if (quotaBar) {
          quotaBar.value = percentage;
          // Debug messages disabled
        }
      } else {
        // Debug messages disabled
      }
    } else {
      // Debug messages disabled
    }
  } catch (error) {
    // Debug messages disabled
  }
}

// Make fetchAndDisplayFiles globally accessible
window.fetchAndDisplayFiles = fetchAndDisplayFiles;

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
    
    // Debug messages disabled
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
    // Debug messages disabled
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
    // Debug messages disabled
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
      // Debug messages disabled
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
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize dashboard components
  await initDashboard();  // initFileUpload is called from within initDashboard
  
  // Update quota display if user is logged in
  const uid = localStorage.getItem('uid');
  if (uid) {
    updateQuotaDisplay(uid);
  }
  
  // Delegated event listener for clicks on the document
  document.addEventListener('click', (e) => {
    // Logout Button
    if (e.target.closest('#logout-button')) {
      e.preventDefault();
      handleLogout(e);
      return;
    }

    // Delete File Button
    const deleteButton = e.target.closest('.delete-file');
    if (deleteButton) {
      e.preventDefault();
      e.stopPropagation();

      const listItem = deleteButton.closest('.file-item');
      if (!listItem) return;

      const uid = localStorage.getItem('uid');
      if (!uid) {
        showToast('You need to be logged in to delete files', 'error');
        // Debug messages disabled
        return;
      }

      const fileName = deleteButton.getAttribute('data-filename');
      const displayName = deleteButton.getAttribute('data-original-name') || fileName;
      
      deleteFile(uid, fileName, listItem, displayName);
    }
  });
  
  // Make dashboard functions available globally
  window.fetchAndDisplayFiles = fetchAndDisplayFiles;
  window.initDashboard = initDashboard;
  
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
            // Debug messages disabled
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
  // All navigation is now handled by the global click and hashchange listeners in nav.js.
  // The legacy setupPageNavigation function and manual nav link handlers have been removed.
  });

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
