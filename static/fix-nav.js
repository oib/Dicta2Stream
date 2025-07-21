// Debounce helper function
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Throttle helper function
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Check authentication state once and cache it
function getAuthState() {
  return (
    document.cookie.includes('isAuthenticated=') ||
    document.cookie.includes('uid=') ||
    localStorage.getItem('isAuthenticated') === 'true' ||
    !!localStorage.getItem('authToken')
  );
}

// Update navigation based on authentication state
function updateNavigation() {
  const isAuthenticated = getAuthState();
  
  // Only proceed if the authentication state has changed
  if (isAuthenticated === updateNavigation.lastState) {
    return;
  }
  updateNavigation.lastState = isAuthenticated;
  
  if (isAuthenticated) {
    // Hide guest navigation for authenticated users
    const guestNav = document.getElementById('guest-dashboard');
    if (guestNav) {
      guestNav.style.cssText = `
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        clip: rect(0, 0, 0, 0) !important;
        pointer-events: none !important;
      `;
    }
    
    // Show user navigation if it exists
    const userNav = document.getElementById('user-dashboard');
    if (userNav) {
      userNav.style.cssText = `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        position: relative !important;
        clip: auto !important;
        pointer-events: auto !important;
      `;
      userNav.classList.add('force-visible');
    }
    
    // Update body classes
    document.body.classList.add('authenticated');
    document.body.classList.remove('guest-mode');
  } else {
    // User is not authenticated - ensure guest nav is visible
    const guestNav = document.getElementById('guest-dashboard');
    if (guestNav) {
      guestNav.style.cssText = ''; // Reset any inline styles
    }
    document.body.classList.remove('authenticated');
    document.body.classList.add('guest-mode');
  }
}

// Initialize the navigation state
updateNavigation.lastState = null;

// Handle navigation link clicks
function handleNavLinkClick(e) {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  
  e.preventDefault();
  const targetId = link.getAttribute('href');
  if (targetId && targetId !== '#') {
    // Update URL without triggering full page reload
    history.pushState(null, '', targetId);
    // Dispatch a custom event for other scripts
    window.dispatchEvent(new CustomEvent('hashchange'));
  }
}

// Initialize the navigation system
function initNavigation() {
  // Set up event delegation for navigation links
  document.body.addEventListener('click', handleNavLinkClick);
  
  // Listen for hash changes (throttled)
  window.addEventListener('hashchange', throttle(updateNavigation, 100));
  
  // Listen for storage changes (like login/logout from other tabs)
  window.addEventListener('storage', debounce(updateNavigation, 100));
  
  // Check for authentication changes periodically (every 30 seconds)
  setInterval(updateNavigation, 30000);
  
  // Initial update
  updateNavigation();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavigation);
} else {
  // DOMContentLoaded has already fired
  initNavigation();
}

// Export for testing if needed
window.navigationUtils = {
  updateNavigation,
  getAuthState,
  initNavigation
};
