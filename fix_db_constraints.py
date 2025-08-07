#!/usr/bin/env python3
"""
Fix Database Constraints and Legacy Data
Handles foreign key constraints properly during cleanup
"""

import sys
from sqlmodel import Session, text
from database import engine

def execute_query(session, query, description):
    """Execute a query and report results"""
    print(f"\n{description}")
    print(f"Query: {query}")
    
    try:
        result = session.exec(text(query))
        if query.strip().upper().startswith('SELECT'):
            rows = result.fetchall()
            print(f"Result: {len(rows)} rows")
            for row in rows:
                print(f"  {row}")
        else:
            session.commit()
            print(f"✅ Success: {result.rowcount} rows affected")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        session.rollback()
        return False

def main():
    """Fix database constraints and legacy data"""
    print("=== FIXING DATABASE CONSTRAINTS AND LEGACY DATA ===")
    
    with Session(engine) as session:
        
        # Step 1: First, let's temporarily drop the foreign key constraint
        print("\n=== STEP 1: Handle Foreign Key Constraint ===")
        
        # Check current constraint
        execute_query(
            session,
            """SELECT conname, conrelid::regclass, confrelid::regclass 
               FROM pg_constraint 
               WHERE conname = 'dbsession_user_id_fkey'""",
            "Check existing foreign key constraint"
        )
        
        # Drop the constraint temporarily
        execute_query(
            session,
            """ALTER TABLE dbsession DROP CONSTRAINT IF EXISTS dbsession_user_id_fkey""",
            "Drop foreign key constraint temporarily"
        )
        
        # Step 2: Update user table
        print("\n=== STEP 2: Update User Table ===")
        execute_query(
            session,
            """UPDATE "user" 
               SET username = email, 
                   display_name = CASE 
                       WHEN display_name = '' OR display_name IS NULL 
                       THEN split_part(email, '@', 1)
                       ELSE display_name 
                   END
               WHERE email = 'oib@chello.at'""",
            "Update user username to match email"
        )
        
        # Verify user update
        execute_query(
            session,
            """SELECT email, username, display_name FROM "user" WHERE email = 'oib@chello.at'""",
            "Verify user table update"
        )
        
        # Step 3: Update session user_id references
        print("\n=== STEP 3: Update Session References ===")
        execute_query(
            session,
            """UPDATE dbsession 
               SET user_id = 'oib@chello.at' 
               WHERE user_id = 'oibchello'""",
            "Update session user_id to email format"
        )
        
        # Verify session updates
        execute_query(
            session,
            """SELECT DISTINCT user_id FROM dbsession""",
            "Verify session user_id updates"
        )
        
        # Step 4: Recreate the foreign key constraint
        print("\n=== STEP 4: Recreate Foreign Key Constraint ===")
        execute_query(
            session,
            """ALTER TABLE dbsession 
               ADD CONSTRAINT dbsession_user_id_fkey 
               FOREIGN KEY (user_id) REFERENCES "user"(username)""",
            "Recreate foreign key constraint"
        )
        
        # Step 5: Final verification - check for remaining issues
        print("\n=== STEP 5: Final Verification ===")
        
        # Check user email/username match
        execute_query(
            session,
            """SELECT email, username, 
                      CASE WHEN email = username THEN '✓ Match' ELSE '✗ Mismatch' END as status
               FROM "user""",
            "Check user email/username consistency"
        )
        
        # Check expired sessions
        execute_query(
            session,
            """SELECT COUNT(*) as expired_active_sessions 
               FROM dbsession 
               WHERE expires_at < NOW() AND is_active = true""",
            "Check for expired active sessions"
        )
        
        # Check PublicStream consistency
        execute_query(
            session,
            """SELECT uid, username, 
                      CASE WHEN uid = username THEN '✓ Match' ELSE '✗ Mismatch' END as status
               FROM publicstream""",
            "Check PublicStream UID/username consistency"
        )
        
        # Check for orphaned records
        execute_query(
            session,
            """SELECT 'userquota' as table_name, COUNT(*) as orphaned_records
               FROM userquota q
               LEFT JOIN "user" u ON q.uid = u.email
               WHERE u.email IS NULL
               UNION ALL
               SELECT 'publicstream' as table_name, COUNT(*) as orphaned_records
               FROM publicstream p
               LEFT JOIN "user" u ON p.uid = u.email
               WHERE u.email IS NULL""",
            "Check for orphaned records"
        )
        
        # Summary of current state
        print("\n=== DATABASE STATE SUMMARY ===")
        execute_query(
            session,
            """SELECT 
                   COUNT(DISTINCT u.email) as total_users,
                   COUNT(DISTINCT q.uid) as quota_records,
                   COUNT(DISTINCT p.uid) as stream_records,
                   COUNT(CASE WHEN s.is_active THEN 1 END) as active_sessions,
                   COUNT(CASE WHEN s.expires_at < NOW() AND s.is_active THEN 1 END) as expired_active_sessions
               FROM "user" u
               FULL OUTER JOIN userquota q ON u.email = q.uid
               FULL OUTER JOIN publicstream p ON u.email = p.uid
               FULL OUTER JOIN dbsession s ON u.username = s.user_id""",
            "Database state summary"
        )
        
        print("\n✅ Database cleanup completed!")
        print("All legacy data issues should now be resolved.")
        
        return 0

if __name__ == "__main__":
    sys.exit(main())
