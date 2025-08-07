-- Cleanup script for old format user entries
-- Removes users with username-based UIDs instead of email-based UIDs

-- Show what will be deleted before deletion
SELECT 'publicstream entries to delete:' as info;
SELECT uid, username, storage_bytes, created_at FROM publicstream WHERE uid IN ('devuser', 'oibchello');

SELECT 'uploadlog entries to delete:' as info;
SELECT COUNT(*) as count, uid FROM uploadlog WHERE uid IN ('devuser', 'oibchello') GROUP BY uid;

SELECT 'userquota entries to delete:' as info;
SELECT uid, quota_bytes, used_bytes FROM userquota WHERE uid IN ('devuser', 'oibchello');

-- Delete from all related tables
-- Start with dependent tables first
DELETE FROM uploadlog WHERE uid IN ('devuser', 'oibchello');
DELETE FROM userquota WHERE uid IN ('devuser', 'oibchello');
DELETE FROM publicstream WHERE uid IN ('devuser', 'oibchello');

-- Verify cleanup
SELECT 'Remaining old format entries in publicstream:' as info;
SELECT COUNT(*) as count FROM publicstream WHERE uid NOT LIKE '%@%' OR uid = username;

SELECT 'Remaining old format entries in uploadlog:' as info;
SELECT COUNT(*) as count FROM uploadlog WHERE uid NOT LIKE '%@%';

SELECT 'Remaining old format entries in userquota:' as info;
SELECT COUNT(*) as count FROM userquota WHERE uid NOT LIKE '%@%';
