# upload.py — FastAPI route for upload + quota check + voice conversion

from fastapi import APIRouter, UploadFile, Form, HTTPException, Request, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pathlib import Path
from convert_to_opus import convert_to_opus
from database import get_db
from models import UploadLog, UserQuota, User
from sqlalchemy import select

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()
#   # Not needed for SlowAPI ≥0.1.5
DATA_ROOT = Path("./data")

@limiter.limit("5/minute")
@router.post("/upload")
async def upload(request: Request, db = Depends(get_db), uid: str = Form(...), file: UploadFile = Form(...)):
    from log import log_violation
    try:
        user_dir = DATA_ROOT / uid
        user_dir.mkdir(parents=True, exist_ok=True)

        raw_path = user_dir / ("raw." + file.filename.split(".")[-1])
        import uuid

        unique_name = str(uuid.uuid4()) + ".opus"

        # Save temp upload FIRST
        with open(raw_path, "wb") as f:
            f.write(await file.read())

        # Block music/singing via Ollama prompt
        import requests
        try:
            with open(raw_path, "rb") as f:
                audio = f.read()
            res = requests.post("http://localhost:11434/api/generate", json={
                "model": "whisper",
                "prompt": "Does this audio contain music or singing? Answer yes or no only.",
                "audio": audio
            }, timeout=10)
            resp = res.json().get("response", "").lower()
            if "yes" in resp:
                raw_path.unlink(missing_ok=True)
                raise HTTPException(status_code=403, detail="Upload rejected: music or singing detected")
        except Exception as ollama_err:
            # fallback: allow, log if needed
            pass
        processed_path = user_dir / unique_name

        # Block unconfirmed users (use ORM)
        user = db.exec(select(User).where((User.username == uid) | (User.email == uid))).first()
        # If result is a Row or tuple, extract the User object
        if user is not None and not isinstance(user, User) and hasattr(user, "__getitem__"):
            user = user[0]
        from log import log_violation
        log_violation("UPLOAD", request.client.host, uid, f"DEBUG: Incoming uid={uid}, user found={user}, confirmed={getattr(user, 'confirmed', None)}")
        log_violation("UPLOAD", request.client.host, uid, f"DEBUG: After unpack, user={user}, type={type(user)}, confirmed={getattr(user, 'confirmed', None)}")
        if not user or not hasattr(user, "confirmed") or not user.confirmed:
            raw_path.unlink(missing_ok=True)
            raise HTTPException(status_code=403, detail="Account not confirmed")

        # DB-based quota check
        quota = db.get(UserQuota, uid)
        if quota and quota.storage_bytes >= 100 * 1024 * 1024:
            raw_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Quota exceeded")

        try:
            convert_to_opus(str(raw_path), str(processed_path))
        except Exception as e:
            raw_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=str(e))

        original_size = raw_path.stat().st_size
        raw_path.unlink(missing_ok=True)  # cleanup

        # Always copy latest upload as stream.opus for redirect compatibility
        import shutil
        stream_path = user_dir / "stream.opus"
        shutil.copy2(processed_path, stream_path)

        # Also update ./data/{uid}/stream.opus for public stream listing
        streams_dir = Path("data") / uid
        streams_dir.mkdir(parents=True, exist_ok=True)
        streams_stream_path = streams_dir / "stream.opus"
        shutil.copy2(processed_path, streams_stream_path)

        db.add(UploadLog(
            uid=uid,
            ip=request.client.host,
            filename=file.filename,
            size_bytes=original_size
        ))

        # Store updated quota
        size = processed_path.stat().st_size
        quota = db.get(UserQuota, uid)
        if not quota:
            quota = UserQuota(uid=uid)
            db.add(quota)
        quota.storage_bytes += size
        db.commit()

        return {
            "stream_url": f"http://localhost:8000/streams/{uid}/stream.opus",
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
