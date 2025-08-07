-- Cleanup script for orphaned uploadlog entries
-- These entries have username-based UIDs that should have been deleted with the user

-- Show what will be deleted
SELECT 'Orphaned uploadlog entries to delete:' as info;
SELECT uid, filename, processed_filename, created_at FROM uploadlog WHERE uid = 'oibchello';

-- Delete the orphaned entries
DELETE FROM uploadlog WHERE uid = 'oibchello';

-- Verify cleanup
SELECT 'Remaining uploadlog entries for oibchello:' as info;
SELECT COUNT(*) as count FROM uploadlog WHERE uid = 'oibchello';

-- Show all remaining uploadlog entries
SELECT 'All remaining uploadlog entries:' as info;
SELECT uid, filename, created_at FROM uploadlog ORDER BY created_at DESC;
