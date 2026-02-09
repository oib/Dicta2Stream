/**
 * UID Validation Utility
 * 
 * Provides comprehensive UID format validation and sanitization
 * to ensure all UIDs are properly formatted as email addresses.
 */

export class UidValidator {
    constructor() {
        // RFC 5322 compliant email regex (basic validation)
        this.emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        // Common invalid patterns to check against
        this.invalidPatterns = [
            /^devuser$/i,           // Legacy username pattern
            /^user\d+$/i,           // Generic user patterns
            /^test$/i,              // Test user
            /^admin$/i,             // Admin user
            /^\d+$/,                // Pure numeric
            /^[a-zA-Z]+$/,          // Pure alphabetic (no @ symbol)
        ];
    }

    /**
     * Validate UID format - must be a valid email address
     */
    isValidFormat(uid) {
        if (!uid || typeof uid !== 'string') {
            return {
                valid: false,
                error: 'UID must be a non-empty string',
                code: 'INVALID_TYPE'
            };
        }

        const trimmed = uid.trim();
        if (trimmed.length === 0) {
            return {
                valid: false,
                error: 'UID cannot be empty',
                code: 'EMPTY_UID'
            };
        }

        // Check against invalid patterns
        for (const pattern of this.invalidPatterns) {
            if (pattern.test(trimmed)) {
                return {
                    valid: false,
                    error: `UID matches invalid pattern: ${pattern}`,
                    code: 'INVALID_PATTERN'
                };
            }
        }

        // Validate email format
        if (!this.emailRegex.test(trimmed)) {
            return {
                valid: false,
                error: 'UID must be a valid email address',
                code: 'INVALID_EMAIL_FORMAT'
            };
        }

        return {
            valid: true,
            sanitized: trimmed.toLowerCase()
        };
    }

    /**
     * Sanitize and validate UID - ensures consistent format
     */
    sanitize(uid) {
        const validation = this.isValidFormat(uid);
        
        if (!validation.valid) {
            console.error('[UID-VALIDATOR] Validation failed:', validation.error, { uid });
            return null;
        }

        return validation.sanitized;
    }

    /**
     * Validate and throw error if invalid
     */
    validateOrThrow(uid, context = 'UID') {
        const validation = this.isValidFormat(uid);
        
        if (!validation.valid) {
            throw new Error(`${context} validation failed: ${validation.error} (${validation.code})`);
        }

        return validation.sanitized;
    }

    /**
     * Check if a UID needs migration (legacy format)
     */
    needsMigration(uid) {
        if (!uid || typeof uid !== 'string') {
            return false;
        }

        const trimmed = uid.trim();
        
        // Check if it's already a valid email
        if (this.emailRegex.test(trimmed)) {
            return false;
        }

        // Check if it matches known legacy patterns
        for (const pattern of this.invalidPatterns) {
            if (pattern.test(trimmed)) {
                return true;
            }
        }

        return true; // Any non-email format needs migration
    }

    /**
     * Get validation statistics for debugging
     */
    getValidationStats(uids) {
        const stats = {
            total: uids.length,
            valid: 0,
            invalid: 0,
            needsMigration: 0,
            errors: {}
        };

        uids.forEach(uid => {
            const validation = this.isValidFormat(uid);
            
            if (validation.valid) {
                stats.valid++;
            } else {
                stats.invalid++;
                const code = validation.code || 'UNKNOWN';
                stats.errors[code] = (stats.errors[code] || 0) + 1;
            }

            if (this.needsMigration(uid)) {
                stats.needsMigration++;
            }
        });

        return stats;
    }
}

// Create singleton instance
export const uidValidator = new UidValidator();

// Legacy exports for backward compatibility
export function validateUidFormat(uid) {
    return uidValidator.isValidFormat(uid).valid;
}

export function sanitizeUid(uid) {
    return uidValidator.sanitize(uid);
}

export function validateUidOrThrow(uid, context) {
    return uidValidator.validateOrThrow(uid, context);
}
