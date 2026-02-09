/**
 * Centralized Authentication Manager
 * 
 * This module consolidates all authentication logic from auth.js, magic-login.js,
 * and cleanup-auth.js into a single, maintainable module.
 */

import { showToast } from './toast.js';

class AuthManager {
    constructor() {
        this.DEBUG_AUTH_STATE = false;
        this.AUTH_CHECK_DEBOUNCE = 1000; // 1 second
        this.AUTH_CHECK_INTERVAL = 30000; // 30 seconds
        this.CACHE_TTL = 5000; // 5 seconds
        
        // Authentication state cache
        this.authStateCache = {
            timestamp: 0,
            value: null,
            ttl: this.CACHE_TTL
        };
        
        // Track auth check calls
        this.lastAuthCheckTime = 0;
        this.authCheckCounter = 0;
        this.wasAuthenticated = null;
        
        // Bind all methods that will be used as event handlers
        this.checkAuthState = this.checkAuthState.bind(this);
        this.handleMagicLoginRedirect = this.handleMagicLoginRedirect.bind(this);
        this.logout = this.logout.bind(this);
        this.deleteAccount = this.deleteAccount.bind(this);
        this.handleStorageEvent = this.handleStorageEvent.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        
        // Initialize
        this.initialize = this.initialize.bind(this);
    }

    /**
     * Validate UID format - must be a valid email address
     */
    validateUidFormat(uid) {
        if (!uid || typeof uid !== 'string') {
            // Debug messages disabled
            return false;
        }

        // Email regex pattern - RFC 5322 compliant basic validation
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        const isValid = emailRegex.test(uid);
        
        if (!isValid) {
            // Debug messages disabled
        } else {
            // Debug messages disabled
        }
        
        return isValid;
    }

    /**
     * Sanitize and validate UID - ensures consistent format
     */
    sanitizeUid(uid) {
        if (!uid || typeof uid !== 'string') {
            // Debug messages disabled
            return null;
        }

        // Trim whitespace and convert to lowercase
        const sanitized = uid.trim().toLowerCase();
        
        // Validate the sanitized UID
        if (!this.validateUidFormat(sanitized)) {
            // Debug messages disabled
            return null;
        }
        
        // Debug messages disabled
        return sanitized;
    }

    /**
     * Check if current stored UID is valid and fix if needed
     */
    validateStoredUid() {
        const storedUid = localStorage.getItem('uid');
        
        if (!storedUid) {
            // Debug messages disabled
            return null;
        }

        const sanitizedUid = this.sanitizeUid(storedUid);
        
        if (!sanitizedUid) {
            // Debug messages disabled
            this.clearAuthState();
            return null;
        }

        // Update stored UID if sanitization changed it
        if (sanitizedUid !== storedUid) {
            // Debug messages disabled
            localStorage.setItem('uid', sanitizedUid);
            
            // Update cookies as well
            document.cookie = `uid=${sanitizedUid}; path=/; SameSite=Lax; Secure`;
        }

        return sanitizedUid;
    }

    /**
     * Get cookie value by name
     */
    getCookieValue(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
        return null;
    }

    /**
     * Initialize the authentication manager
     */
    async initialize() {
        // Debug messages disabled
        
        // Validate stored UID format and fix if needed
        const validUid = this.validateStoredUid();
        if (validUid) {
            // Debug messages disabled
        } else {
            // Debug messages disabled
        }
        
        // Handle magic link login if present
        await this.handleMagicLoginRedirect();
        
        // Setup authentication state polling
        this.setupAuthStatePolling();
        
        // Setup event listeners
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        this.setupEventListeners();
        
        // Debug messages disabled
    }

    /**
     * Fetch user information from the server
     */
    async fetchUserInfo() {
        try {
            // Get the auth token from cookies
            const authToken = this.getCookieValue('authToken') || localStorage.getItem('authToken');
            // Debug messages disabled
            
            const headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            };
            
            // Add Authorization header if we have a token
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
                // Debug messages disabled
            } else {
                // Debug messages disabled
            }
            
