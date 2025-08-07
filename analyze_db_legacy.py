#!/usr/bin/env python3
"""
Database Legacy Data Analysis Script
Analyzes the database for legacy data that doesn't match current authentication implementation
"""

import sys
from datetime import datetime, timedelta
from sqlmodel import Session, select
from database import engine
from models import User, UserQuota, UploadLog, DBSession, PublicStream
import re

def validate_email_format(email):
    """Validate email format using RFC 5322 compliant regex"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def analyze_user_table():
    """Analyze User table for legacy data issues"""
    print("\n=== ANALYZING USER TABLE ===")
    issues = []
    
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        print(f"Total users: {len(users)}")
        
        for user in users:
            user_issues = []
            
            # Check if email (primary key) is valid email format
            if not validate_email_format(user.email):
                user_issues.append(f"Invalid email format: {user.email}")
            
            # Check if username is also email format (current requirement)
            if not validate_email_format(user.username):
                user_issues.append(f"Username not in email format: {user.username}")
            
            # Check if email and username match (should be same after migration)
            if user.email != user.username:
                user_issues.append(f"Email/username mismatch: email={user.email}, username={user.username}")
            
            # Check for missing or empty display_name
            if not user.display_name or user.display_name.strip() == "":
                user_issues.append(f"Empty display_name")
            
            # Check for very old tokens (potential security issue)
            if user.token_created < datetime.utcnow() - timedelta(days=30):
                user_issues.append(f"Very old token (created: {user.token_created})")
            
            # Check for unconfirmed users
            if not user.confirmed:
                user_issues.append(f"Unconfirmed user")
            
            if user_issues:
                issues.append({
                    'email': user.email,
                    'username': user.username,
                    'issues': user_issues
                })
    
    print(f"Users with issues: {len(issues)}")
    for issue in issues:
        print(f"  User {issue['email']}:")
        for problem in issue['issues']:
            print(f"    - {problem}")
    
    return issues

def analyze_session_table():
    """Analyze DBSession table for legacy data issues"""
    print("\n=== ANALYZING SESSION TABLE ===")
    issues = []
    
    with Session(engine) as session:
        sessions = session.exec(select(DBSession)).all()
        print(f"Total sessions: {len(sessions)}")
        
        active_sessions = [s for s in sessions if s.is_active]
        expired_sessions = [s for s in sessions if s.expires_at < datetime.utcnow()]
        old_sessions = [s for s in sessions if s.created_at < datetime.utcnow() - timedelta(days=7)]
        
        print(f"Active sessions: {len(active_sessions)}")
        print(f"Expired sessions: {len(expired_sessions)}")
        print(f"Sessions older than 7 days: {len(old_sessions)}")
        
        for db_session in sessions:
            session_issues = []
            
            # Check if user_id is in email format (current requirement)
            if not validate_email_format(db_session.user_id):
                session_issues.append(f"user_id not in email format: {db_session.user_id}")
            
            # Check for expired but still active sessions
            if db_session.is_active and db_session.expires_at < datetime.utcnow():
                session_issues.append(f"Expired but still marked active (expires: {db_session.expires_at})")
            
            # Check for very old sessions that should be cleaned up
            if db_session.created_at < datetime.utcnow() - timedelta(days=30):
                session_issues.append(f"Very old session (created: {db_session.created_at})")
            
            # Check for sessions with 1-hour expiry (old system)
            session_duration = db_session.expires_at - db_session.created_at
            if session_duration < timedelta(hours=2):  # Less than 2 hours indicates old 1-hour sessions
                session_issues.append(f"Short session duration: {session_duration} (should be 24h)")
            
            if session_issues:
                issues.append({
                    'token': db_session.token[:10] + '...',
                    'user_id': db_session.user_id,
                    'created_at': db_session.created_at,
                    'expires_at': db_session.expires_at,
                    'issues': session_issues
                })
    
    print(f"Sessions with issues: {len(issues)}")
    for issue in issues:
        print(f"  Session {issue['token']} (user: {issue['user_id']}):")
        for problem in issue['issues']:
            print(f"    - {problem}")
    
    return issues

def analyze_quota_table():
    """Analyze UserQuota table for legacy data issues"""
    print("\n=== ANALYZING USER QUOTA TABLE ===")
    issues = []
    
    with Session(engine) as session:
        quotas = session.exec(select(UserQuota)).all()
        print(f"Total quota records: {len(quotas)}")
        
        for quota in quotas:
            quota_issues = []
            
            # Check if uid is in email format (current requirement)
            if not validate_email_format(quota.uid):
                quota_issues.append(f"UID not in email format: {quota.uid}")
            
            # Check for negative storage
            if quota.storage_bytes < 0:
                quota_issues.append(f"Negative storage: {quota.storage_bytes}")
            
            # Check for excessive storage (over 100MB limit)
            if quota.storage_bytes > 100 * 1024 * 1024:
                quota_issues.append(f"Storage over 100MB limit: {quota.storage_bytes / (1024*1024):.1f}MB")
            
            if quota_issues:
                issues.append({
                    'uid': quota.uid,
                    'storage_bytes': quota.storage_bytes,
                    'issues': quota_issues
                })
    
    print(f"Quota records with issues: {len(issues)}")
    for issue in issues:
        print(f"  Quota {issue['uid']} ({issue['storage_bytes']} bytes):")
        for problem in issue['issues']:
            print(f"    - {problem}")
    
    return issues

def analyze_upload_log_table():
    """Analyze UploadLog table for legacy data issues"""
    print("\n=== ANALYZING UPLOAD LOG TABLE ===")
    issues = []
    
    with Session(engine) as session:
        uploads = session.exec(select(UploadLog)).all()
        print(f"Total upload records: {len(uploads)}")
        
        for upload in uploads:
            upload_issues = []
            
            # Check if uid is in email format (current requirement)
            if not validate_email_format(upload.uid):
                upload_issues.append(f"UID not in email format: {upload.uid}")
            
            # Check for missing processed_filename
            if not upload.processed_filename:
                upload_issues.append(f"Missing processed_filename")
            
            # Check for negative file size
            if upload.size_bytes < 0:
                upload_issues.append(f"Negative file size: {upload.size_bytes}")
            
            # Check for very old uploads
            if upload.created_at < datetime.utcnow() - timedelta(days=365):
                upload_issues.append(f"Very old upload (created: {upload.created_at})")
            
            if upload_issues:
                issues.append({
                    'id': upload.id,
                    'uid': upload.uid,
                    'filename': upload.filename,
                    'created_at': upload.created_at,
                    'issues': upload_issues
                })
    
    print(f"Upload records with issues: {len(issues)}")
    for issue in issues:
        print(f"  Upload {issue['id']} (user: {issue['uid']}, file: {issue['filename']}):")
        for problem in issue['issues']:
            print(f"    - {problem}")
    
    return issues

def analyze_public_stream_table():
    """Analyze PublicStream table for legacy data issues"""
    print("\n=== ANALYZING PUBLIC STREAM TABLE ===")
    issues = []
    
    with Session(engine) as session:
        streams = session.exec(select(PublicStream)).all()
        print(f"Total public stream records: {len(streams)}")
        
        for stream in streams:
            stream_issues = []
            
            # Check if uid is in email format (current requirement)
            if not validate_email_format(stream.uid):
                stream_issues.append(f"UID not in email format: {stream.uid}")
            
            # Check if username is also email format (should match uid)
            if stream.username and not validate_email_format(stream.username):
                stream_issues.append(f"Username not in email format: {stream.username}")
            
            # Check if uid and username match (should be same after migration)
            if stream.username and stream.uid != stream.username:
                stream_issues.append(f"UID/username mismatch: uid={stream.uid}, username={stream.username}")
            
            # Check for negative storage
            if stream.storage_bytes < 0:
                stream_issues.append(f"Negative storage: {stream.storage_bytes}")
            
            # Check for missing display_name
            if not stream.display_name or stream.display_name.strip() == "":
                stream_issues.append(f"Empty display_name")
            
            if stream_issues:
                issues.append({
                    'uid': stream.uid,
                    'username': stream.username,
                    'display_name': stream.display_name,
                    'issues': stream_issues
                })
    
    print(f"Public stream records with issues: {len(issues)}")
    for issue in issues:
        print(f"  Stream {issue['uid']} (username: {issue['username']}):")
        for problem in issue['issues']:
            print(f"    - {problem}")
    
    return issues

def check_referential_integrity():
    """Check for referential integrity issues between tables"""
    print("\n=== CHECKING REFERENTIAL INTEGRITY ===")
    issues = []
    
    with Session(engine) as session:
        # Get all unique UIDs from each table
        users = session.exec(select(User.email)).all()
        user_usernames = session.exec(select(User.username)).all()
        quotas = session.exec(select(UserQuota.uid)).all()
        uploads = session.exec(select(UploadLog.uid)).all()
        streams = session.exec(select(PublicStream.uid)).all()
        sessions = session.exec(select(DBSession.user_id)).all()
        
        user_emails = set(users)
        user_usernames_set = set(user_usernames)
        quota_uids = set(quotas)
        upload_uids = set(uploads)
        stream_uids = set(streams)
        session_uids = set(sessions)
        
        print(f"Unique user emails: {len(user_emails)}")
        print(f"Unique user usernames: {len(user_usernames_set)}")
        print(f"Unique quota UIDs: {len(quota_uids)}")
        print(f"Unique upload UIDs: {len(upload_uids)}")
        print(f"Unique stream UIDs: {len(stream_uids)}")
        print(f"Unique session user_ids: {len(session_uids)}")
        
        # Check for orphaned records
        orphaned_quotas = quota_uids - user_emails
        orphaned_uploads = upload_uids - user_emails
        orphaned_streams = stream_uids - user_emails
        orphaned_sessions = session_uids - user_usernames_set  # Sessions use username as user_id
        
        if orphaned_quotas:
            issues.append(f"Orphaned quota records (no matching user): {orphaned_quotas}")
        
        if orphaned_uploads:
            issues.append(f"Orphaned upload records (no matching user): {orphaned_uploads}")
        
        if orphaned_streams:
            issues.append(f"Orphaned stream records (no matching user): {orphaned_streams}")
        
        if orphaned_sessions:
            issues.append(f"Orphaned session records (no matching user): {orphaned_sessions}")
        
        # Check for users without quota records
        users_without_quota = user_emails - quota_uids
        if users_without_quota:
            issues.append(f"Users without quota records: {users_without_quota}")
        
        # Check for users without stream records
        users_without_streams = user_emails - stream_uids
        if users_without_streams:
            issues.append(f"Users without stream records: {users_without_streams}")
    
    print(f"Referential integrity issues: {len(issues)}")
    for issue in issues:
        print(f"  - {issue}")
    
    return issues

def main():
    """Run complete database legacy analysis"""
    print("=== DATABASE LEGACY DATA ANALYSIS ===")
    print(f"Analysis started at: {datetime.utcnow()}")
    
    all_issues = {}
    
    try:
        all_issues['users'] = analyze_user_table()
        all_issues['sessions'] = analyze_session_table()
        all_issues['quotas'] = analyze_quota_table()
        all_issues['uploads'] = analyze_upload_log_table()
        all_issues['streams'] = analyze_public_stream_table()
        all_issues['integrity'] = check_referential_integrity()
        
        # Summary
        print("\n=== SUMMARY ===")
        total_issues = sum(len(issues) if isinstance(issues, list) else 1 for issues in all_issues.values())
        print(f"Total issues found: {total_issues}")
        
        for table, issues in all_issues.items():
            if issues:
                count = len(issues) if isinstance(issues, list) else 1
                print(f"  {table}: {count} issues")
        
        if total_issues == 0:
            print("✅ No legacy data issues found! Database is clean.")
        else:
            print("⚠️  Legacy data issues found. Consider running cleanup scripts.")
            
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
