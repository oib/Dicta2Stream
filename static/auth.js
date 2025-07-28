import { showToast } from './toast.js';

import { loadProfileStream } from './personal-player.js';

document.addEventListener('DOMContentLoaded', () => {
    // Track previous authentication state
    let wasAuthenticated = null;
    // Debug flag - set to false to disable auth state change logs
    const DEBUG_AUTH_STATE = false;

    // Track auth check calls and cache state
    let lastAuthCheckTime = 0;
    let authCheckCounter = 0;
    const AUTH_CHECK_DEBOUNCE = 1000; // 1 second
    let authStateCache = {
      timestamp: 0,
      value: null,
      ttl: 5000 // Cache TTL in milliseconds
    };

    // Handle magic link login redirect
    function handleMagicLoginRedirect() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') === 'success' && params.get('confirmed_uid')) {
        const username = params.get('confirmed_uid');
        console.log('Magic link login detected for user:', username);
        
        // Update authentication state
        localStorage.setItem('uid', username);
        localStorage.setItem('confirmed_uid', username);
        localStorage.setItem('uid_time', Date.now().toString());
        document.cookie = `uid=${encodeURIComponent(username)}; path=/; SameSite=Lax`;
        
        // Update UI state
        document.body.classList.add('authenticated');
        document.body.classList.remove('guest');
        
        // Update local storage and cookies
        localStorage.setItem('isAuthenticated', 'true');
        document.cookie = `isAuthenticated=true; path=/; SameSite=Lax`;
        
        // Update URL and history without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Update navigation
        if (typeof injectNavigation === 'function') {
          console.log('Updating navigation after magic link login');
          injectNavigation(true);
        } else {
          console.warn('injectNavigation function not available after magic link login');
        }
        
        // Navigate to user's profile page
        if (window.showOnly) {
          console.log('Navigating to me-page');
          window.showOnly('me-page');
        } else if (window.location.hash !== '#me') {
          window.location.hash = '#me';
        }
        
        // Auth state will be updated by the polling mechanism
      }
    }

    // Update the visibility of the account deletion section based on authentication state
    function updateAccountDeletionVisibility(isAuthenticated) {
      const authOnlyWrapper = document.querySelector('#privacy-page .auth-only');
      const accountDeletionSection = document.getElementById('account-deletion');
      
      const showElement = (element) => {
        if (!element) return;
        element.classList.remove('hidden', 'auth-only-hidden');
        element.style.display = 'block';
      };
      
      const hideElement = (element) => {
        if (!element) return;
        element.style.display = 'none';
      };
      
      if (isAuthenticated) {
        const isPrivacyPage = window.location.hash === '#privacy-page';
        if (isPrivacyPage) {
          if (authOnlyWrapper) showElement(authOnlyWrapper);
          if (accountDeletionSection) showElement(accountDeletionSection);
        } else {
          if (accountDeletionSection) hideElement(accountDeletionSection);
          if (authOnlyWrapper) hideElement(authOnlyWrapper);
        }
      } else {
        if (accountDeletionSection) hideElement(accountDeletionSection);
        if (authOnlyWrapper) {
          const hasOtherContent = Array.from(authOnlyWrapper.children).some(
            child => child.id !== 'account-deletion' && child.offsetParent !== null
          );
          if (!hasOtherContent) {
            hideElement(authOnlyWrapper);
          }
        }
      }
    }

    // Check authentication state and update UI with caching and debouncing
    function checkAuthState(force = false) {
      const now = Date.now();
      if (!force && authStateCache.value !== null && now - authStateCache.timestamp < authStateCache.ttl) {
        return authStateCache.value;
      }

      if (now - lastAuthCheckTime < AUTH_CHECK_DEBOUNCE && !force) {
        return wasAuthenticated;
      }
      lastAuthCheckTime = now;
      authCheckCounter++;

      const isAuthenticated = 
        (document.cookie.includes('isAuthenticated=true') || localStorage.getItem('isAuthenticated') === 'true') &&
        (document.cookie.includes('uid=') || localStorage.getItem('uid')) &&
        !!localStorage.getItem('authToken');

      authStateCache = {
        timestamp: now,
        value: isAuthenticated,
        ttl: isAuthenticated ? 30000 : 5000
      };

      if (isAuthenticated !== wasAuthenticated) {
        if (DEBUG_AUTH_STATE) {
          console.log('Auth state changed, updating UI...');
        }

        if (!isAuthenticated && wasAuthenticated) {
          console.log('User was authenticated, but is no longer. Triggering logout.');
          basicLogout();
          return; // Stop further processing after logout
        }

        if (isAuthenticated) {
          document.body.classList.add('authenticated');
          document.body.classList.remove('guest');
          const uid = localStorage.getItem('uid');
                    if (uid && (window.location.hash === '#me-page' || window.location.hash === '#me' || window.location.pathname.startsWith('/~'))) {
            loadProfileStream(uid);
          }
        } else {
          document.body.classList.remove('authenticated');
          document.body.classList.add('guest');
        }

        updateAccountDeletionVisibility(isAuthenticated);
        wasAuthenticated = isAuthenticated;
        void document.body.offsetHeight; // Force reflow
      }

      return isAuthenticated;
    }

    // Periodically check authentication state with optimized polling
    function setupAuthStatePolling() {
      checkAuthState(true);
      
      const checkAndUpdate = () => {
        checkAuthState(!document.hidden);
      };
      
      const AUTH_CHECK_INTERVAL = 30000;
      setInterval(checkAndUpdate, AUTH_CHECK_INTERVAL);
      
      const handleStorageEvent = (e) => {
        if (['isAuthenticated', 'authToken', 'uid'].includes(e.key)) {
          checkAuthState(true);
        }
      };
      
      window.addEventListener('storage', handleStorageEvent);
      
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          checkAuthState(true);
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        window.removeEventListener('storage', handleStorageEvent);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    // --- ACCOUNT DELETION ---
    const deleteAccount = async (e) => {
        if (e) e.preventDefault();
        if (deleteAccount.inProgress) return;
        if (!confirm('Are you sure you want to delete your account?\nThis action is permanent.')) return;

        deleteAccount.inProgress = true;
        const deleteBtn = e?.target.closest('button');
        const originalText = deleteBtn?.textContent;
        if (deleteBtn) {
          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Deleting...';
        }

        try {
          const response = await fetch('/api/delete-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ uid: localStorage.getItem('uid') })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to delete account.' }));
            throw new Error(errorData.detail);
          }

          showToast('Account deleted successfully.', 'success');
          // Perform a full client-side logout and redirect
          basicLogout();
        } catch (error) {
          showToast(error.message, 'error');
        } finally {
          deleteAccount.inProgress = false;
          if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = originalText;
          }
        }
    };

    // --- LOGOUT ---
    function basicLogout() {
        ['isAuthenticated', 'uid', 'confirmed_uid', 'uid_time', 'authToken'].forEach(k => localStorage.removeItem(k));
        document.cookie.split(';').forEach(c => document.cookie = c.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`));
        window.location.href = '/';
    }

    // --- DELEGATED EVENT LISTENERS ---
    document.addEventListener('click', (e) => {

        // Delete Account Buttons
        if (e.target.closest('#delete-account') || e.target.closest('#delete-account-from-privacy')) {
          deleteAccount(e);
          return;
        }
    });

    // --- INITIALIZATION ---
    handleMagicLoginRedirect();
    setupAuthStatePolling();
});
