#!/usr/bin/env python3
"""
UID Migration Script - Complete migration from username-based to email-based UIDs

This script completes the UID migration by updating remaining username-based UIDs
in the database to use proper email format.

Based on previous migration history:
- devuser -> oib@bubuit.net (as per migration memory)
- oibchello -> oib@chello.at (already completed)
"""

import psycopg2
import sys
from datetime import datetime

# Database connection string
DATABASE_URL = "postgresql://d2s:kuTy4ZKs2VcjgDh6@localhost:5432/dictastream"

def log_message(message):
    """Log message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def check_current_state(cursor):
    """Check current state of UID migration"""
    log_message("Checking current UID state...")
    
    # Check publicstream table
    cursor.execute("SELECT uid, username FROM publicstream WHERE uid NOT LIKE '%@%'")
    non_email_uids = cursor.fetchall()
    
    if non_email_uids:
        log_message(f"Found {len(non_email_uids)} non-email UIDs in publicstream:")
        for uid, username in non_email_uids:
            log_message(f"  - UID: {uid}, Username: {username}")
    else:
        log_message("All UIDs in publicstream are already in email format")
    
    # Check userquota table
    cursor.execute("SELECT uid FROM userquota WHERE uid NOT LIKE '%@%'")
    quota_non_email_uids = cursor.fetchall()
    
    if quota_non_email_uids:
        log_message(f"Found {len(quota_non_email_uids)} non-email UIDs in userquota:")
        for (uid,) in quota_non_email_uids:
            log_message(f"  - UID: {uid}")
    else:
        log_message("All UIDs in userquota are already in email format")
    
    return non_email_uids, quota_non_email_uids

def migrate_uids(cursor):
    """Migrate remaining username-based UIDs to email format"""
    log_message("Starting UID migration...")
    
    # Migration mapping based on previous migration history
    uid_mapping = {
        'devuser': 'oib@bubuit.net'
    }
    
    migration_count = 0
    
    for old_uid, new_uid in uid_mapping.items():
        log_message(f"Migrating UID: {old_uid} -> {new_uid}")
        
        # Update publicstream table
        cursor.execute(
            "UPDATE publicstream SET uid = %s WHERE uid = %s",
            (new_uid, old_uid)
        )
        publicstream_updated = cursor.rowcount
        
        # Update userquota table
        cursor.execute(
            "UPDATE userquota SET uid = %s WHERE uid = %s",
            (new_uid, old_uid)
        )
        userquota_updated = cursor.rowcount
        
        # Update uploadlog table (if any records exist)
        cursor.execute(
            "UPDATE uploadlog SET uid = %s WHERE uid = %s",
            (new_uid, old_uid)
        )
        uploadlog_updated = cursor.rowcount
        
        log_message(f"  - Updated {publicstream_updated} records in publicstream")
        log_message(f"  - Updated {userquota_updated} records in userquota")
        log_message(f"  - Updated {uploadlog_updated} records in uploadlog")
        
        migration_count += publicstream_updated + userquota_updated + uploadlog_updated
    
    return migration_count

def verify_migration(cursor):
    """Verify migration was successful"""
    log_message("Verifying migration...")
    
    # Check for any remaining non-email UIDs
    cursor.execute("""
        SELECT 'publicstream' as table_name, uid FROM publicstream WHERE uid NOT LIKE '%@%'
        UNION ALL
        SELECT 'userquota' as table_name, uid FROM userquota WHERE uid NOT LIKE '%@%'
        UNION ALL
        SELECT 'uploadlog' as table_name, uid FROM uploadlog WHERE uid NOT LIKE '%@%'
    """)
    
    remaining_non_email = cursor.fetchall()
    
    if remaining_non_email:
        log_message("WARNING: Found remaining non-email UIDs:")
        for table_name, uid in remaining_non_email:
            log_message(f"  - {table_name}: {uid}")
        return False
    else:
        log_message("SUCCESS: All UIDs are now in email format")
        return True

def main():
    """Main migration function"""
    log_message("Starting UID migration script")
    
    try:
        # Connect to database
        log_message("Connecting to database...")
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Check current state
        non_email_uids, quota_non_email_uids = check_current_state(cursor)
        
        if not non_email_uids and not quota_non_email_uids:
            log_message("No migration needed - all UIDs are already in email format")
            return
        
        # Perform migration
        migration_count = migrate_uids(cursor)
        
        # Commit changes
        conn.commit()
        log_message(f"Migration committed - {migration_count} records updated")
        
        # Verify migration
        if verify_migration(cursor):
            log_message("UID migration completed successfully!")
        else:
            log_message("UID migration completed with warnings - manual review needed")
        
    except psycopg2.Error as e:
        log_message(f"Database error: {e}")
        if conn:
            conn.rollback()
        sys.exit(1)
    except Exception as e:
        log_message(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        log_message("Database connection closed")

if __name__ == "__main__":
    main()
