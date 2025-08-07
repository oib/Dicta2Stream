/**
 * Simplified Authentication Cleanup Module
 * 
 * This file now uses the centralized AuthManager for authentication cleanup.
 * The cleanup logic has been moved to the AuthManager.
 */

import authManager from './auth-manager.js';

/**
 * Clean up authentication state - now delegated to AuthManager
 * This function is kept for backward compatibility.
 */
async function cleanupAuthState(manualEmail = null) {
    console.log('[CLEANUP] Starting authentication state cleanup via AuthManager...');
    
    // Delegate to the centralized AuthManager
    return await authManager.cleanupAuthState(manualEmail);
}

// Auto-run cleanup if this script is loaded directly
if (typeof window !== 'undefined') {
    // Export function for manual use
    window.cleanupAuthState = cleanupAuthState;
    
    // Auto-run if URL contains cleanup parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('cleanup') === 'auth') {
        cleanupAuthState().then(result => {
            if (result && result.success) {
                console.log('[CLEANUP] Auto-cleanup completed successfully');
            }
        });
    }
}

// Export for ES6 modules
export { cleanupAuthState };
