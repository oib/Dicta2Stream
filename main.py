# main.py — FastAPI backend entrypoint for dicta2stream

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import os
import subprocess
from log import log_violation
from models import get_user_by_uid

from sqlmodel import Session, SQLModel, select
from database import get_db, engine
from models import User, UserQuota

from fastapi import Depends

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

app = FastAPI(debug=debug_mode)
from fastapi.staticfiles import StaticFiles
import os
if not os.path.exists("data"):
    os.makedirs("data")
app.mount("/audio", StaticFiles(directory="data"), name="audio")

if debug_mode:
    print("[DEBUG] FastAPI running in debug mode.")

# Global error handler to always return JSON
@app.exception_handler(FastAPIHTTPException)
async def http_exception_handler(request: FastAPIRequest, exc: FastAPIHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: FastAPIRequest, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

@app.exception_handler(Exception)
async def generic_exception_handler(request: FastAPIRequest, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc)})

# include routers from submodules
from register import router as register_router
from magic import router as magic_router
from upload import router as upload_router
from redirect import router as redirect_router
from list_user_files import router as list_user_files_router
from list_streams import router as list_streams_router

app.include_router(register_router)
app.include_router(magic_router)
app.include_router(upload_router)
app.include_router(redirect_router)
app.include_router(list_user_files_router)
app.include_router(list_streams_router)

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

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
    users = db.exec(select(User)).all()
    users_count = len(users)
    total_quota = db.exec(select(UserQuota)).all()
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

STREAM_DIR = "/srv/streams"
ICECAST_BASE_URL = "https://dicta2stream.net/stream/"
ICECAST_MOUNT_PREFIX = "user-"
MAX_QUOTA_BYTES = 100 * 1024 * 1024

@app.post("/delete-account")
async def delete_account(data: dict, request: Request, db: Session = Depends(get_db)):
    uid = data.get("uid")
    if not uid:
        raise HTTPException(status_code=400, detail="Missing UID")

    ip = request.client.host
    user = get_user_by_uid(uid)
    if not user or user.ip != ip:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Delete user quota and user using ORM
    quota = db.get(UserQuota, uid)
    if quota:
        db.delete(quota)
    user_obj = db.get(User, user.email)
    if user_obj:
        db.delete(user_obj)
    db.commit()

    import shutil
    user_dir = os.path.join(STREAM_DIR, user.username)
    # Only allow deletion within STREAM_DIR
    real_user_dir = os.path.realpath(user_dir)
    if not real_user_dir.startswith(os.path.realpath(STREAM_DIR)):
        raise HTTPException(status_code=400, detail="Invalid user directory")
    if os.path.exists(real_user_dir):
        shutil.rmtree(real_user_dir, ignore_errors=True)

    return {"message": "User deleted"}

