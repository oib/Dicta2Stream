-- Cleanup script for old format user 'oibchello'
-- This user has username-based UID instead of email-based UID

-- Show what will be deleted before deletion
SELECT 'publicstream entries to delete:' as info;
SELECT uid, username, storage_bytes, created_at FROM publicstream WHERE uid = 'oibchello';

SELECT 'uploadlog entries to delete:' as info;
SELECT COUNT(*) as count, uid FROM uploadlog WHERE uid = 'oibchello' GROUP BY uid;

SELECT 'userquota entries to delete:' as info;
SELECT uid FROM userquota WHERE uid = 'oibchello';

-- Delete from all related tables
-- Start with dependent tables first
DELETE FROM uploadlog WHERE uid = 'oibchello';
DELETE FROM userquota WHERE uid = 'oibchello';
DELETE FROM publicstream WHERE uid = 'oibchello';

-- Verify cleanup
SELECT 'Remaining entries for oibchello in publicstream:' as info;
SELECT COUNT(*) as count FROM publicstream WHERE uid = 'oibchello';

SELECT 'Remaining entries for oibchello in uploadlog:' as info;
SELECT COUNT(*) as count FROM uploadlog WHERE uid = 'oibchello';

SELECT 'Remaining entries for oibchello in userquota:' as info;
SELECT COUNT(*) as count FROM userquota WHERE uid = 'oibchello';

SELECT 'Total remaining old format entries in publicstream:' as info;
SELECT COUNT(*) as count FROM publicstream WHERE uid NOT LIKE '%@%' OR uid = username;
