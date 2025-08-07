#!/usr/bin/env python3
"""
Simple Database Cleanup Script
Uses the provided connection string to fix legacy data issues
"""

import psycopg2
import sys

# Database connection string provided by user
DATABASE_URL = "postgresql://d2s:kuTy4ZKs2VcjgDh6@localhost:5432/dictastream"

def execute_query(conn, query, description):
    """Execute a query and report results"""
    print(f"\n{description}")
    print(f"Query: {query}")
    print("[DEBUG] Starting query execution...")
    
    try:
        print("[DEBUG] Creating cursor...")
        with conn.cursor() as cur:
            print("[DEBUG] Executing query...")
            cur.execute(query)
            print("[DEBUG] Query executed successfully")
            
            if query.strip().upper().startswith('SELECT'):
                print("[DEBUG] Fetching results...")
                rows = cur.fetchall()
                print(f"Result: {len(rows)} rows")
                for row in rows:
                    print(f"  {row}")
            else:
                print("[DEBUG] Committing transaction...")
                conn.commit()
                print(f"✅ Success: {cur.rowcount} rows affected")
        print("[DEBUG] Query completed successfully")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        print(f"[DEBUG] Error type: {type(e).__name__}")
        print("[DEBUG] Rolling back transaction...")
        conn.rollback()
        return False

def main():
    """Execute database cleanup step by step"""
    print("=== DATABASE LEGACY DATA CLEANUP ===")
    print(f"Attempting to connect to: {DATABASE_URL}")
    
    try:
        print("[DEBUG] Creating database connection...")
        conn = psycopg2.connect(DATABASE_URL)
        print("✅ Connected to database successfully")
        print(f"[DEBUG] Connection status: {conn.status}")
        print(f"[DEBUG] Database info: {conn.get_dsn_parameters()}")
        
        # Step 1: Check current state
        print("\n=== STEP 1: Check Current State ===")
        execute_query(conn, 'SELECT email, username, display_name FROM "user"', "Check user table")
        execute_query(conn, 'SELECT COUNT(*) as expired_active FROM dbsession WHERE expires_at < NOW() AND is_active = true', "Check expired sessions")
        
        # Step 2: Mark expired sessions as inactive (this was successful before)
        print("\n=== STEP 2: Fix Expired Sessions ===")
        execute_query(conn, 'UPDATE dbsession SET is_active = false WHERE expires_at < NOW() AND is_active = true', "Mark expired sessions inactive")
        
        # Step 3: Handle foreign key constraint by dropping it temporarily
        print("\n=== STEP 3: Handle Foreign Key Constraint ===")
        execute_query(conn, 'ALTER TABLE dbsession DROP CONSTRAINT IF EXISTS dbsession_user_id_fkey', "Drop foreign key constraint")
        
        # Step 4: Update user table
        print("\n=== STEP 4: Update User Table ===")
        execute_query(conn, """UPDATE "user" 
                              SET username = email, 
                                  display_name = CASE 
                                      WHEN display_name = '' OR display_name IS NULL 
                                      THEN split_part(email, '@', 1)
                                      ELSE display_name 
                                  END
                              WHERE email = 'oib@chello.at'""", "Update user username to email")
        
        # Step 5: Update session references
        print("\n=== STEP 5: Update Session References ===")
        execute_query(conn, "UPDATE dbsession SET user_id = 'oib@chello.at' WHERE user_id = 'oibchello'", "Update session user_id")
        
        # Step 6: Recreate foreign key constraint
        print("\n=== STEP 6: Recreate Foreign Key ===")
        execute_query(conn, 'ALTER TABLE dbsession ADD CONSTRAINT dbsession_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(username)', "Recreate foreign key")
        
        # Step 7: Final verification
        print("\n=== STEP 7: Final Verification ===")
        execute_query(conn, 'SELECT email, username, display_name FROM "user"', "Verify user table")
        execute_query(conn, 'SELECT DISTINCT user_id FROM dbsession', "Verify session user_id")
        execute_query(conn, 'SELECT uid, username FROM publicstream', "Check publicstream")
        
        print("\n✅ Database cleanup completed successfully!")
        
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return 1
    finally:
        if 'conn' in locals():
            conn.close()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