@app.post("/upload")
async def upload_audio(
    request: Request,
    uid: str = Form(...),
    file: UploadFile = File(...)
):
    ip = request.client.host
    user = get_user_by_uid(uid)
    if not user:
        log_violation("UPLOAD", ip, uid, "UID not found")
        raise HTTPException(status_code=403, detail="Invalid user ID")

    if user.ip != ip:
        log_violation("UPLOAD", ip, uid, "UID/IP mismatch")
        raise HTTPException(status_code=403, detail="Device/IP mismatch")

    user_dir = os.path.join(STREAM_DIR, user.username)
    os.makedirs(user_dir, exist_ok=True)
    raw_path = os.path.join(user_dir, "upload.wav")
    final_path = os.path.join(user_dir, "stream.opus")

    with open(raw_path, "wb") as out:
        content = await file.read()
        out.write(content)

    usage = subprocess.check_output(["du", "-sb", user_dir]).split()[0]
    if int(usage) > MAX_QUOTA_BYTES:
        os.remove(raw_path)
        log_violation("UPLOAD", ip, uid, "Quota exceeded")
        raise HTTPException(status_code=403, detail="Quota exceeded")

    from fastapi.concurrency import run_in_threadpool
    # from detect_content_type_whisper_ollama import detect_content_type_whisper_ollama  # Broken import: module not found
    content_type = None
    if content_type in ["music", "singing"]:
        os.remove(raw_path)
        log_violation("UPLOAD", ip, uid, f"Rejected content: {content_type}")
        return JSONResponse(status_code=403, content={"error": f"{content_type.capitalize()} uploads are not allowed."})

    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", raw_path,
            "-ac", "1", "-ar", "48000",
            "-c:a", "libopus", "-b:a", "60k",
            final_path
        ], check=True)
    except subprocess.CalledProcessError as e:
        os.remove(raw_path)
        log_violation("FFMPEG", ip, uid, f"ffmpeg failed: {e}")
        raise HTTPException(status_code=500, detail="Encoding failed")
    os.remove(raw_path)

    try:
        actual_bytes = int(subprocess.check_output(["du", "-sb", user_dir]).split()[0])
        q = db.get(UserQuota, uid)
        if q:
            q.storage_bytes = actual_bytes
            db.add(q)
            db.commit()
    except Exception as e:
        log_violation("QUOTA", ip, uid, f"Quota update failed: {e}")

    stream_url = f"{ICECAST_BASE_URL}{ICECAST_MOUNT_PREFIX}{user.username}.opus"
    return {"stream_url": stream_url}

@app.delete("/uploads/{uid}/{filename}")
def delete_file(uid: str, filename: str, request: Request, db: Session = Depends(get_db)):
    user = get_user_by_uid(uid)
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user ID")

    ip = request.client.host
    if user.ip != ip:
        raise HTTPException(status_code=403, detail="Device/IP mismatch")

    user_dir = os.path.join(STREAM_DIR, user.username)
    target_path = os.path.join(user_dir, filename)
    # Prevent path traversal attacks
    real_target_path = os.path.realpath(target_path)
    real_user_dir = os.path.realpath(user_dir)
    if not real_target_path.startswith(real_user_dir + os.sep):
        raise HTTPException(status_code=403, detail="Invalid path")
    if not os.path.isfile(real_target_path):
        raise HTTPException(status_code=404, detail="File not found")

    os.remove(real_target_path)
    log_violation("DELETE", ip, uid, f"Deleted {filename}")
    subprocess.run(["/root/scripts/refresh_user_playlist.sh", user.username])

    try:
        actual_bytes = int(subprocess.check_output(["du", "-sb", user_dir]).split()[0])
        q = db.get(UserQuota, uid)
        if q:
            q.storage_bytes = actual_bytes
            db.add(q)
            db.commit()
    except Exception as e:
        log_violation("QUOTA", ip, uid, f"Quota update after delete failed: {e}")

    return {"status": "deleted"}

@app.get("/confirm/{uid}")
def confirm_user(uid: str, request: Request):
    ip = request.client.host
    user = get_user_by_uid(uid)
    if not user or user.ip != ip:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return {"username": user.username, "email": user.email}

@app.get("/me/{uid}")
def get_me(uid: str, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host
    user = get_user_by_uid(uid)
    if not user or user.ip != ip:
        raise HTTPException(status_code=403, detail="Unauthorized access")

    user_dir = os.path.join(STREAM_DIR, user.username)
    files = []
    if os.path.exists(user_dir):
        for f in os.listdir(user_dir):
            path = os.path.join(user_dir, f)
            if os.path.isfile(path):
                files.append({"name": f, "size": os.path.getsize(path)})

    q = db.get(UserQuota, uid)
    quota_mb = round(q.storage_bytes / (1024 * 1024), 2) if q else 0

    return {
        "stream_url": f"{ICECAST_BASE_URL}{ICECAST_MOUNT_PREFIX}{user.username}.opus",
        "files": files,
        "quota": quota_mb
    }
