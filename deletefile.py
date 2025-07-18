# deletefile.py — FastAPI route for file deletion

import os
import shutil
from typing import Optional, Dict, Any
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, Depends, status, Header
from sqlalchemy import select, delete, and_
from sqlalchemy.orm import Session

from database import get_db
from models import UploadLog, UserQuota, User, DBSession

router = APIRouter()
# Use absolute path for security
DATA_ROOT = Path(os.path.abspath("./data"))

def get_current_user(
    authorization: str = Header(None, description="Bearer token for authentication"),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current user from authorization token with enhanced security.
    
    Args:
        authorization: The Authorization header containing the Bearer token
        db: Database session dependency
        
    Returns:
        User: The authenticated user
        
    Raises:
        HTTPException: If authentication fails or user not found
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    token = authorization.split(" ")[1]
    try:
        with Session(db) as session:
            # Check if session is valid
            session_stmt = select(DBSession).where(
                and_(
                    DBSession.token == token,
                    DBSession.is_active == True,
                    DBSession.expires_at > datetime.utcnow()
                )
            )
            db_session = session.exec(session_stmt).first()
            if not db_session:
                print(f"[DELETE_FILE] Invalid or expired session token")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired session"
                )
            
            # Get the user
            user = session.get(User, db_session.user_id)
            if not user:
                print(f"[DELETE_FILE] User not found for session token")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            
            return user
    except Exception as e:
        print(f"[DELETE_FILE] Error during user authentication: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error during authentication"
        )

@router.delete("/delete/{filename}")
async def delete_file(
    request: Request,
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Delete a file for the authenticated user with enhanced security and error handling.
    
    Args:
        request: The HTTP request object
        filename: The name of the file to delete
        db: Database session
        current_user: The authenticated user
        
    Returns:
        Dict: Status and message of the operation
        
    Raises:
        HTTPException: If file not found, permission denied, or other errors
    """
    print(f"[DELETE_FILE] Processing delete request for file '{filename}' from user {current_user.username}")
    
    try:
        # Security: Validate filename to prevent directory traversal
        if not filename or any(c in filename for c in ['..', '/', '\\']):
            print(f"[DELETE_FILE] Security alert: Invalid filename '{filename}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filename"
            )
        
        # Construct full path with security checks
        user_dir = DATA_ROOT / current_user.username
        file_path = (user_dir / filename).resolve()
        
        # Security: Ensure the file is within the user's directory
        if not file_path.is_relative_to(user_dir.resolve()):
            print(f"[DELETE_FILE] Security alert: Attempted path traversal: {file_path}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Verify file exists and is a file
        if not file_path.exists() or not file_path.is_file():
            print(f"[DELETE_FILE] File not found: {file_path}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Get file size before deletion for quota update
        file_size = file_path.stat().st_size
        print(f"[DELETE_FILE] Deleting file: {file_path} (size: {file_size} bytes)")
        
        # Start database transaction
        with Session(db) as session:
            try:
                # Delete the file
                try:
                    os.unlink(file_path)
                    print(f"[DELETE_FILE] Successfully deleted file: {file_path}")
                except OSError as e:
                    print(f"[DELETE_FILE] Error deleting file: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to delete file"
                    )
                
                # Clean up any associated raw files
                raw_pattern = f"raw.*{filename}"
                raw_files = list(file_path.parent.glob(raw_pattern))
                for raw_file in raw_files:
                    try:
                        os.unlink(raw_file)
                        print(f"[DELETE_FILE] Deleted raw file: {raw_file}")
                    except OSError as e:
                        print(f"[DELETE_FILE] Warning: Could not delete raw file {raw_file}: {str(e)}")
                
                # Delete the upload log entry
                result = session.execute(
                    delete(UploadLog).where(
                        and_(
                            UploadLog.uid == current_user.username,
                            UploadLog.processed_filename == filename
                        )
                    )
                )
                
                if result.rowcount == 0:
                    print(f"[DELETE_FILE] Warning: No upload log entry found for {filename}")
                else:
                    print(f"[DELETE_FILE] Deleted upload log entry for {filename}")
                
                # Update user quota
                quota = session.exec(
                    select(UserQuota)
                    .where(UserQuota.uid == current_user.username)
                    .with_for_update()
                ).first()
                
                if quota:
                    new_quota = max(0, quota.storage_bytes - file_size)
                    print(f"[DELETE_FILE] Updating quota: {quota.storage_bytes} -> {new_quota}")
                    quota.storage_bytes = new_quota
                    session.add(quota)
                
                session.commit()
                print(f"[DELETE_FILE] Successfully updated database")
                
                return {
                    "status": "success",
                    "message": "File deleted successfully",
                    "bytes_freed": file_size
                }
                
            except Exception as e:
                session.rollback()
                print(f"[DELETE_FILE] Database error: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database error during file deletion"
                )
    
    except HTTPException as he:
        print(f"[DELETE_FILE] HTTP Error {he.status_code}: {he.detail}")
        raise
        
    except Exception as e:
        print(f"[DELETE_FILE] Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )
