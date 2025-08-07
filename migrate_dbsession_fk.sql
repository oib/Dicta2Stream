-- Migration script to update DBSession foreign key to reference user.email
-- Run this when no active sessions exist to avoid deadlocks

BEGIN;

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE dbsession DROP CONSTRAINT IF EXISTS dbsession_user_id_fkey;

-- Step 2: Add the new foreign key constraint referencing user.email
ALTER TABLE dbsession ADD CONSTRAINT dbsession_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES "user"(email);

COMMIT;
