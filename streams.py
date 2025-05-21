# streams.py — Public streams endpoint for dicta2stream
from fastapi import APIRouter
from fastapi import APIRouter
from pathlib import Path
import json

router = APIRouter()

@router.get("/streams")
def list_streams():
    txt_path = Path("./public_streams.txt")
    if not txt_path.exists():
        return {"streams": []}
    try:
        streams = []
        with txt_path.open("r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    streams.append(json.loads(line))
                except Exception:
                    continue  # skip malformed lines
        return {"streams": streams}
    except Exception:
        return {"streams": []}
