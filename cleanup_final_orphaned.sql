-- Final cleanup of orphaned entries that prevent proper account deletion
-- These entries have username-based UIDs that should have been deleted

-- Show what will be deleted
SELECT 'Orphaned publicstream entries to delete:' as info;
SELECT uid, username FROM publicstream WHERE uid = 'oibchello';

SELECT 'Orphaned userquota entries to delete:' as info;
SELECT uid, storage_bytes FROM userquota WHERE uid = 'oibchello';

-- Delete the orphaned entries
DELETE FROM publicstream WHERE uid = 'oibchello';
DELETE FROM userquota WHERE uid = 'oibchello';

-- Verify cleanup
SELECT 'Remaining entries for oibchello:' as info;
SELECT 'publicstream' as table_name, COUNT(*) as count FROM publicstream WHERE uid = 'oibchello'
UNION ALL
SELECT 'userquota' as table_name, COUNT(*) as count FROM userquota WHERE uid = 'oibchello';
