# upload.py — FastAPI route for upload + quota check + voice conversion

from fastapi import APIRouter, UploadFile, Form, HTTPException, Request, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pathlib import Path
import json
import requests
from datetime import datetime
from convert_to_opus import convert_to_opus
from models import UploadLog, UserQuota, User, PublicStream
from sqlalchemy import select, or_
from database import get_db
from sqlalchemy.orm import Session

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()
#   # Not needed for SlowAPI ≥0.1.5
DATA_ROOT = Path("./data")



@limiter.limit("5/minute")
@router.post("/upload")
async def upload(request: Request, db = Depends(get_db), uid: str = Form(...), file: UploadFile = Form(...)):
    from log import log_violation
    import time
    
    # Generate a unique request ID for this upload
    request_id = str(int(time.time()))
    log_violation("UPLOAD", request.client.host, uid, f"[{request_id}] Starting upload of {file.filename}")
    
    try:
        # First, verify the user exists and is confirmed
        user = db.exec(select(User).where((User.username == uid) | (User.email == uid))).first()
        if user is not None and not isinstance(user, User) and hasattr(user, "__getitem__"):
            user = user[0]
            
        log_violation("UPLOAD", request.client.host, uid, f"[{request_id}] User check - found: {user is not None}, confirmed: {getattr(user, 'confirmed', False) if user else 'N/A'}")
        
        if not user or not hasattr(user, "confirmed") or not user.confirmed:
            raise HTTPException(status_code=403, detail="Account not confirmed")

        # Check quota before doing any file operations
        quota = db.get(UserQuota, uid) or UserQuota(uid=uid, storage_bytes=0)
        if quota.storage_bytes >= 100 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Quota exceeded")
            
        # Create user directory if it doesn't exist
        user_dir = DATA_ROOT / uid
        user_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate a unique filename for the processed file first
        import uuid
        unique_name = f"{uuid.uuid4()}.opus"
        raw_ext = file.filename.split(".")[-1].lower()
        raw_path = user_dir / ("raw." + raw_ext)
        processed_path = user_dir / unique_name
        
        # Clean up any existing raw files first (except the one we're about to create)
        for old_file in user_dir.glob('raw.*'):
            try:
                if old_file != raw_path:  # Don't delete the file we're about to create
                    old_file.unlink(missing_ok=True)
                    log_violation("UPLOAD", request.client.host, uid, f"[{request_id}] Cleaned up old file: {old_file}")
            except Exception as e:
                log_violation("UPLOAD_ERROR", request.client.host, uid, f"[{request_id}] Failed to clean up {old_file}: {e}")
        
        # Save the uploaded file temporarily
        log_violation("UPLOAD", request.client.host, uid, f"[{request_id}] Saving temporary file to {raw_path}")
        try:
            with open(raw_path, "wb") as f:
                content = await file.read()
                if not content:
                    raise ValueError("Uploaded file is empty")
                f.write(content)
                log_violation("UPLOAD", request.client.host, uid, f"[{request_id}] Successfully wrote {len(content)} bytes to {raw_path}")
        except Exception as e:
            log_violation("UPLOAD_ERROR", request.client.host, uid, f"[{request_id}] Failed to save {raw_path}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {e}")

        # Ollama music/singing check is disabled for this release
        log_violation("UPLOAD", request.client.host, uid, f"[{request_id}] Ollama music/singing check is disabled")

        try:
            convert_to_opus(str(raw_path), str(processed_path))
        except Exception as e:
            raw_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=str(e))

        original_size = raw_path.stat().st_size
        raw_path.unlink(missing_ok=True)  # cleanup

        # First, verify the file was created and has content
        if not processed_path.exists() or processed_path.stat().st_size == 0:
            raise HTTPException(status_code=500, detail="Failed to process audio file")
            
        # Concatenate all .opus files in random order to stream.opus for public playback
        # This is now done after the file is in its final location with log ID
        from concat_opus import concat_opus_files
        def update_stream_opus():
            try:
                concat_opus_files(user_dir, user_dir / "stream.opus")
            except Exception as e:
                # fallback: just use the latest processed file if concat fails
                import shutil
                stream_path = user_dir / "stream.opus"
                shutil.copy2(processed_path, stream_path)
                log_violation("STREAM_UPDATE", request.client.host, uid, 
                           f"[fallback] Updated stream.opus with {processed_path}")
            
        # We'll call this after the file is in its final location
            
        # Get the final file size
        size = processed_path.stat().st_size
        
        # Start a transaction
        try:
            # Create a log entry with the original filename
            log = UploadLog(
                uid=uid,
                ip=request.client.host,
                filename=file.filename,  # Store original filename
                processed_filename=unique_name,  # Store the processed filename
                size_bytes=size
            )
            db.add(log)
            db.flush()  # Get the log ID without committing
            
            # Rename the processed file to include the log ID for better tracking
            processed_with_id = user_dir / f"{log.id}_{unique_name}"
            if processed_path.exists():
                # First check if there's already a file with the same UUID but different prefix
                for existing_file in user_dir.glob(f"*_{unique_name}"):
                    if existing_file != processed_path:
                        log_violation("CLEANUP", request.client.host, uid, 
                                   f"[UPLOAD] Removing duplicate file: {existing_file}")
                        existing_file.unlink(missing_ok=True)
                
                # Now do the rename
                if processed_path != processed_with_id:
                    if processed_with_id.exists():
                        processed_with_id.unlink(missing_ok=True)
                    processed_path.rename(processed_with_id)
                    processed_path = processed_with_id
                
                # Only clean up raw.* files, not previously uploaded opus files
                for old_temp_file in user_dir.glob('raw.*'):
                    try:
                        old_temp_file.unlink(missing_ok=True)
                        log_violation("CLEANUP", request.client.host, uid, f"[{request_id}] Cleaned up temp file: {old_temp_file}")
                    except Exception as e:
                        log_violation("CLEANUP_ERROR", request.client.host, uid, f"[{request_id}] Failed to clean up {old_temp_file}: {e}")
            
            # Get or create quota
            quota = db.query(UserQuota).filter(UserQuota.uid == uid).first()
            if not quota:
                quota = UserQuota(uid=uid, storage_bytes=0)
                db.add(quota)
                
            # Update quota with the new file size
            quota.storage_bytes = sum(
                f.stat().st_size 
                for f in user_dir.glob('*.opus') 
                if f.name != 'stream.opus' and f != processed_path
            ) + size
            
            # Update public streams
            update_public_streams(uid, quota.storage_bytes, db)
            
            # Commit the transaction
            db.commit()
            
            # Now that the transaction is committed and files are in their final location,
            # update the stream.opus file to include all files
            update_stream_opus()
            
        except Exception as e:
            db.rollback()
            # Clean up the processed file if something went wrong
            if processed_path.exists():
                processed_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

        return {
            "filename": file.filename,
            "original_size": round(original_size / 1024, 1),
            "quota": {
                "used_mb": round(quota.storage_bytes / (1024 * 1024), 2)
            }
        }
    except HTTPException as e:
        # Already a JSON response, just re-raise
        raise e
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        # Log and return a JSON error
        try:
            log_violation("UPLOAD", request.client.host, uid, f"Unexpected error: {type(e).__name__}: {str(e)}\n{tb}")
        except Exception:
            pass
        return {"detail": f"Server error: {type(e).__name__}: {str(e)}"}


def update_public_streams(uid: str, storage_bytes: int, db: Session):
    """Update the public streams list in the database with the latest user upload info"""
    try:
        # Get the user's info
        user = db.query(User).filter(User.username == uid).first()
        if not user:
            print(f"[WARNING] User {uid} not found when updating public streams")
            return
            
        # Try to get existing public stream or create new one
        public_stream = db.query(PublicStream).filter(PublicStream.uid == uid).first()
        if not public_stream:
            public_stream = PublicStream(uid=uid)
            db.add(public_stream)
            
        # Update the public stream info
        public_stream.username = user.username
        public_stream.display_name = user.display_name or user.username
        public_stream.storage_bytes = storage_bytes
        public_stream.last_updated = datetime.utcnow()
        
        # Don't commit here - let the caller handle the transaction
        db.flush()
        
    except Exception as e:
        # Just log the error and let the caller handle the rollback
        print(f"[ERROR] Error updating public streams: {e}")
        import traceback
        traceback.print_exc()
        raise  # Re-raise to let the caller handle the error
