#!/usr/bin/env python3
"""
Execute Database Legacy Data Cleanup
Fixes issues identified in the database analysis using direct SQL execution
"""

import sys
from sqlmodel import Session, text
from database import engine

def execute_step(session, step_name, query, description):
    """Execute a cleanup step and report results"""
    print(f"\n=== {step_name} ===")
    print(f"Description: {description}")
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
    """Execute database cleanup step by step"""
    print("=== DATABASE LEGACY DATA CLEANUP ===")
    
    with Session(engine) as session:
        success_count = 0
        total_steps = 0
        
        # Step 1: Fix User Table - Update username to match email format
        total_steps += 1
        if execute_step(
            session,
            "STEP 1: Fix User Table",
            """UPDATE "user" 
               SET username = email, 
                   display_name = CASE 
                       WHEN display_name = '' OR display_name IS NULL 
                       THEN split_part(email, '@', 1)
                       ELSE display_name 
                   END
               WHERE email = 'oib@chello.at'""",
            "Update username to match email format and set display_name"
        ):
            success_count += 1
        
        # Verify Step 1
        execute_step(
            session,
            "VERIFY STEP 1",
            """SELECT email, username, display_name, confirmed 
               FROM "user" WHERE email = 'oib@chello.at'""",
            "Verify user table fix"
        )
        
        # Step 2: Clean Up Expired Sessions
        total_steps += 1
        if execute_step(
            session,
            "STEP 2: Mark Expired Sessions Inactive",
            """UPDATE dbsession 
               SET is_active = false 
               WHERE expires_at < NOW() AND is_active = true""",
            "Mark expired sessions as inactive for security"
        ):
            success_count += 1
        
        # Verify Step 2
        execute_step(
            session,
            "VERIFY STEP 2",
            """SELECT COUNT(*) as expired_active_sessions 
               FROM dbsession 
               WHERE expires_at < NOW() AND is_active = true""",
            "Check for remaining expired active sessions"
        )
        
        # Step 3: Update Session user_id to Email Format
        total_steps += 1
        if execute_step(
            session,
            "STEP 3: Update Session user_id",
            """UPDATE dbsession 
               SET user_id = 'oib@chello.at' 
               WHERE user_id = 'oibchello'""",
            "Update session user_id to use email format"
        ):
            success_count += 1
        
        # Verify Step 3
        execute_step(
            session,
            "VERIFY STEP 3",
            """SELECT DISTINCT user_id FROM dbsession""",
            "Check session user_id values"
        )
        
        # Step 4: Fix PublicStream Username Fields
        total_steps += 1
        if execute_step(
            session,
            "STEP 4: Fix PublicStream",
            """UPDATE publicstream 
               SET username = uid,
                   display_name = CASE 
                       WHEN display_name = 'oibchello' 
                       THEN split_part(uid, '@', 1)
                       ELSE display_name 
                   END
               WHERE uid = 'oib@chello.at'""",
            "Update PublicStream username to match UID"
        ):
            success_count += 1
        
        # Verify Step 4
        execute_step(
            session,
            "VERIFY STEP 4",
            """SELECT uid, username, display_name 
               FROM publicstream WHERE uid = 'oib@chello.at'""",
            "Verify PublicStream fix"
        )
        
        # Step 5: Remove Orphaned Records
        total_steps += 1
        orphan_success = True
        
        # Remove orphaned quota record
        if not execute_step(
            session,
            "STEP 5a: Remove Orphaned Quota",
            """DELETE FROM userquota WHERE uid = 'oib@bubuit.net'""",
            "Remove orphaned quota record for deleted user"
        ):
            orphan_success = False
        
        # Remove orphaned stream record
        if not execute_step(
            session,
            "STEP 5b: Remove Orphaned Stream",
            """DELETE FROM publicstream WHERE uid = 'oib@bubuit.net'""",
            "Remove orphaned stream record for deleted user"
        ):
            orphan_success = False
        
        if orphan_success:
            success_count += 1
        
        # Verify Step 5
        execute_step(
            session,
            "VERIFY STEP 5",
            """SELECT 'userquota' as table_name, COUNT(*) as count 
               FROM userquota WHERE uid = 'oib@bubuit.net'
               UNION ALL
               SELECT 'publicstream' as table_name, COUNT(*) as count 
               FROM publicstream WHERE uid = 'oib@bubuit.net'""",
            "Verify orphaned records are removed"
        )
        
        # Final Verification
        print(f"\n=== FINAL VERIFICATION ===")
        
        # Check for remaining issues
        execute_step(
            session,
            "FINAL CHECK",
            """SELECT 'ISSUE: User email/username mismatch' as issue
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
               LIMIT 1""",
            "Check for any remaining legacy issues"
        )
        
        # Summary
        print(f"\n=== CLEANUP SUMMARY ===")
        print(f"Total steps: {total_steps}")
        print(f"Successful steps: {success_count}")
        print(f"Failed steps: {total_steps - success_count}")
        
        if success_count == total_steps:
            print("✅ All legacy database issues have been fixed!")
        else:
            print("⚠️  Some issues remain. Check the output above for details.")
        
        return 0 if success_count == total_steps else 1

if __name__ == "__main__":
    sys.exit(main())
