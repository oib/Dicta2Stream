// Force hide guest navigation for authenticated users
function fixMobileNavigation() {
  console.log('[FIX-NAV] Running navigation fix...');
  
  // Check if user is authenticated
  const hasAuthCookie = document.cookie.includes('isAuthenticated=true');
  const hasUidCookie = document.cookie.includes('uid=');
  const hasLocalStorageAuth = localStorage.getItem('isAuthenticated') === 'true';
  const hasAuthToken = localStorage.getItem('authToken') !== null;
  const isAuthenticated = hasAuthCookie || hasUidCookie || hasLocalStorageAuth || hasAuthToken;
  
  console.log('[FIX-NAV] Authentication state:', { 
    isAuthenticated,
    hasAuthCookie,
    hasUidCookie,
    hasLocalStorageAuth,
    hasAuthToken
  });
  
  if (isAuthenticated) {
    // Force hide guest navigation with !important styles
    const guestNav = document.getElementById('guest-dashboard');
    if (guestNav) {
      console.log('[FIX-NAV] Hiding guest navigation');
      guestNav.style.cssText = `
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        position: absolute !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        pointer-events: none !important;
      `;
      guestNav.classList.add('force-hidden');
    }
    
    // Ensure user navigation is visible with !important styles
    const userNav = document.getElementById('user-dashboard');
    if (userNav) {
      console.log('[FIX-NAV] Showing user navigation');
      userNav.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        position: relative !important;
        clip: auto !important;
        pointer-events: auto !important;
      `;
      userNav.classList.add('force-visible');
    }
    
    // Add authenticated class to body
    document.body.classList.add('authenticated');
    document.body.classList.remove('guest-mode');
    
    // Prevent default behavior of nav links that might cause page reloads
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        if (targetId && targetId !== '#') {
          // Use history API to update URL without full page reload
          history.pushState(null, '', targetId);
          // Dispatch a custom event that other scripts can listen for
          window.dispatchEvent(new CustomEvent('hashchange'));
          // Force re-apply our navigation fix
          setTimeout(fixMobileNavigation, 0);
        }
      });
    });
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

// Run on page load
document.addEventListener('DOMContentLoaded', fixMobileNavigation);

// Also run after a short delay to catch any dynamic content
setTimeout(fixMobileNavigation, 100);
setTimeout(fixMobileNavigation, 300);
setTimeout(fixMobileNavigation, 1000);

// Listen for hash changes (navigation)
window.addEventListener('hashchange', fixMobileNavigation);

// Listen for pushState/replaceState (SPA navigation)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
  originalPushState.apply(this, arguments);
  setTimeout(fixMobileNavigation, 0);
};

history.replaceState = function() {
  originalReplaceState.apply(this, arguments);
  setTimeout(fixMobileNavigation, 0);
};

// Run on any DOM mutations (for dynamically loaded content)
const observer = new MutationObserver((mutations) => {
  let shouldFix = false;
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length || mutation.removedNodes.length) {
      shouldFix = true;
    }
  });
  if (shouldFix) {
    setTimeout(fixMobileNavigation, 0);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'style', 'id']
});

// Export for debugging
window.fixMobileNavigation = fixMobileNavigation;
