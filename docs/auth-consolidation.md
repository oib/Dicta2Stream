# Authentication Logic Consolidation

## Overview

The authentication logic has been consolidated from multiple scattered files into a single, centralized `AuthManager` class. This improves maintainability, reduces code duplication, and provides a consistent authentication interface.

## Files Changed

### 1. New Centralized Module
- **`static/auth-manager.js`** - New centralized authentication manager class

### 2. Refactored Files
- **`static/auth.js`** - Simplified to use AuthManager
- **`static/magic-login.js`** - Simplified to use AuthManager  
- **`static/cleanup-auth.js`** - Simplified to use AuthManager

## AuthManager Features

### Core Functionality
- **Centralized State Management** - Single source of truth for authentication state
- **Cookie & localStorage Management** - Consistent handling of auth data storage
- **Magic Link Processing** - Handles both URL-based and token-based magic login
- **Authentication Polling** - Periodic state checks with caching and debouncing
- **User Session Management** - Login, logout, and account deletion

### Key Methods
- `initialize()` - Initialize the auth manager and handle magic login
- `setAuthState(email, username, token)` - Set authentication state
- `clearAuthState()` - Clear all authentication data
- `isAuthenticated()` - Check current authentication status
- `getCurrentUser()` - Get current user data
- `logout()` - Perform logout and redirect
- `deleteAccount()` - Handle account deletion
- `cleanupAuthState(email)` - Clean up inconsistent auth state

### Authentication Flow
1. **Magic Login Detection** - Checks URL parameters for login tokens/success
2. **User Info Retrieval** - Fetches email from `/api/me` endpoint
3. **State Setting** - Sets email as primary UID, username for display
4. **UI Updates** - Updates body classes and initializes user session
5. **Navigation** - Redirects to user profile page

## Data Storage Strategy

### localStorage Keys
- `uid` - Primary identifier (email-based)
- `user_email` - Explicit email storage
- `username` - Display name (separate from UID)
- `authToken` - Authentication token
- `isAuthenticated` - Boolean authentication state
- `uid_time` - Session timestamp

### Cookie Strategy
- `uid` - Email-based UID with `SameSite=Lax`
- `authToken` - Auth token with `SameSite=Lax; Secure`
- `isAuthenticated` - Boolean flag with `SameSite=Lax`

## Removed Redundancy

### Eliminated Duplicate Code
- **User info fetching** - Centralized in `fetchUserInfo()`
- **Auth state setting** - Centralized in `setAuthState()`
- **Cookie management** - Centralized in `setAuthState()` and `clearAuthState()`
- **Magic login processing** - Centralized in `processMagicLogin()` and `processTokenLogin()`

### Removed Fields
- `confirmed_uid` - Was duplicate of `uid`, now eliminated

## Backward Compatibility

### Global Functions (Legacy Support)
- `window.getCurrentUser()` - Get current user data
- `window.isAuthenticated()` - Check authentication status
- `window.logout()` - Perform logout
- `window.cleanupAuthState(email)` - Clean up auth state

### Existing Function Exports
- `initMagicLogin()` - Maintained in magic-login.js for compatibility
- `cleanupAuthState()` - Maintained in cleanup-auth.js for compatibility

## Benefits Achieved

### 1. **Maintainability**
- Single source of authentication logic
- Consistent error handling and logging
- Easier to debug and modify

### 2. **Performance**
- Reduced code duplication
- Optimized caching and debouncing
- Fewer redundant API calls

### 3. **Reliability**
- Consistent state management
- Proper cleanup on logout
- Robust error handling

### 4. **Security**
- Consistent cookie security attributes
- Proper state clearing on logout
- Centralized validation

## Migration Notes

### For Developers
- Import `authManager` from `./auth-manager.js` for new code
- Use `authManager.isAuthenticated()` instead of manual checks
- Use `authManager.getCurrentUser()` for user data
- Legacy global functions still work for existing code

### Testing
- Test magic link login (both URL and token-based)
- Test authentication state persistence
- Test logout and account deletion
- Test authentication polling and state changes

## Future Improvements

### Potential Enhancements
1. **Token Refresh** - Automatic token renewal
2. **Session Timeout** - Configurable session expiration
3. **Multi-tab Sync** - Better cross-tab authentication sync
4. **Audit Logging** - Enhanced authentication event logging
5. **Rate Limiting** - Protection against auth abuse

### Configuration Options
Consider adding configuration for:
- Polling intervals
- Cache TTL values
- Debug logging levels
- Cookie security settings
