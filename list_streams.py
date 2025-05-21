# list_streams.py — FastAPI route to list all public streams (users with stream.opus)

from fastapi import APIRouter
from pathlib import Path
from fastapi.responses import StreamingResponse
import asyncio

router = APIRouter()
DATA_ROOT = Path("./data")

@router.get("/streams-sse")
def streams_sse():
    return list_streams_sse()

import json

import datetime

def list_streams_sse():
    async def event_generator():
        txt_path = Path("./public_streams.txt")
        if not txt_path.exists():
            print(f"[{datetime.datetime.now()}] [SSE] No public_streams.txt found")
            yield f"data: {json.dumps({'end': True})}\n\n"
            return
        try:
            with txt_path.open("r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        stream = json.loads(line)
                        print(f"[{datetime.datetime.now()}] [SSE] Yielding stream: {stream}")
                        yield f"data: {json.dumps(stream)}\n\n"
                        await asyncio.sleep(0)  # Yield control to event loop
                    except Exception as e:
                        print(f"[{datetime.datetime.now()}] [SSE] JSON decode error: {e}")
                        continue  # skip malformed lines
            print(f"[{datetime.datetime.now()}] [SSE] Yielding end event")
            yield f"data: {json.dumps({'end': True})}\n\n"
        except Exception as e:
            print(f"[{datetime.datetime.now()}] [SSE] Exception: {e}")
            yield f"data: {json.dumps({'end': True, 'error': True})}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")

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
