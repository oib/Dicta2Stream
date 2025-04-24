# redirect.py — Short stream link: /stream/{uid} → /stream/{uid}/stream.opus

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pathlib import Path

router = APIRouter()
DATA_ROOT = Path("/data")

@router.get("/stream/{uid}")
def redirect_to_stream(uid: str):
    stream_path = DATA_ROOT / uid / "stream.opus"
    if not stream_path.exists():
        raise HTTPException(status_code=404, detail="Stream not found")

    return RedirectResponse(f"/stream/{uid}/stream.opus")
