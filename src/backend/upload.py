# upload.py — FastAPI route for upload + quota check + voice conversion

from fastapi import APIRouter, UploadFile, Form, HTTPException, Request, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pathlib import Path
import json
import requests
from datetime import datetime, timezone
from .convert_to_opus import convert_to_opus
from .models import UploadLog, UserQuota, User, PublicStream
from sqlalchemy import select, or_
from .database import get_db

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()
#   # Not needed for SlowAPI ≥0.1.5
DATA_ROOT = Path("./data")

# Helper function to get real client IP from behind reverse proxy
def get_client_ip(request: Request) -> str:
    """Get the real client IP, checking for headers set by reverse proxy"""
    # Check X-Forwarded-For header first
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs, the first is the client
        return forwarded_for.split(",")[0].strip()
    
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fallback to request.client.host
    return request.client.host or "unknown"



@limiter.limit("5/minute")
@router.post("/upload")
def upload(request: Request, uid: str = Form(...), file: UploadFile = Form(...)):
    # Import here to avoid circular imports
    from .log import log_violation
    import time
    
    # Generate a unique request ID for this upload
    request_id = str(int(time.time()))
    print(f"[DEBUG] Upload started - uid: {uid}, file: {file.filename}")
    log_violation("UPLOAD", get_client_ip(request), uid, f"[{request_id}] Starting upload of {file.filename}")
    
    try:
        # Use the database session context manager to handle the session
        with get_db() as db:
            try:
                # First, verify the user exists and is confirmed
                user = db.exec(select(User).where(
                    (User.username == uid) | (User.email == uid)
                )).first()
                
                if user is not None and not isinstance(user, User) and hasattr(user, "__getitem__"):
                    user = user[0]
                if not user:
                    log_violation("UPLOAD", get_client_ip(request), uid, f"User {uid} not found")
                    raise HTTPException(status_code=404, detail="User not found")
                
                log_violation("UPLOAD", get_client_ip(request), uid, f"[{request_id}] User check - found: {user is not None}, confirmed: {getattr(user, 'confirmed', False) if user else 'N/A'}")
                
                # Check if user is confirmed
                if not hasattr(user, 'confirmed') or not user.confirmed:
                    raise HTTPException(status_code=403, detail="Account not confirmed")
                    
                # Use user.email as the proper UID for quota and directory operations
                user_email = user.email
                quota = db.get(UserQuota, user_email) or UserQuota(uid=user_email, storage_bytes=0)
                
                if quota.storage_bytes >= 100 * 1024 * 1024:
                    raise HTTPException(status_code=400, detail="Quota exceeded")

                # Create user directory using email (proper UID) - not the uid parameter which could be username
                user_dir = DATA_ROOT / user_email
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
                            log_violation("UPLOAD", get_client_ip(request), uid, f"[{request_id}] Cleaned up old file: {old_file}")
                    except Exception as e:
                        log_violation("UPLOAD_ERROR", get_client_ip(request), uid, f"[{request_id}] Failed to clean up {old_file}: {e}")
                
                # Save the uploaded file temporarily
                log_violation("UPLOAD", get_client_ip(request), uid, f"[{request_id}] Saving temporary file to {raw_path}")
                
                try:
                    with open(raw_path, "wb") as f:
                        content = file.file.read()
                        if not content:
                            raise ValueError("Uploaded file is empty")
                        f.write(content)
                        log_violation("UPLOAD", get_client_ip(request), uid, f"[{request_id}] Successfully wrote {len(content)} bytes to {raw_path}")
                    
                    # EARLY DB RECORD CREATION: after upload completes, before processing
                    early_log = UploadLog(
                        uid=user_email,
                        ip=get_client_ip(request),
                        filename=file.filename,  # original filename from user
                        processed_filename=None, # not yet processed
                        size_bytes=0            # placeholder to satisfy NOT NULL; updated after processing
                    )
                    db.add(early_log)
                    log_violation("UPLOAD_DEBUG", get_client_ip(request), uid, f"[FORCE FLUSH] Before db.flush() after early_log add")
                    db.flush()
                    log_violation("UPLOAD_DEBUG", get_client_ip(request), uid, f"[FORCE FLUSH] After db.flush() after early_log add")
                    db.commit()
                    log_violation("UPLOAD_DEBUG", get_client_ip(request), uid, f"[FORCE COMMIT] After db.commit() after early_log add")
                    early_log_id = early_log.id
                    log_violation("UPLOAD_DEBUG", get_client_ip(request), uid, f"[DEBUG] Early UploadLog created: id={early_log_id}, filename={file.filename}, UploadLog.filename={early_log.filename}")
                except Exception as e:
                    log_violation("UPLOAD_ERROR", get_client_ip(request), uid, f"[{request_id}] Failed to save {raw_path}: {e}")
                    raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {e}")

                # Ollama music/singing check is disabled for this release
                log_violation("UPLOAD", get_client_ip(request), uid, f"[{request_id}] Ollama music/singing check is disabled")

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
                
                # Get the final file size
                size = processed_path.stat().st_size
                
                # Concatenate all .opus files in random order to stream.opus for public playback
                # This is now done after the file is in its final location with log ID
                from .concat_opus import concat_opus_files
                
                def update_stream_opus():
                    try:
                        concat_opus_files(user_dir, user_dir / "stream.opus")
                    except Exception as e:
                        # fallback: just use the latest processed file if concat fails
                        import shutil
                        stream_path = user_dir / "stream.opus"
                        shutil.copy2(processed_path, stream_path)
                        log_violation("STREAM_UPDATE", get_client_ip(request), uid, 
                                   f"[fallback] Updated stream.opus with {processed_path}")
                
                # Start a transaction
                try:
                    # Update the early DB record with processed filename and size
                    log = db.get(UploadLog, early_log_id)
                    log.processed_filename = unique_name
                    log.size_bytes = size
                    db.add(log)
                    db.flush()  # Ensure update is committed
                    
                    # Assert that log.filename is still the original filename, never overwritten
                    if log.filename is None or (log.filename.endswith('.opus') and log.filename == log.processed_filename):
                        log_violation("UPLOAD_ERROR", get_client_ip(request), uid, 
                                   f"[ASSERTION FAILED] UploadLog.filename was overwritten! id={log.id}, filename={log.filename}, processed_filename={log.processed_filename}")
                        raise RuntimeError(f"UploadLog.filename was overwritten! id={log.id}, filename={log.filename}, processed_filename={log.processed_filename}")
                    else:
                        log_violation("UPLOAD_DEBUG", get_client_ip(request), uid, 
                                   f"[ASSERTION OK] After update: id={log.id}, filename={log.filename}, processed_filename={log.processed_filename}")
                    
                    log_violation("UPLOAD_DEBUG", get_client_ip(request), uid, f"[COMMIT] Committing UploadLog for id={log.id}")
                    db.commit()
                    log_violation("UPLOAD_DEBUG", get_client_ip(request), uid, f"[COMMIT OK] UploadLog committed for id={log.id}")
                    
                    # Rename the processed file to include the log ID for better tracking
                    processed_with_id = user_dir / f"{log.id}_{unique_name}"
                    
                    if processed_path.exists():
                        # First check if there's already a file with the same UUID but different prefix
                        for existing_file in user_dir.glob(f"*_{unique_name}"):
                            if existing_file != processed_path:
                                log_violation("CLEANUP", get_client_ip(request), uid, 
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
                            log_violation("CLEANUP", get_client_ip(request), uid, f"[{request_id}] Cleaned up temp file: {old_temp_file}")
                        except Exception as e:
                            log_violation("CLEANUP_ERROR", get_client_ip(request), uid, f"[{request_id}] Failed to clean up {old_temp_file}: {e}")
                    
                    # Get or create quota
                    quota = db.exec(select(UserQuota).where(UserQuota.uid == user_email)).first()
                    if quota is not None and not isinstance(quota, UserQuota) and hasattr(quota, "__getitem__"):
                        quota = quota[0]
                    if not quota:
                        print(f"[DEBUG] Creating new quota for {user_email}")
                        quota = UserQuota(uid=user_email, storage_bytes=0)
                        db.add(quota)
                        print(f"[DEBUG] New quota added to session")
                    else:
                        print(f"[DEBUG] Found existing quota for {user_email}, current storage: {quota.storage_bytes}")
                    
                    # Update quota with the new file size
                    print(f"[DEBUG] About to update quota.storage_bytes")
                    print(f"[DEBUG] quota type: {type(quota)}")
                    print(f"[DEBUG] quota in session: {quota in db}")
                    new_storage = sum(
                        f.stat().st_size 
                        for f in user_dir.glob('*.opus') 
                        if f.name != 'stream.opus' and f != processed_path
                    ) + size
                    print(f"[DEBUG] Calculated new storage: {new_storage}")
                    quota.storage_bytes = new_storage
                    print(f"[DEBUG] Quota updated successfully")
                    
                    # Update public streams
                    print(f"[DEBUG] About to update public streams")
                    update_public_streams(user_email, quota.storage_bytes, db)
                    print(f"[DEBUG] Public streams updated successfully")
                    
                    # The context manager will handle commit/rollback
                    # Now that the transaction is committed and files are in their final location,
                    # update the stream.opus file to include all files
                    update_stream_opus()
                    
                    return {
                        "filename": file.filename,
                        "original_size": round(original_size / 1024, 1),
                        "quota": {
                            "used_mb": round(quota.storage_bytes / (1024 * 1024), 2)
                        }
                    }
                    
                except HTTPException as e:
                    # Re-raise HTTP exceptions as they are already properly formatted
                    db.rollback()
                    raise e
                    
                except Exception as e:
                    # Log the error and return a 500 response
                    db.rollback()
                    import traceback
                    tb = traceback.format_exc()
                    # Try to log the error
                    try:
                        log_violation("UPLOAD_ERROR", get_client_ip(request), uid, f"Error processing upload: {str(e)}\n{tb}")
                    except Exception:
                        pass  # If logging fails, continue with the error response
                        
                    # Clean up the processed file if it exists
                    if 'processed_path' in locals() and processed_path.exists():
                        processed_path.unlink(missing_ok=True)
                        
                    raise HTTPException(status_code=500, detail=f"Error processing upload: {str(e)}")
                    
            except HTTPException as e:
                # Re-raise HTTP exceptions as they are already properly formatted
                db.rollback()
                raise e
                
            except Exception as e:
                # Log the error and return a 500 response
                db.rollback()
                import traceback
                tb = traceback.format_exc()
                # Try to log the error
                try:
                    log_violation("UPLOAD_ERROR", get_client_ip(request), uid, f"Error processing upload: {str(e)}\n{tb}")
                except Exception:
                    pass  # If logging fails, continue with the error response
                    
                # Clean up the processed file if it exists
                if 'processed_path' in locals() and processed_path.exists():
                    processed_path.unlink(missing_ok=True)
                    
                raise HTTPException(status_code=500, detail=f"Error processing upload: {str(e)}")
        
    except HTTPException as e:
        # Re-raise HTTP exceptions as they are already properly formatted
        raise e
        
    except Exception as e:
        # Catch any other exceptions that might occur outside the main processing block
        import traceback
        tb = traceback.format_exc()
        try:
            log_violation("UPLOAD_ERROR", get_client_ip(request), uid, f"Unhandled error in upload handler: {str(e)}\n{tb}")
        except:
            pass  # If logging fails, continue with the error response
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


def update_public_streams(uid: str, storage_bytes: int, db):
    """Update the public streams list in the database with the latest user upload info"""
    # Import log_violation to avoid circular imports
    from .log import log_violation
    
    try:
        # Get the user's info - uid is now email-based
        user = db.exec(select(User).where(User.email == uid)).first()
        if user is not None and not isinstance(user, User) and hasattr(user, "__getitem__"):
            user = user[0]
        if not user:
            print(f"[WARNING] User {uid} not found when updating public streams")
            return
            
        # Check if user has only silent.opus (4322 bytes) or less - if so, remove from public streams
        if storage_bytes <= 4322:
            # Remove from public streams if storage is only silent.opus or less
            public_stream = db.exec(select(PublicStream).where(PublicStream.uid == uid)).first()
            if public_stream is not None and not isinstance(public_stream, PublicStream) and hasattr(public_stream, "__getitem__"):
                public_stream = public_stream[0]
            if public_stream:
                db.delete(public_stream)
                log_violation("PUBLIC_STREAM_REMOVED", "system", uid, f"Removed {uid} from public streams - no actual uploads")
            return
            
        # Try to get existing public stream or create new one
        public_stream = db.exec(select(PublicStream).where(PublicStream.uid == uid)).first()
        if public_stream is not None and not isinstance(public_stream, PublicStream) and hasattr(public_stream, "__getitem__"):
            public_stream = public_stream[0]
        if not public_stream:
            public_stream = PublicStream(uid=uid)
            db.add(public_stream)
            
        # Update the public stream info
        try:
            print(f"DEBUG: Setting username to {user.username}")
            public_stream.username = user.username
            print(f"DEBUG: Setting storage_bytes to {storage_bytes}")
            public_stream.storage_bytes = storage_bytes
            print(f"DEBUG: Setting last_updated to {datetime.now(timezone.utc)}")
            public_stream.last_updated = datetime.now(timezone.utc)
            print("DEBUG: All attributes set successfully")
        except Exception as e:
            print(f"ERROR setting attributes: {e}")
            print(f"public_stream type: {type(public_stream)}")
            print(f"public_stream.__dict__: {public_stream.__dict__}")
            raise
        
        # Don't commit here - let the caller handle the transaction
        db.flush()
        
    except Exception as e:
        # Just log the error and let the caller handle the rollback
        log_violation("PUBLIC_STREAMS_ERROR", "unknown", uid, f"Error updating public streams: {str(e)}")
        import traceback
        traceback.print_exc()
        raise  # Re-raise to let the caller handle the error
