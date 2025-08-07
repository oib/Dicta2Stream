# main.py — FastAPI backend entrypoint for dicta2stream

from fastapi import FastAPI, Request, Response, status, Form, UploadFile, File, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import os
import io
import traceback
import shutil
import mimetypes
from typing import Optional
from models import User, UploadLog, UserQuota, get_user_by_uid
from sqlmodel import Session, select, SQLModel
from database import get_db, engine
from log import log_violation
import secrets
import time
import json
import subprocess
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

# Ensure all tables exist at startup
SQLModel.metadata.create_all(engine)

ADMIN_SECRET = os.getenv("ADMIN_SECRET")

import os

debug_mode = os.getenv("DEBUG", "0") in ("1", "true", "True")
from fastapi.responses import JSONResponse
from fastapi.requests import Request as FastAPIRequest
from fastapi.exception_handlers import RequestValidationError
from fastapi.exceptions import HTTPException as FastAPIHTTPException

app = FastAPI(debug=debug_mode, docs_url=None, redoc_url=None, openapi_url=None)

# Override default HTML error handlers to return JSON
from fastapi.exceptions import RequestValidationError, HTTPException as FastAPIHTTPException
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# --- CORS Middleware for SSE and API access ---
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

# Add GZip middleware for compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://dicta2stream.net", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "Content-Length", "Cache-Control", "ETag", "Last-Modified"],
    max_age=3600,  # 1 hour
)

from fastapi.staticfiles import StaticFiles
import os
if not os.path.exists("data"):
    os.makedirs("data")
# Secure audio file serving endpoint (replaces static mount)
from fastapi.responses import FileResponse
from fastapi import Security

def get_current_user(request: Request, db: Session = Depends(get_db)):
    # Use your existing session/cookie/token mechanism here
    uid = request.headers.get("x-uid") or request.query_params.get("uid") or request.cookies.get("uid")
    if not uid:
        raise HTTPException(status_code=403, detail="Not authenticated")
    user = get_user_by_uid(uid)
    if not user or not user.confirmed:
        raise HTTPException(status_code=403, detail="Invalid user")
    return user

from range_response import range_response

@app.get("/audio/{uid}/{filename}")
def get_audio(uid: str, filename: str, request: Request):
    # Allow public access ONLY to stream.opus
    
    # Use the database session context manager
    with get_db() as db:
        try:
            # Use email-based UID directly for file system access
            # If UID contains @, it's an email - use it directly
            if '@' in uid:
                from models import User
                user = db.query(User).filter(User.email == uid).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                filesystem_uid = uid  # Use email directly for directory
            else:
                # Legacy support for username-based UIDs - convert to email
                from models import User
                user = db.query(User).filter(User.username == uid).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                filesystem_uid = user.email  # Convert username to email for directory
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    user_dir = os.path.join("data", filesystem_uid)
    file_path = os.path.join(user_dir, filename)
    real_user_dir = os.path.realpath(user_dir)
    real_file_path = os.path.realpath(file_path)
    if not real_file_path.startswith(real_user_dir):
        raise HTTPException(status_code=403, detail="Path traversal detected")
    if not os.path.isfile(real_file_path):
        raise HTTPException(status_code=404, detail="File not found")
    if filename == "stream.opus":
        # Use range_response for browser seeking support
        return range_response(request, real_file_path, content_type="audio/ogg")
    # Otherwise, require authentication and owner check
    try:
        from fastapi import Security
        current_user = get_current_user(request, db)
    except Exception:
        raise HTTPException(status_code=403, detail="Not allowed")
    if uid != current_user.username:
        raise HTTPException(status_code=403, detail="Not allowed")
    return FileResponse(real_file_path, media_type="audio/ogg")

if debug_mode:
    # Debug messages disabled
    pass

# Global error handler to always return JSON
from slowapi.errors import RateLimitExceeded
from models import get_user_by_uid, UserQuota

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Please try again later."})

@app.exception_handler(FastAPIHTTPException)
async def http_exception_handler(request: FastAPIRequest, exc: FastAPIHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: FastAPIRequest, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

@app.exception_handler(Exception)
async def generic_exception_handler(request: FastAPIRequest, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc)})

