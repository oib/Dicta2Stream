# account_router.py — Account management endpoints

from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from models import User, UserQuota, UploadLog, DBSession, PublicStream
from database import get_db
import os
from typing import Dict, Any

router = APIRouter(prefix="/api", tags=["account"])

@router.post("/delete-account")
async def delete_account(data: Dict[str, Any], request: Request, db: Session = Depends(get_db)):
    try:
        # Get UID from request data
        uid = data.get("uid")
        if not uid:
            print(f"[DELETE_ACCOUNT] Error: Missing UID in request data")
            raise HTTPException(status_code=400, detail="Missing UID")

        ip = request.client.host
        print(f"[DELETE_ACCOUNT] Processing delete request for UID: {uid} from IP: {ip}")

        # Verify user exists and IP matches
        # Handle both email-based and username-based UIDs for backward compatibility
        user = None
        
        # First try to find by email (new UID format)
        if '@' in uid:
            user = db.exec(select(User).where(User.email == uid)).first()
            print(f"[DELETE_ACCOUNT] Looking up user by email: {uid}")
        
        # If not found by email, try by username (legacy UID format)
        if not user:
            user = db.exec(select(User).where(User.username == uid)).first()
            print(f"[DELETE_ACCOUNT] Looking up user by username: {uid}")
            
        if not user:
            print(f"[DELETE_ACCOUNT] Error: User {uid} not found (tried both email and username lookup)")
            raise HTTPException(status_code=404, detail="User not found")
            
        # Use the actual email as the UID for database operations
        actual_uid = user.email
        print(f"[DELETE_ACCOUNT] Found user: {user.username} ({user.email}), using email as UID: {actual_uid}")
            
        if user.ip != ip:
            print(f"[DELETE_ACCOUNT] Error: IP mismatch. User IP: {user.ip}, Request IP: {ip}")
            raise HTTPException(status_code=403, detail="Unauthorized: IP address does not match")

        # Start transaction
        try:
            # Delete user's upload logs (use actual_uid which is always the email)
            uploads = db.exec(select(UploadLog).where(UploadLog.uid == actual_uid)).all()
            for upload in uploads:
                db.delete(upload)
            print(f"[DELETE_ACCOUNT] Deleted {len(uploads)} upload logs for user {actual_uid}")

            # Delete user's public streams
            streams = db.exec(select(PublicStream).where(PublicStream.uid == actual_uid)).all()
            for stream in streams:
                db.delete(stream)
            print(f"[DELETE_ACCOUNT] Deleted {len(streams)} public streams for user {actual_uid}")

            # Delete user's quota
            quota = db.get(UserQuota, actual_uid)
            if quota:
                db.delete(quota)
                print(f"[DELETE_ACCOUNT] Deleted quota for user {actual_uid}")

            # Delete user's active sessions (check both email and username as user_id)
            sessions_by_email = db.exec(select(DBSession).where(DBSession.user_id == actual_uid)).all()
            sessions_by_username = db.exec(select(DBSession).where(DBSession.user_id == user.username)).all()
            
            all_sessions = list(sessions_by_email) + list(sessions_by_username)
            # Remove duplicates using token (primary key) instead of id
            unique_sessions = {session.token: session for session in all_sessions}.values()
            
            for session in unique_sessions:
                db.delete(session)
            print(f"[DELETE_ACCOUNT] Deleted {len(unique_sessions)} active sessions for user {actual_uid} (checked both email and username)")

            # Delete user account
            user_obj = db.get(User, actual_uid)  # Use actual_uid which is the email
            if user_obj:
                db.delete(user_obj)
                print(f"[DELETE_ACCOUNT] Deleted user account {actual_uid}")

            db.commit()
            print(f"[DELETE_ACCOUNT] Database changes committed for user {actual_uid}")

        except Exception as e:
            db.rollback()
            print(f"[DELETE_ACCOUNT] Database error during account deletion: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error during account deletion")

        # Delete user's files
        try:
            user_dir = os.path.join('data', user.username)
            real_user_dir = os.path.realpath(user_dir)
            
            # Security check to prevent directory traversal
            if not real_user_dir.startswith(os.path.realpath('data')):
                print(f"[DELETE_ACCOUNT] Security alert: Invalid user directory path: {user_dir}")
                raise HTTPException(status_code=400, detail="Invalid user directory")
                
            if os.path.exists(real_user_dir):
                import shutil
                shutil.rmtree(real_user_dir, ignore_errors=True)
                print(f"[DELETE_ACCOUNT] Deleted user directory: {real_user_dir}")
            else:
                print(f"[DELETE_ACCOUNT] User directory not found: {real_user_dir}")
                
        except Exception as e:
            print(f"[DELETE_ACCOUNT] Error deleting user files: {str(e)}")
            # Continue even if file deletion fails, as the account is already deleted from the DB

        print(f"[DELETE_ACCOUNT] Successfully deleted account for user {actual_uid} (original UID: {uid})")
        return {"status": "success", "message": "Account and all associated data have been deleted"}
        
    except HTTPException as he:
        print(f"[DELETE_ACCOUNT] HTTP Error {he.status_code}: {he.detail}")
        raise
    except Exception as e:
        print(f"[DELETE_ACCOUNT] Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
