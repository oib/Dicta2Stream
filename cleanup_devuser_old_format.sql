-- Cleanup script for old format user 'devuser'
-- This user has username-based UID instead of email-based UID

-- Show what will be deleted before deletion
SELECT 'publicstream entries to delete:' as info;
SELECT uid, username, storage_bytes, created_at FROM publicstream WHERE uid = 'devuser';

SELECT 'uploadlog entries to delete:' as info;
SELECT COUNT(*) as count, uid FROM uploadlog WHERE uid = 'devuser' GROUP BY uid;

SELECT 'userquota entries to delete:' as info;
SELECT uid FROM userquota WHERE uid = 'devuser';

-- Delete from all related tables
-- Start with dependent tables first
DELETE FROM uploadlog WHERE uid = 'devuser';
DELETE FROM userquota WHERE uid = 'devuser';
DELETE FROM publicstream WHERE uid = 'devuser';

-- Verify cleanup
SELECT 'Remaining entries for devuser in publicstream:' as info;
SELECT COUNT(*) as count FROM publicstream WHERE uid = 'devuser';

SELECT 'Remaining entries for devuser in uploadlog:' as info;
SELECT COUNT(*) as count FROM uploadlog WHERE uid = 'devuser';

SELECT 'Remaining entries for devuser in userquota:' as info;
SELECT COUNT(*) as count FROM userquota WHERE uid = 'devuser';

SELECT 'Total remaining old format entries in publicstream:' as info;
SELECT COUNT(*) as count FROM publicstream WHERE uid NOT LIKE '%@%' OR uid = username;
