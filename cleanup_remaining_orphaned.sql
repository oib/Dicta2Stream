-- Cleanup remaining orphaned uploadlog entries for devuser
DELETE FROM uploadlog WHERE uid = 'devuser';

-- Verify cleanup
SELECT 'All remaining uploadlog entries after cleanup:' as info;
SELECT uid, filename, created_at FROM uploadlog ORDER BY created_at DESC;
