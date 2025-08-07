/**
 * Simplified Authentication Module
 * 
 * This file now uses the centralized AuthManager for all authentication logic.
 * Legacy code has been replaced with the new consolidated approach.
 */

import authManager from './auth-manager.js';
import { loadProfileStream } from './personal-player.js';

// Initialize authentication manager when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Debug messages disabled
    
    // Initialize the centralized auth manager
    await authManager.initialize();
    
    // Make loadProfileStream available globally for auth manager
    window.loadProfileStream = loadProfileStream;
    
    // Debug messages disabled
});

// Export auth manager for other modules to use
export { authManager };

// Legacy compatibility - expose some functions globally
window.getCurrentUser = () => authManager.getCurrentUser();
window.isAuthenticated = () => authManager.isAuthenticated();
window.logout = () => authManager.logout();
window.cleanupAuthState = (email) => authManager.cleanupAuthState(email);