            // Debug messages disabled
            const response = await fetch('/api/me', {
                method: 'GET',
                credentials: 'include',
                headers: headers
            });
            
            // Debug messages disabled
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                // Debug messages disabled
                
                if (contentType && contentType.includes('application/json')) {
                    const userInfo = await response.json();
                    // Debug messages disabled
                    return userInfo;
                } else {
                    const text = await response.text();
                    // Debug messages disabled
                }
            } else {
                const errorText = await response.text();
                // Debug messages disabled
            }
            return null;
        } catch (error) {
            // Debug messages disabled
            return null;
        }
    }

    /**
     * Set authentication state in localStorage and cookies
     */
    setAuthState(userEmail, username, authToken = null) {
        // Debug messages disabled
        
        // Validate and sanitize the UID (email)
        const sanitizedUid = this.sanitizeUid(userEmail);
        if (!sanitizedUid) {
            // Debug messages disabled
            throw new Error(`Invalid UID format: ${userEmail}. UID must be a valid email address.`);
        }
        
        // Validate username (basic check)
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            // Debug messages disabled
            throw new Error(`Invalid username: ${username}. Username cannot be empty.`);
        }
        
        const sanitizedUsername = username.trim();
        
        // Generate auth token if not provided
        if (!authToken) {
            authToken = 'token-' + Math.random().toString(36).substring(2, 15);
        }
        
        // Debug messages disabled
        
        // Set localStorage for client-side access (not sent to server)
        localStorage.setItem('uid', sanitizedUid);  // Primary UID is email
        localStorage.setItem('username', sanitizedUsername);  // Username for display
        localStorage.setItem('uid_time', Date.now().toString());
        
        // Set cookies for server authentication (sent with requests)
        document.cookie = `uid=${encodeURIComponent(sanitizedUid)}; path=/; SameSite=Lax`;
        document.cookie = `authToken=${authToken}; path=/; SameSite=Lax; Secure`;
        // Note: isAuthenticated is determined by presence of valid authToken, no need to duplicate
        
        // Clear cache to force refresh
        this.authStateCache.timestamp = 0;
    }

    /**
     * Clear authentication state
     */
    clearAuthState() {
        // Debug messages disabled
        
        // Clear localStorage (client-side data only)
        const authKeys = ['uid', 'username', 'uid_time'];
        authKeys.forEach(key => localStorage.removeItem(key));
        
        // Clear cookies
        document.cookie.split(';').forEach(cookie => {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/; SameSite=Lax`;
        });
        
        // Clear cache
        this.authStateCache.timestamp = 0;
    }

    /**
     * Check if user is currently authenticated
     */
    isAuthenticated() {
        const now = Date.now();
        
        // Use cached value if still valid
        if (this.authStateCache.timestamp > 0 && 
            (now - this.authStateCache.timestamp) < this.authStateCache.ttl) {
            return this.authStateCache.value;
        }
        
        // Check authentication state - simplified approach
        const hasUid = !!(document.cookie.includes('uid=') || localStorage.getItem('uid'));
        const hasAuthToken = !!document.cookie.includes('authToken=');
        
        const isAuth = hasUid && hasAuthToken;
        
        // Update cache
        this.authStateCache.timestamp = now;
        this.authStateCache.value = isAuth;
        
        return isAuth;
    }

    /**
     * Get current user data
     */
    getCurrentUser() {
        if (!this.isAuthenticated()) {
            return null;
        }
        
        return {
            uid: localStorage.getItem('uid'),
            email: localStorage.getItem('uid'), // uid is the email
            username: localStorage.getItem('username'),
            authToken: this.getCookieValue('authToken') // authToken is in cookies
        };
    }

    /**
     * Handle magic link login redirect
     */
    async handleMagicLoginRedirect() {
        const params = new URLSearchParams(window.location.search);
        
        // Handle secure token-based magic login only
        const token = params.get('token');
        if (token) {
            // Debug messages disabled
            
            // Clean up URL immediately
            const url = new URL(window.location.href);
            url.searchParams.delete('token');
            window.history.replaceState({}, document.title, url.pathname + url.search);
            
            await this.processTokenLogin(token);
            return true;
        }
        
        return false;
    }



    /**
     * Process token-based login
     */
    async processTokenLogin(token) {
        try {
            // Debug messages disabled
            
            const formData = new FormData();
            formData.append('token', token);
            
            // Debug messages disabled
            const response = await fetch('/magic-login', {
                method: 'POST',
                body: formData,
            });
            
            // Debug messages disabled
            
            // Handle successful token login response
            const contentType = response.headers.get('content-type');
            // Debug messages disabled
            
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                // Debug messages disabled
                
                if (data && data.success && data.user) {
                    // Debug messages disabled
                    
                    // Use the user data and token from the response
                    const { email, username } = data.user;
                    const authToken = data.token; // Get token from JSON response
                    
                    // Debug messages disabled
                    
                    // Set auth state with the token from the response
                    this.setAuthState(email, username, authToken);
                    this.updateUIState(true);
                    await this.initializeUserSession(username, email);
                    showToast('✅ Login successful!');
                    this.navigateToProfile();
                    return;
                } else {
                    // Debug messages disabled
                    throw new Error('Invalid user data received from server');
                }
            } else {
                const text = await response.text();
                // Debug messages disabled
                throw new Error(`Unexpected response format: ${text || 'No details available'}`);
            }
        } catch (error) {
            // Debug messages disabled
            showToast(`Login failed: ${error.message}`, 'error');
        }
    }

    /**
     * Initialize user session after login
     */
    async initializeUserSession(username, userEmail) {
        // Initialize dashboard
        if (window.initDashboard) {
            await window.initDashboard(username);
        } else {
            // Debug messages disabled
        }
        
        // Fetch and display file list
        if (window.fetchAndDisplayFiles) {
            // Debug messages disabled
            await window.fetchAndDisplayFiles(userEmail);
        } else {
            // Debug messages disabled
        }
    }

    /**
     * Navigate to user profile
     */
    navigateToProfile() {
        if (window.showOnly) {
            // Debug messages disabled
            window.showOnly('me-page');
        } else if (window.location.hash !== '#me-page') {
            window.location.hash = '#me-page';
        }
    }

    /**
     * Update UI state based on authentication
     */
    updateUIState(isAuthenticated) {
        if (isAuthenticated) {
            document.body.classList.add('authenticated');
            document.body.classList.remove('guest');
            
            // Note: Removed auto-loading of profile stream to prevent auto-play on page load
            // Profile stream will only play when user clicks the play button
        } else {
            document.body.classList.remove('authenticated');
            document.body.classList.add('guest');
        }
        
        this.updateAccountDeletionVisibility(isAuthenticated);
        
        // Force reflow
        void document.body.offsetHeight;
    }

    /**
     * Update account deletion section visibility
     */
    updateAccountDeletionVisibility(isAuthenticated) {
        const accountDeletionSection = document.getElementById('account-deletion-section');
        const deleteAccountFromPrivacy = document.getElementById('delete-account-from-privacy');
        
        if (isAuthenticated) {
            this.showElement(accountDeletionSection);
            this.showElement(deleteAccountFromPrivacy);
        } else {
            this.hideElement(accountDeletionSection);
            this.hideElement(deleteAccountFromPrivacy);
        }
    }

    showElement(element) {
        if (element) {
            element.style.display = 'block';
            element.style.visibility = 'visible';
        }
    }

    hideElement(element) {
        if (element) {
            element.style.display = 'none';
        }
    }

    /**
     * Check authentication state with caching and debouncing
     */
    checkAuthState(force = false) {
        const now = Date.now();
        
        // Debounce frequent calls
        if (!force && (now - this.lastAuthCheckTime) < this.AUTH_CHECK_DEBOUNCE) {
            return this.authStateCache.value;
        }
        
        this.lastAuthCheckTime = now;
        this.authCheckCounter++;
        
        if (this.DEBUG_AUTH_STATE) {
            // Debug messages disabled
        }
        
        const isAuthenticated = this.isAuthenticated();
        
        // Only update UI if state changed or forced
        if (force || this.wasAuthenticated !== isAuthenticated) {
            if (this.DEBUG_AUTH_STATE) {
                // Debug messages disabled
            }
            
            // Handle logout detection
            if (this.wasAuthenticated === true && isAuthenticated === false) {
                // Debug messages disabled
                this.logout();
                return false;
            }
            
            this.updateUIState(isAuthenticated);
            this.wasAuthenticated = isAuthenticated;
        }
        
        return isAuthenticated;
    }

    /**
     * Setup authentication state polling
     */
    setupAuthStatePolling() {
        // Initial check
        this.checkAuthState(true);
        
        // Periodic checks
        setInterval(() => {
            this.checkAuthState(!document.hidden);
        }, this.AUTH_CHECK_INTERVAL);
        
        // Storage event listener
        window.addEventListener('storage', this.handleStorageEvent);
        
        // Visibility change listener
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    /**
     * Handle storage events
     */
    handleStorageEvent(e) {
        if (['isAuthenticated', 'authToken', 'uid'].includes(e.key)) {
            this.checkAuthState(true);
        }
    }

    /**
     * Handle visibility change events
     */
    handleVisibilityChange() {
        if (!document.hidden) {
            this.checkAuthState(true);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            // Delete account buttons
            if (e.target.closest('#delete-account') || e.target.closest('#delete-account-from-privacy')) {
                this.deleteAccount(e);
                return;
            }
        });
    }

    /**
     * Delete user account
     */
    async deleteAccount(e) {
        if (e) e.preventDefault();
        if (this.deleteAccount.inProgress) return;
        
        if (!confirm('Are you sure you want to delete your account?\nThis action is permanent.')) {
            return;
        }
        
        this.deleteAccount.inProgress = true;
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
            this.logout();
        } catch (error) {
            // Debug messages disabled
            showToast(error.message, 'error');
        } finally {
            this.deleteAccount.inProgress = false;
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.textContent = originalText;
            }
        }
    }

    /**
     * Logout user
     */
    logout() {
        // Debug messages disabled
        this.clearAuthState();
        window.location.href = '/';
    }

    /**
     * Cleanup authentication state (for migration/debugging)
     */
    async cleanupAuthState(manualEmail = null) {
        // Debug messages disabled
        
        let userEmail = manualEmail;
        
        // Try to get email from server if not provided
        if (!userEmail) {
            const userInfo = await this.fetchUserInfo();
            userEmail = userInfo?.email;
            
            if (!userEmail) {
                userEmail = prompt('Please enter your email address (e.g., oib@chello.at):');
                if (!userEmail || !userEmail.includes('@')) {
                    // Debug messages disabled
                    return { success: false, error: 'Invalid email' };
                }
            }
        }
        
        if (!userEmail) {
            // Debug messages disabled
            return { success: false, error: 'No email available' };
        }
        
        // Get current username for reference
        const currentUsername = localStorage.getItem('username') || localStorage.getItem('uid');
        
        // Clear and reset authentication state
        this.clearAuthState();
        this.setAuthState(userEmail, currentUsername || userEmail);
        
        // Debug messages disabled
        // Debug messages disabled
        
        // Refresh if on profile page
        if (window.location.hash === '#me-page') {
            window.location.reload();
        }
        
        return {
            email: userEmail,
            username: currentUsername,
            success: true
        };
    }

    /**
     * Destroy the authentication manager
     */
    destroy() {
        window.removeEventListener('storage', this.handleStorageEvent);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
}

// Create and export singleton instance
const authManager = new AuthManager();

// Export for global access
window.authManager = authManager;

export default authManager;