# Debug endpoint to list all routes
@app.get("/debug/routes")
async def list_routes():
    routes = []
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            routes.append({
                "path": route.path,
                "methods": list(route.methods) if hasattr(route, "methods") else [],
                "name": route.name if hasattr(route, "name") else "",
                "endpoint": str(route.endpoint) if hasattr(route, "endpoint") else "",
                "router": str(route)  # Add router info for debugging
            })
    
    # Sort routes by path for easier reading
    routes.sort(key=lambda x: x["path"])
    
    # Also print to console for server logs
    print("\n=== Registered Routes ===")
    for route in routes:
        print(f"{', '.join(route['methods']).ljust(20)} {route['path']}")
    print("======================\n")
    
    return {"routes": routes}

# include routers from submodules
from register import router as register_router
from magic import router as magic_router
from upload import router as upload_router
from streams import router as streams_router

from auth_router import router as auth_router

app.include_router(streams_router)

from list_streams import router as list_streams_router
from account_router import router as account_router

# Include all routers
app.include_router(auth_router, prefix="/api")
app.include_router(account_router)
app.include_router(register_router)
app.include_router(magic_router)
app.include_router(upload_router)

app.include_router(list_streams_router)

@app.get("/user-files/{uid}")
async def list_user_files(uid: str):
    from pathlib import Path
    
    # Get the user's directory and check for files first
    user_dir = Path("data") / uid
    if not user_dir.exists() or not user_dir.is_dir():
        return {"files": []}

    # Get all files that actually exist on disk
    existing_files = {f.name for f in user_dir.iterdir() if f.is_file()}
    
    # Use the database session context manager for all database operations
    with get_db() as db:
        # Verify the user exists
        user_check = db.query(User).filter((User.username == uid) | (User.email == uid)).first()
        if not user_check:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Query the UploadLog table for this user
        all_upload_logs = db.query(UploadLog).filter(
            UploadLog.uid == uid
        ).order_by(UploadLog.created_at.desc()).all()

        # Track processed files to avoid duplicates
        processed_files = set()
        files_metadata = []
        
        for log in all_upload_logs:
            # Skip if no processed filename
            if not log.processed_filename:
                continue
                
            # Skip if we've already processed this file
            if log.processed_filename in processed_files:
                continue
                
            # Skip stream.opus from uploads list (it's a special file)
            if log.processed_filename == 'stream.opus':
                continue
                
            # Skip if file doesn't exist on disk
            # Files are stored with the pattern: {upload_id}_{processed_filename}
            expected_filename = f"{log.id}_{log.processed_filename}"
            if expected_filename not in existing_files:
                # Only delete records older than 5 minutes to avoid race conditions
                from datetime import datetime, timedelta
                cutoff_time = datetime.utcnow() - timedelta(minutes=5)
                if log.created_at < cutoff_time:
                    print(f"[CLEANUP] Removing orphaned DB record (older than 5min): {expected_filename}")
                    db.delete(log)
                continue
                
            # Add to processed files to avoid duplicates
            processed_files.add(log.processed_filename)
            
            # Always use the original filename if present
            display_name = log.filename if log.filename else log.processed_filename
            
            # Only include files that exist on disk
            # Files are stored with the pattern: {upload_id}_{processed_filename}
            stored_filename = f"{log.id}_{log.processed_filename}"
            file_path = user_dir / stored_filename
            if file_path.exists() and file_path.is_file():
                try:
                    # Get the actual file size in case it changed
                    actual_size = file_path.stat().st_size
                    files_metadata.append({
                        "original_name": display_name,
                        "stored_name": log.processed_filename,
                        "size": actual_size
                    })
                except OSError:
                    # If we can't access the file, skip it
                    continue
        
        # Commit any database changes (deletions of non-existent files)
        try:
            db.commit()
        except Exception as e:
            print(f"[ERROR] Failed to commit database changes: {e}")
            db.rollback()

    return {"files": files_metadata}


# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve audio files
os.makedirs("data", exist_ok=True)  # Ensure the data directory exists
app.mount("/audio", StaticFiles(directory="data"), name="audio")

