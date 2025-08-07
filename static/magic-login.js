/**
 * Simplified Magic Login Module
 * 
 * This file now uses the centralized AuthManager for authentication logic.
 * The token-based magic login is handled by the AuthManager.
 */

import authManager from './auth-manager.js';
import { showSection } from './nav.js';

let magicLoginSubmitted = false;

/**
 * Initialize magic login - now delegated to AuthManager
 * This function is kept for backward compatibility but the actual
 * magic login logic is handled by the AuthManager during initialization.
 */
export async function initMagicLogin() {
  // Debug messages disabled
  
  // The AuthManager handles both URL-based and token-based magic login
  // during its initialization, so we just need to ensure it's initialized
  if (!window.authManager) {
    // Debug messages disabled
    await authManager.initialize();
  }
  
  // Check if there was a magic login processed
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  
  if (token) {
    // Debug messages disabled
  } else {
    // Debug messages disabled
  }
}

// Export for backward compatibility
export { magicLoginSubmitted };

// Make showSection available globally for AuthManager
window.showSection = showSection;
