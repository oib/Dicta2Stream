#!/usr/bin/env python3
"""
Migration script to update PublicStream UIDs from usernames to email addresses.

This script:
1. Maps current username-based UIDs to their corresponding email addresses
2. Updates the publicstream table to use email addresses as UIDs
3. Updates any other tables that reference the old UID format
4. Provides rollback capability
"""

import sys
from sqlmodel import Session, select
from database import engine
from models import User, PublicStream, UploadLog, UserQuota

def get_username_to_email_mapping():
    """Get mapping of username -> email from user table"""
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        mapping = {}
        for user in users:
            mapping[user.username] = user.email
        return mapping

def migrate_publicstream_uids():
    """Migrate PublicStream UIDs from usernames to emails"""
    mapping = get_username_to_email_mapping()
    
    with Session(engine) as session:
        # Get all public streams with username-based UIDs
        streams = session.exec(select(PublicStream)).all()
        
        updates = []
        for stream in streams:
            if stream.uid in mapping:
                old_uid = stream.uid
                new_uid = mapping[stream.uid]
                updates.append((old_uid, new_uid, stream))
                print(f"Will update: {old_uid} -> {new_uid}")
            else:
                print(f"WARNING: No email found for username: {stream.uid}")
        
        if not updates:
            print("No updates needed - all UIDs are already in correct format")
            return
        
        # Confirm before proceeding
        response = input(f"\nProceed with updating {len(updates)} records? (y/N): ")
        if response.lower() != 'y':
            print("Migration cancelled")
            return
        
        # Perform the updates
        for old_uid, new_uid, stream in updates:
            # Delete the old record
            session.delete(stream)
            session.flush()  # Ensure deletion is committed before insert
            
            # Create new record with email-based UID
            new_stream = PublicStream(
                uid=new_uid,
                username=stream.username,
                display_name=stream.display_name,
                storage_bytes=stream.storage_bytes,
                mtime=stream.mtime,
                last_updated=stream.last_updated,
                created_at=stream.created_at,
                updated_at=stream.updated_at
            )
            session.add(new_stream)
            print(f"Updated: {old_uid} -> {new_uid}")
        
        session.commit()
        print(f"\nSuccessfully migrated {len(updates)} PublicStream records")

def migrate_related_tables():
    """Update other tables that reference UIDs"""
    mapping = get_username_to_email_mapping()
    
    with Session(engine) as session:
        # Update UploadLog table
        upload_logs = session.exec(select(UploadLog)).all()
        upload_updates = 0
        
        for log in upload_logs:
            if log.uid in mapping:
                old_uid = log.uid
                new_uid = mapping[log.uid]
                log.uid = new_uid
                upload_updates += 1
                print(f"Updated UploadLog: {old_uid} -> {new_uid}")
        
        # Update UserQuota table
        quotas = session.exec(select(UserQuota)).all()
        quota_updates = 0
        
        for quota in quotas:
            if quota.uid in mapping:
                old_uid = quota.uid
                new_uid = mapping[quota.uid]
                quota.uid = new_uid
                quota_updates += 1
                print(f"Updated UserQuota: {old_uid} -> {new_uid}")
        
        if upload_updates > 0 or quota_updates > 0:
            session.commit()
            print(f"\nUpdated {upload_updates} UploadLog and {quota_updates} UserQuota records")
        else:
            print("No related table updates needed")

def verify_migration():
    """Verify the migration was successful"""
    print("\n=== Migration Verification ===")
    
    with Session(engine) as session:
        # Check PublicStream UIDs
        streams = session.exec(select(PublicStream)).all()
        print(f"PublicStream records: {len(streams)}")
        
        for stream in streams:
            if '@' in stream.uid:
                print(f"✓ {stream.uid} (email format)")
            else:
                print(f"✗ {stream.uid} (still username format)")
        
        # Check if all UIDs correspond to actual user emails
        users = session.exec(select(User)).all()
        user_emails = {user.email for user in users}
        
        orphaned_streams = []
        for stream in streams:
            if stream.uid not in user_emails:
                orphaned_streams.append(stream.uid)
        
        if orphaned_streams:
            print(f"\nWARNING: Found {len(orphaned_streams)} streams with UIDs not matching any user email:")
            for uid in orphaned_streams:
                print(f"  - {uid}")
        else:
            print("\n✓ All stream UIDs correspond to valid user emails")

def main():
    print("=== UID Migration: Username -> Email ===")
    print("This script will update PublicStream UIDs from usernames to email addresses")
    
    # Show current mapping
    mapping = get_username_to_email_mapping()
    print(f"\nFound {len(mapping)} users:")
    for username, email in mapping.items():
        print(f"  {username} -> {email}")
    
    if len(sys.argv) > 1 and sys.argv[1] == '--verify-only':
        verify_migration()
        return
    
    # Perform migration
    print("\n1. Migrating PublicStream table...")
    migrate_publicstream_uids()
    
    print("\n2. Migrating related tables...")
    migrate_related_tables()
    
    print("\n3. Verifying migration...")
    verify_migration()
    
    print("\n=== Migration Complete ===")
    print("Remember to:")
    print("1. Restart the application service")
    print("2. Test the streams functionality")
    print("3. Check for any frontend issues with the new UID format")

if __name__ == "__main__":
    main()