@app.post("/log-client")
async def log_client(request: Request):
    try:
        data = await request.json()
        msg = data.get("msg", "")
        ip = request.client.host
        timestamp = datetime.utcnow().isoformat()
        log_dir = os.path.join(os.path.dirname(__file__), "log")
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "debug.log")
        log_entry = f"[{timestamp}] IP={ip} MSG={msg}\n"
        with open(log_path, "a") as f:
            f.write(log_entry)
        if os.getenv("DEBUG", "0") in ("1", "true", "True"):
            print(f"[CLIENT-DEBUG] {log_entry.strip()}")
        return {"status": "ok"}
    except Exception as e:
        # Enhanced error logging
        import sys
        import traceback
        error_log_dir = os.path.join(os.path.dirname(__file__), "log")
        os.makedirs(error_log_dir, exist_ok=True)
        error_log_path = os.path.join(error_log_dir, "debug-errors.log")
        tb = traceback.format_exc()
        try:
            req_body = await request.body()
        except Exception:
            req_body = b"<failed to read body>"
        error_entry = (
            f"[{datetime.utcnow().isoformat()}] /log-client ERROR: {type(e).__name__}: {e}\n"
            f"Request IP: {getattr(request.client, 'host', None)}\n"
            f"Request body: {req_body}\n"
            f"Traceback:\n{tb}\n"
        )
        try:
            with open(error_log_path, "a") as ef:
                ef.write(error_entry)
        except Exception as ef_exc:
            print(f"[CLIENT-DEBUG-ERROR] Failed to write error log: {ef_exc}", file=sys.stderr)
        print(error_entry, file=sys.stderr)
        return {"status": "error", "detail": str(e)}

@app.get("/", response_class=HTMLResponse)
def serve_index():
    with open("static/index.html") as f:
        return f.read()

@app.get("/me", response_class=HTMLResponse)
def serve_me():
    with open("static/index.html") as f:
        return f.read()

@app.get("/admin/stats")
def admin_stats(request: Request, db: Session = Depends(get_db)):
    from sqlmodel import select
    users = db.query(User).all()
    users_count = len(users)
    total_quota = db.query(UserQuota).all()
    total_quota_sum = sum(q.storage_bytes for q in total_quota)
    violations_log = 0
    try:
        with open("log.txt") as f:
            violations_log = sum(1 for _ in f)
    except FileNotFoundError:
        pass

    secret = request.headers.get("x-admin-secret")
    if secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    return {
        "total_users": users_count,
        "total_quota_mb": round(total_quota_sum / (1024 * 1024), 2),
        "violation_log_entries": violations_log
    }

@app.get("/status")
def status():
    return {"status": "ok"}

@app.get("/debug")
def debug(request: Request):
    return {
        "ip": request.client.host,
        "headers": dict(request.headers),
    }

MAX_QUOTA_BYTES = 100 * 1024 * 1024

