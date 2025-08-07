/**
 * Cleanup Script: Remove Redundant confirmed_uid from localStorage
 * 
 * This script removes the redundant confirmed_uid field from localStorage
 * for users who might have it stored from the old authentication system.
 */

(function() {
    'use strict';
    
    console.log('[CONFIRMED_UID_CLEANUP] Starting cleanup of redundant confirmed_uid field...');
    
    // Check if confirmed_uid exists in localStorage
    const confirmedUid = localStorage.getItem('confirmed_uid');
    const currentUid = localStorage.getItem('uid');
    
    if (confirmedUid) {
        console.log(`[CONFIRMED_UID_CLEANUP] Found confirmed_uid: ${confirmedUid}`);
        console.log(`[CONFIRMED_UID_CLEANUP] Current uid: ${currentUid}`);
        
        // Verify that uid exists and is properly set
        if (!currentUid) {
            console.warn('[CONFIRMED_UID_CLEANUP] No uid found, setting uid from confirmed_uid');
            localStorage.setItem('uid', confirmedUid);
        } else if (currentUid !== confirmedUid) {
            console.warn(`[CONFIRMED_UID_CLEANUP] UID mismatch - uid: ${currentUid}, confirmed_uid: ${confirmedUid}`);
            console.log('[CONFIRMED_UID_CLEANUP] Keeping current uid value');
        }
        
        // Remove the redundant confirmed_uid
        localStorage.removeItem('confirmed_uid');
        console.log('[CONFIRMED_UID_CLEANUP] Removed redundant confirmed_uid from localStorage');
        
        // Log the cleanup action
        console.log('[CONFIRMED_UID_CLEANUP] Cleanup completed successfully');
    } else {
        console.log('[CONFIRMED_UID_CLEANUP] No confirmed_uid found, no cleanup needed');
    }
    
    // Also check for any other potential redundant fields
    const redundantFields = [
        'confirmed_uid',  // Main target
        'confirmedUid',   // Camel case variant
        'confirmed-uid'   // Hyphenated variant
    ];
    
    let removedCount = 0;
    redundantFields.forEach(field => {
        if (localStorage.getItem(field)) {
            localStorage.removeItem(field);
            removedCount++;
            console.log(`[CONFIRMED_UID_CLEANUP] Removed redundant field: ${field}`);
        }
    });
    
    if (removedCount > 0) {
        console.log(`[CONFIRMED_UID_CLEANUP] Removed ${removedCount} redundant authentication fields`);
    }
    
    console.log('[CONFIRMED_UID_CLEANUP] Cleanup process completed');
})();

// Export for manual execution if needed
if (typeof window !== 'undefined') {
    window.removeConfirmedUidCleanup = function() {
        const script = document.createElement('script');
        script.src = '/static/remove-confirmed-uid.js';
        document.head.appendChild(script);
    };
}
