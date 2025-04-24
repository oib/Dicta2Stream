# list_streams.py — FastAPI route to list all public streams (users with stream.opus)

from fastapi import APIRouter
from pathlib import Path

router = APIRouter()
DATA_ROOT = Path("./data")

@router.get("/streams")
def list_streams():
    streams = []
    for user_dir in DATA_ROOT.iterdir():
        if user_dir.is_dir() and (user_dir / "stream.opus").exists():
            streams.append(user_dir.name)
    return {"streams": streams}