# Delete account endpoint - fallback implementation since account_router.py has loading issues
@app.post("/api/delete-account")
async def delete_account_fallback(request: Request, db: Session = Depends(get_db)):
    try:
        # Get request data
        data = await request.json()
        uid = data.get("uid")
        if not uid:
            raise HTTPException(status_code=400, detail="Missing UID")

        ip = request.client.host
        # Debug messages disabled

        # Find user by email or username
        user = None
        if '@' in uid:
            user = db.exec(select(User).where(User.email == uid)).first()
        if not user:
            user = db.exec(select(User).where(User.username == uid)).first()
            
        # If still not found, check if this UID exists in upload logs and try to find the associated user
        if not user:
            # Look for upload logs with this UID to find the real user
            upload_log = db.exec(select(UploadLog).where(UploadLog.uid == uid)).first()
            if upload_log:
                # Try to find a user that might be associated with this UID
                # Check if there's a user with the same IP or similar identifier
                all_users = db.exec(select(User)).all()
                for potential_user in all_users:
                    # Use the first confirmed user as fallback (for orphaned UIDs)
                    if potential_user.confirmed:
                        user = potential_user
                        # Debug messages disabled
                        break
            
        if not user:
            # Debug messages disabled
            raise HTTPException(status_code=404, detail="User not found")
            
        if user.ip != ip:
            raise HTTPException(status_code=403, detail="Unauthorized: IP address does not match")

        # Delete user data from database using the original UID
        # The original UID is what's stored in the database records
        
        # Delete upload logs for all possible UIDs (original UID, email, username)
        upload_logs_to_delete = []
        
        # Check for upload logs with original UID
        upload_logs_original = db.query(UploadLog).filter(UploadLog.uid == uid).all()
        if upload_logs_original:
            # Debug messages disabled
            upload_logs_to_delete.extend(upload_logs_original)
            
        # Check for upload logs with user email
        upload_logs_email = db.query(UploadLog).filter(UploadLog.uid == user.email).all()
        if upload_logs_email:
            # Debug messages disabled
            upload_logs_to_delete.extend(upload_logs_email)
            
        # Check for upload logs with username
        upload_logs_username = db.query(UploadLog).filter(UploadLog.uid == user.username).all()
        if upload_logs_username:
            # Debug messages disabled
            upload_logs_to_delete.extend(upload_logs_username)
            
        # Delete all found upload log records
        for log in upload_logs_to_delete:
            try:
                db.delete(log)
            except Exception as e:
                # Debug messages disabled
                pass
                
        # Debug messages disabled
            
        # Delete user quota for both the original UID and user email (to cover all cases)
        quota_original = db.get(UserQuota, uid)
        if quota_original:
            # Debug messages disabled
            db.delete(quota_original)
            
        quota_email = db.get(UserQuota, user.email)
        if quota_email:
            # Debug messages disabled
            db.delete(quota_email)
            
        # Delete user sessions
        sessions = db.query(DBSession).filter(DBSession.user_id == user.username).all()
        # Debug messages disabled
        for session in sessions:
            db.delete(session)
            
        # Delete public stream entries for all possible UIDs
        # Use select() instead of get() to find all matching records
        public_streams_to_delete = []
        
        # Check for public stream with original UID
        public_stream_original = db.query(PublicStream).filter(PublicStream.uid == uid).first()
        if public_stream_original:
            # Debug messages disabled
            public_streams_to_delete.append(public_stream_original)
            
        # Check for public stream with user email
        public_stream_email = db.query(PublicStream).filter(PublicStream.uid == user.email).first()
        if public_stream_email:
            # Debug messages disabled
            public_streams_to_delete.append(public_stream_email)
            
        # Check for public stream with username
        public_stream_username = db.query(PublicStream).filter(PublicStream.uid == user.username).first()
        if public_stream_username:
            # Debug messages disabled
            public_streams_to_delete.append(public_stream_username)
            
        # Delete all found public stream records
        for ps in public_streams_to_delete:
            try:
                # Debug messages disabled
                db.delete(ps)
            except Exception as e:
                # Debug messages disabled
                pass
                
        # Debug messages disabled
        
        # Delete user directory BEFORE deleting user record - check all possible locations
        import shutil
        
        # Try to delete directory with UID (email) - current standard
        uid_dir = os.path.join('data', uid)
        if os.path.exists(uid_dir):
            # Debug messages disabled
            shutil.rmtree(uid_dir, ignore_errors=True)
        
        # Also try to delete directory with email (in case of different UID formats)
        email_dir = os.path.join('data', user.email)
        if os.path.exists(email_dir) and email_dir != uid_dir:
            # Debug messages disabled
            shutil.rmtree(email_dir, ignore_errors=True)
            
        # Also try to delete directory with username (legacy format)
        username_dir = os.path.join('data', user.username)
        if os.path.exists(username_dir) and username_dir != uid_dir and username_dir != email_dir:
            # Debug messages disabled
            shutil.rmtree(username_dir, ignore_errors=True)
            
        # Delete user account AFTER directory cleanup
        db.delete(user)
        db.commit()
            
        # Debug messages disabled
        return {"status": "success", "message": "Account deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        # Debug messages disabled
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

# Cleanup endpoint for orphaned public streams
@app.post("/api/cleanup-streams")
async def cleanup_orphaned_streams(request: Request, db: Session = Depends(get_db)):
    try:
        # Get request data
        data = await request.json()
        admin_secret = data.get("admin_secret")
        
        # Verify admin access
        if admin_secret != ADMIN_SECRET:
            raise HTTPException(status_code=403, detail="Unauthorized")
            
        # Find orphaned public streams (streams without corresponding user accounts)
        all_streams = db.query(PublicStream).all()
        all_users = db.query(User).all()
        
        # Create sets of valid UIDs from user accounts
        valid_uids = set()
        for user in all_users:
            valid_uids.add(user.email)
            valid_uids.add(user.username)
            
        orphaned_streams = []
        for stream in all_streams:
            if stream.uid not in valid_uids:
                orphaned_streams.append(stream)
                
        # Delete orphaned streams
        deleted_count = 0
        for stream in orphaned_streams:
            try:
                print(f"[CLEANUP] Deleting orphaned stream: {stream.uid} (username: {stream.username})")
                db.delete(stream)
                deleted_count += 1
            except Exception as e:
                print(f"[CLEANUP] Error deleting stream {stream.uid}: {e}")
                
        db.commit()
        print(f"[CLEANUP] Deleted {deleted_count} orphaned public streams")
        
        return {
            "status": "success", 
            "message": f"Deleted {deleted_count} orphaned public streams",
            "deleted_streams": [s.uid for s in orphaned_streams]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[CLEANUP] Error: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

# Original delete account endpoint has been moved to account_router.py

@app.delete("/uploads/{uid}/{filename}")
async def delete_file(uid: str, filename: str, request: Request):
    """
    Delete a file for a specific user.
    
    Args:
        uid: The username of the user (used as UID in routes)
        filename: The name of the file to delete
        request: The incoming request object
        db: Database session
        
    Returns:
        Dict with status message
    """
    try:
        # Get the user by username (which is used as UID in routes)
        user = get_user_by_uid(uid)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get client IP and verify it matches the user's IP
        ip = request.client.host
        if user.ip != ip:
            raise HTTPException(status_code=403, detail="Device/IP mismatch. Please log in again.")

        # Set up user directory using email (matching upload logic)
        user_dir = os.path.join('data', user.email)
        os.makedirs(user_dir, exist_ok=True)
        
        # Decode URL-encoded filename
        from urllib.parse import unquote
        filename = unquote(filename)
        
        # Debug: Print the user info and filename being used
        # Debug messages disabled
        # Debug messages disabled
        # Debug messages disabled
        # Debug messages disabled
        if os.path.exists(user_dir):
            # Debug messages disabled
            pass
        
        # Construct and validate target path
        target_path = os.path.join(user_dir, filename)
        real_target_path = os.path.realpath(target_path)
        real_user_dir = os.path.realpath(user_dir)
        
        # Debug: Print the constructed paths
        # Debug messages disabled
        # Debug messages disabled
        # Debug messages disabled
        
        # Security check: Ensure the target path is inside the user's directory
        if not real_target_path.startswith(real_user_dir + os.sep):
            # Debug messages disabled
            raise HTTPException(status_code=403, detail="Invalid file path")
            
        # Check if file exists
        if not os.path.isfile(real_target_path):
            # Debug: List files in the directory to help diagnose the issue
            try:
                # Debug messages disabled
                # Debug messages disabled
                # Debug messages disabled
                
                if os.path.exists(real_user_dir):
                    files_in_dir = os.listdir(real_user_dir)
                    # Debug messages disabled
                    
                    # Print detailed file info
                    for f in files_in_dir:
                        full_path = os.path.join(real_user_dir, f)
                        try:
                            # Debug messages disabled
                            pass
                        except Exception as e:
                            # Debug messages disabled
                            pass
                    
                    # Debug messages disabled
                    # Debug messages disabled
                    # Debug messages disabled
                    
                    # Try to find a matching file (case-insensitive, partial match)
                    matching_files = [f for f in files_in_dir if filename.lower() in f.lower()]
                    if matching_files:
                        # Debug messages disabled
                        # Use the first matching file
                        real_target_path = os.path.join(real_user_dir, matching_files[0])
                        # Debug messages disabled
                        # Debug messages disabled
                    else:
                        # Debug messages disabled
                        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
                else:
                    # Debug messages disabled
                    raise HTTPException(status_code=404, detail=f"User directory not found")
                    
            except HTTPException:
                raise
            except Exception as e:
                # Debug messages disabled
                raise HTTPException(status_code=404, detail=f"File not found: {filename}")

        # Delete both the target file and its UUID-only variant
        deleted_files = []
        try:
            # First delete the requested file (with log ID prefix)
            if os.path.exists(real_target_path):
                os.remove(real_target_path)
                deleted_files.append(filename)
                log_violation("DELETE", ip, uid, f"Deleted {filename}")
            
            # Then try to find and delete the UUID-only variant (without log ID prefix)
            if '_' in filename:  # If filename has a log ID prefix (e.g., "123_uuid.opus")
                uuid_part = filename.split('_', 1)[1]  # Get the part after the first underscore
                uuid_path = os.path.join(user_dir, uuid_part)
                if os.path.exists(uuid_path):
                    os.remove(uuid_path)
                    deleted_files.append(uuid_part)
                    log_violation("DELETE", ip, uid, f"Deleted UUID variant: {uuid_part}")
            
            file_deleted = len(deleted_files) > 0
            
            if not file_deleted:
                log_violation("DELETE_WARNING", ip, uid, f"No files found to delete for: {filename}")
                
        except Exception as e:
            log_violation("DELETE_ERROR", ip, uid, f"Error deleting file {filename}: {str(e)}")
            file_deleted = False
        
        # Try to refresh the user's playlist, but don't fail if we can't
        try:
            subprocess.run(["/root/scripts/refresh_user_playlist.sh", user.username], 
                         check=False, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        except Exception as e:
            log_violation("PLAYLIST_REFRESH_WARNING", ip, uid, 
                         f"Failed to refresh playlist: {str(e)}")

        # Clean up the database record for this file
        try:
            with get_db() as db:
                try:
                    # Find and delete the upload log entry
                    log_entry = db.query(UploadLog).filter(
                        UploadLog.uid == uid,
                        UploadLog.processed_filename == filename
                    ).first()
                    
                    if log_entry:
                        db.delete(log_entry)
                        db.commit()
                        log_violation("DB_CLEANUP", ip, uid, f"Removed DB record for {filename}")
                except Exception as e:
                    db.rollback()
                    raise e
        except Exception as e:
            log_violation("DB_CLEANUP_ERROR", ip, uid, f"Failed to clean up DB record: {str(e)}")
            
        # Regenerate stream.opus after file deletion
        try:
            from concat_opus import concat_opus_files
            from pathlib import Path
            user_dir_path = Path(user_dir)
            stream_path = user_dir_path / "stream.opus"
            concat_opus_files(user_dir_path, stream_path)
            log_violation("STREAM_UPDATE", ip, uid, "Regenerated stream.opus after file deletion")
        except Exception as e:
            log_violation("STREAM_UPDATE_ERROR", ip, uid, f"Failed to regenerate stream.opus: {str(e)}")
        
        # Update user quota in a separate try-except to not fail the entire operation
        try:
            with get_db() as db:
                try:
                    # Use verify_and_fix_quota to ensure consistency between disk and DB
                    total_size = verify_and_fix_quota(db, user.username, user_dir)
                    log_violation("QUOTA_UPDATE", ip, uid, 
                                 f"Updated quota: {total_size} bytes")
                except Exception as e:
                    db.rollback()
                    raise e
        except Exception as e:
            log_violation("QUOTA_ERROR", ip, uid, f"Quota update failed: {str(e)}")
        
        return {"status": "deleted"}
        
    except Exception as e:
        # Log the error and re-raise with a user-friendly message
        error_detail = str(e)
        log_violation("DELETE_ERROR", request.client.host, uid, f"Failed to delete {filename}: {error_detail}")
        if not isinstance(e, HTTPException):
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {error_detail}")
        raise

@app.get("/confirm/{uid}")
def confirm_user(uid: str, request: Request):
    ip = request.client.host
    user = get_user_by_uid(uid)
    if not user or user.ip != ip:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return {"username": user.username, "email": user.email}

def verify_and_fix_quota(db: Session, uid: str, user_dir: str) -> int:
    """
    Verify and fix the user's quota based on the size of stream.opus file.
    Returns the size of stream.opus in bytes.
    """
    stream_opus_path = os.path.join(user_dir, 'stream.opus')
    total_size = 0
    
    # Only consider stream.opus for quota
    if os.path.isfile(stream_opus_path):
        try:
            total_size = os.path.getsize(stream_opus_path)
            # Debug messages disabled
        except (OSError, FileNotFoundError) as e:
            # Debug messages disabled
            pass
    else:
        # Debug messages disabled
        pass
    
    # Update quota in database
    q = db.get(UserQuota, uid) or UserQuota(uid=uid, storage_bytes=0)
    q.storage_bytes = total_size
    db.add(q)
    
    # Clean up any database records for files that don't exist
    # BUT only for records older than 5 minutes to avoid race conditions with recent uploads
    from datetime import datetime, timedelta
    cutoff_time = datetime.utcnow() - timedelta(minutes=5)
    
    uploads = db.query(UploadLog).filter(
        UploadLog.uid == uid,
        UploadLog.created_at < cutoff_time  # Only check older records
    ).all()
    
    for upload in uploads:
        if upload.processed_filename:  # Only check if processed_filename exists
            stored_filename = f"{upload.id}_{upload.processed_filename}"
            file_path = os.path.join(user_dir, stored_filename)
            if not os.path.isfile(file_path):
                # Debug messages disabled
                db.delete(upload)
    
    try:
        db.commit()
        # Debug messages disabled
    except Exception as e:
        # Debug messages disabled
        db.rollback()
        raise
    
    return total_size

@app.get("/me/{uid}")
def get_me(uid: str, request: Request, response: Response):
    # Add headers to prevent caching
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    # Debug messages disabled
    
    # Use the database session context manager for all database operations
    with get_db() as db:
        try:
            # Get user info
            user = db.query(User).filter((User.username == uid) | (User.email == uid)).first()
            if not user:
                print(f"[ERROR] User with UID {uid} not found")
                raise HTTPException(status_code=404, detail="User not found")
            
            # Only enforce IP check in production
            if not debug_mode:
                if user.ip != request.client.host:
                    print(f"[WARNING] IP mismatch for UID {uid}: {request.client.host} != {user.ip}")
                    # In production, we might want to be more strict
                    if not debug_mode:
                        raise HTTPException(status_code=403, detail="IP address mismatch")

            # Get user directory
            user_dir = os.path.join('data', uid)
            os.makedirs(user_dir, exist_ok=True)
            
            # Get all upload logs for this user using the query interface
            upload_logs = db.query(UploadLog).filter(
                UploadLog.uid == uid
            ).order_by(UploadLog.created_at.desc()).all()
            
            # Debug messages disabled
            
            # Build file list from database records, checking if files exist on disk
            files = []
            seen_files = set()  # Track seen files to avoid duplicates
            
            # Debug messages disabled
            
            for i, log in enumerate(upload_logs):
                if not log.filename or not log.processed_filename:
                    # Debug messages disabled
                    continue
                    
                # The actual filename on disk has the log ID prepended
                stored_filename = f"{log.id}_{log.processed_filename}"
                file_path = os.path.join(user_dir, stored_filename)
                
                # Skip if we've already seen this file
                if stored_filename in seen_files:
                    # Debug messages disabled
                    continue
                    
                seen_files.add(stored_filename)
                
                # Only include the file if it exists on disk and is not stream.opus
                if os.path.isfile(file_path) and stored_filename != 'stream.opus':
                    try:
                        # Get the actual file size in case it changed
                        file_size = os.path.getsize(file_path)
                        file_info = {
                            "name": stored_filename,
                            "original_name": log.filename,
                            "size": file_size
                        }
                        files.append(file_info)
                        # Debug messages disabled
                    except OSError as e:
                        print(f"[WARNING] Could not access file {stored_filename}: {e}")
                else:
                    # Debug messages disabled
                    pass
            
            # Log all files being returned
            # Debug messages disabled
            # for i, file_info in enumerate(files, 1):
            #     print(f"  {i}. {file_info['name']} (original: {file_info['original_name']}, size: {file_info['size']} bytes)")
            
            # Verify and fix quota based on actual files on disk
            total_size = verify_and_fix_quota(db, uid, user_dir)
            quota_mb = round(total_size / (1024 * 1024), 2)
            max_quota_mb = round(MAX_QUOTA_BYTES / (1024 * 1024), 2)
            # Debug messages disabled

            response_data = {
                "files": files,
                "quota": {
                    "used": quota_mb,
                    "max": max_quota_mb,
                    "used_bytes": total_size,
                    "max_bytes": MAX_QUOTA_BYTES,
                    "percentage": round((total_size / MAX_QUOTA_BYTES) * 100, 2) if MAX_QUOTA_BYTES > 0 else 0
                }
            }
            # Debug messages disabled
            return response_data
            
        except HTTPException:
            # Re-raise HTTP exceptions as they are
            raise
        except Exception as e:
            # Log the full traceback for debugging
            import traceback
            error_trace = traceback.format_exc()
            print(f"[ERROR] Error in /me/{uid} endpoint: {str(e)}\n{error_trace}")
            # Rollback any database changes in case of error
            db.rollback()
            # Return a 500 error with a generic message
            raise HTTPException(status_code=500, detail="Internal server error")
