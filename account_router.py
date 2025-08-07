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
async def delete_account(data: Dict[str, Any], request: Request):
    try:
        # Get UID from request data
        uid = data.get("uid")
        if not uid:
            # Debug messages disabled
            raise HTTPException(status_code=400, detail="Missing UID")

        ip = request.client.host
        # Debug messages disabled

        # Verify user exists and IP matches
        # Use the database session context manager
        with get_db() as db:
            # Handle both email-based and username-based UIDs for backward compatibility
            user = None
            
            # First try to find by email (new UID format)
            if '@' in uid:
                user = db.query(User).filter(User.email == uid).first()
                # Debug messages disabled
            
            # If not found by email, try by username (legacy UID format)
            if not user:
                user = db.query(User).filter(User.username == uid).first()
                # Debug messages disabled
                
            if not user:
                # Debug messages disabled
                raise HTTPException(status_code=404, detail="User not found")
            
            # Extract user attributes while the object is still bound to the session
            actual_uid = user.email
            user_ip = user.ip
            username = user.username
            
        # Debug messages disabled
            
        if user_ip != ip:
            # Debug messages disabled
            raise HTTPException(status_code=403, detail="Unauthorized: IP address does not match")

        # Use the database session context manager for all database operations
        with get_db() as db:
            try:
                # Delete user's upload logs (use actual_uid which is always the email)
                uploads = db.query(UploadLog).filter(UploadLog.uid == actual_uid).all()
                for upload in uploads:
                    db.delete(upload)
                # Debug messages disabled

                # Delete user's public streams
                streams = db.query(PublicStream).filter(PublicStream.uid == actual_uid).all()
                for stream in streams:
                    db.delete(stream)
                # Debug messages disabled

                # Delete user's quota
                quota = db.get(UserQuota, actual_uid)
                if quota:
                    db.delete(quota)
                    # Debug messages disabled

                # Delete user's active sessions (check both email and username as uid)
                sessions_by_email = db.query(DBSession).filter(DBSession.uid == actual_uid).all()
                sessions_by_username = db.query(DBSession).filter(DBSession.uid == username).all()
                
                all_sessions = list(sessions_by_email) + list(sessions_by_username)
                # Remove duplicates using token (primary key)
                unique_sessions = {session.token: session for session in all_sessions}.values()
                
                for session in unique_sessions:
                    db.delete(session)
                # Debug messages disabled

                # Delete user account
                user_obj = db.get(User, actual_uid)  # Use actual_uid which is the email
                if user_obj:
                    db.delete(user_obj)
                    # Debug messages disabled

                db.commit()
                # Debug messages disabled

            except Exception as e:
                db.rollback()
                # Debug messages disabled
                # Debug messages disabled
                raise HTTPException(status_code=500, detail="Database error during account deletion")

        # Delete user's files
        try:
            # Use the email (actual_uid) for the directory name, which matches how files are stored
            user_dir = os.path.join('data', actual_uid)
            real_user_dir = os.path.realpath(user_dir)
            
            # Security check to prevent directory traversal
            if not real_user_dir.startswith(os.path.realpath('data')):
                # Debug messages disabled
                raise HTTPException(status_code=400, detail="Invalid user directory")
                
            if os.path.exists(real_user_dir):
                import shutil
                shutil.rmtree(real_user_dir, ignore_errors=True)
                # Debug messages disabled
            else:
                # Debug messages disabled
                pass
                
        except Exception as e:
            # Debug messages disabled
            # Continue even if file deletion fails, as the account is already deleted from the DB
            pass

        # Debug messages disabled
        return {"status": "success", "message": "Account and all associated data have been deleted"}
        
    except HTTPException as he:
        # Debug messages disabled
        raise
    except Exception as e:
        # Debug messages disabled
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
