# account_router.py — Account management endpoints

from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from models import User, UserQuota, UploadLog, DBSession
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
        user = db.exec(select(User).where(User.username == uid)).first()
        if not user:
            print(f"[DELETE_ACCOUNT] Error: User {uid} not found")
            raise HTTPException(status_code=404, detail="User not found")
            
        if user.ip != ip:
            print(f"[DELETE_ACCOUNT] Error: IP mismatch. User IP: {user.ip}, Request IP: {ip}")
            raise HTTPException(status_code=403, detail="Unauthorized: IP address does not match")

        # Start transaction
        try:
            # Delete user's upload logs
            uploads = db.exec(select(UploadLog).where(UploadLog.uid == uid)).all()
            for upload in uploads:
                db.delete(upload)
            print(f"[DELETE_ACCOUNT] Deleted {len(uploads)} upload logs for user {uid}")

            # Delete user's quota
            quota = db.get(UserQuota, uid)
            if quota:
                db.delete(quota)
                print(f"[DELETE_ACCOUNT] Deleted quota for user {uid}")

            # Delete user's active sessions
            sessions = db.exec(select(DBSession).where(DBSession.user_id == uid)).all()
            for session in sessions:
                db.delete(session)
            print(f"[DELETE_ACCOUNT] Deleted {len(sessions)} active sessions for user {uid}")

            # Delete user account
            user_obj = db.get(User, user.email)
            if user_obj:
                db.delete(user_obj)
                print(f"[DELETE_ACCOUNT] Deleted user account {uid} ({user.email})")

            db.commit()
            print(f"[DELETE_ACCOUNT] Database changes committed for user {uid}")

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

        print(f"[DELETE_ACCOUNT] Successfully deleted account for user {uid}")
        return {"status": "success", "message": "Account and all associated data have been deleted"}
        
    except HTTPException as he:
        print(f"[DELETE_ACCOUNT] HTTP Error {he.status_code}: {he.detail}")
        raise
    except Exception as e:
        print(f"[DELETE_ACCOUNT] Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
