-- Database Legacy Data Cleanup Script
-- Fixes issues identified in the database analysis
-- Execute these queries step by step to fix legacy data

-- =============================================================================
-- STEP 1: Fix User Table - Update username to match email format
-- =============================================================================
-- Issue: User has username 'oibchello' but email 'oib@chello.at'
-- Fix: Update username to match email (current authentication requirement)

UPDATE "user" 
SET username = email, 
    display_name = CASE 
        WHEN display_name = '' OR display_name IS NULL 
        THEN split_part(email, '@', 1)  -- Use email prefix as display name
        ELSE display_name 
    END
WHERE email = 'oib@chello.at';

-- Verify the fix
SELECT email, username, display_name, confirmed FROM "user" WHERE email = 'oib@chello.at';

-- =============================================================================
-- STEP 2: Clean Up Expired Sessions
-- =============================================================================
-- Issue: 11 expired sessions still marked as active (security risk)
-- Fix: Mark expired sessions as inactive

UPDATE dbsession 
SET is_active = false 
WHERE expires_at < NOW() AND is_active = true;

-- Verify expired sessions are now inactive
SELECT COUNT(*) as expired_active_sessions 
FROM dbsession 
WHERE expires_at < NOW() AND is_active = true;

-- Optional: Delete very old expired sessions (older than 7 days)
DELETE FROM dbsession 
WHERE expires_at < NOW() - INTERVAL '7 days';

-- =============================================================================
-- STEP 3: Update Session user_id to Email Format
-- =============================================================================
-- Issue: All sessions use old username format instead of email
-- Fix: Update session user_id to use email format

UPDATE dbsession 
SET user_id = 'oib@chello.at' 
WHERE user_id = 'oibchello';

-- Verify session user_id updates
SELECT DISTINCT user_id FROM dbsession;

-- =============================================================================
-- STEP 4: Fix PublicStream Username Fields
-- =============================================================================
-- Issue: PublicStream has username/UID mismatches
-- Fix: Update username to match UID (email format)

-- Fix the existing user record
UPDATE publicstream 
SET username = uid,
    display_name = CASE 
        WHEN display_name = 'oibchello' 
        THEN split_part(uid, '@', 1)  -- Use email prefix as display name
        ELSE display_name 
    END
WHERE uid = 'oib@chello.at';

-- Verify the fix
SELECT uid, username, display_name FROM publicstream WHERE uid = 'oib@chello.at';

-- =============================================================================
-- STEP 5: Remove Orphaned Records for Deleted User
-- =============================================================================
-- Issue: Records exist for 'oib@bubuit.net' but no user exists
-- Fix: Remove orphaned records

-- Remove orphaned quota record
DELETE FROM userquota WHERE uid = 'oib@bubuit.net';

-- Remove orphaned stream record  
DELETE FROM publicstream WHERE uid = 'oib@bubuit.net';

-- Verify orphaned records are removed
SELECT 'userquota' as table_name, COUNT(*) as count FROM userquota WHERE uid = 'oib@bubuit.net'
UNION ALL
SELECT 'publicstream' as table_name, COUNT(*) as count FROM publicstream WHERE uid = 'oib@bubuit.net';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these to verify all issues are fixed

-- 1. Check user table consistency
SELECT 
    email,
    username,
    display_name,
    CASE WHEN email = username THEN '✓' ELSE '✗' END as email_username_match,
    CASE WHEN display_name != '' THEN '✓' ELSE '✗' END as has_display_name
FROM "user";

-- 2. Check session table health
SELECT 
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN is_active THEN 1 END) as active_sessions,
    COUNT(CASE WHEN expires_at < NOW() AND is_active THEN 1 END) as expired_but_active,
    COUNT(CASE WHEN expires_at - created_at > INTERVAL '20 hours' THEN 1 END) as long_duration_sessions
FROM dbsession;

-- 3. Check PublicStream consistency
SELECT 
    uid,
    username,
    display_name,
    CASE WHEN uid = username THEN '✓' ELSE '✗' END as uid_username_match
FROM publicstream;

-- 4. Check referential integrity
SELECT 
    'Users' as entity,
    COUNT(*) as count
FROM "user"
UNION ALL
SELECT 
    'UserQuota records',
    COUNT(*)
FROM userquota
UNION ALL
SELECT 
    'PublicStream records',
    COUNT(*)
FROM publicstream
UNION ALL
SELECT 
    'Active Sessions',
    COUNT(*)
FROM dbsession WHERE is_active = true;

-- 5. Final validation - should return no rows if all issues are fixed
SELECT 'ISSUE: User email/username mismatch' as issue
FROM "user" 
WHERE email != username
UNION ALL
SELECT 'ISSUE: Expired active sessions'
FROM dbsession 
WHERE expires_at < NOW() AND is_active = true
LIMIT 1
UNION ALL
SELECT 'ISSUE: PublicStream UID/username mismatch'
FROM publicstream 
WHERE uid != username
LIMIT 1
UNION ALL
SELECT 'ISSUE: Orphaned quota records'
FROM userquota q
LEFT JOIN "user" u ON q.uid = u.email
WHERE u.email IS NULL
LIMIT 1
UNION ALL
SELECT 'ISSUE: Orphaned stream records'
FROM publicstream p
LEFT JOIN "user" u ON p.uid = u.email
WHERE u.email IS NULL
LIMIT 1;

-- If the final query returns no rows, all legacy issues are fixed! ✅
