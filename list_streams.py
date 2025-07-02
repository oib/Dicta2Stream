# list_streams.py — FastAPI route to list all public streams (users with stream.opus)

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse, Response
from pathlib import Path
import asyncio

router = APIRouter()
DATA_ROOT = Path("./data")

@router.get("/streams-sse")
async def streams_sse(request: Request):
    print(f"[SSE] New connection from {request.client.host}")
    print(f"[SSE] Request headers: {dict(request.headers)}")
    
    # Add CORS headers for SSE
    origin = request.headers.get('origin', '')
    allowed_origins = ["https://dicta2stream.net", "http://localhost:8000", "http://127.0.0.1:8000"]
    
    # Use the request origin if it's in the allowed list, otherwise use the first allowed origin
    cors_origin = origin if origin in allowed_origins else allowed_origins[0]
    
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": cors_origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Expose-Headers": "Content-Type",
        "X-Accel-Buffering": "no"  # Disable buffering for nginx
    }
    
    # Handle preflight requests
    if request.method == "OPTIONS":
        print("[SSE] Handling OPTIONS preflight request")
        headers.update({
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers", "*"),
            "Access-Control-Max-Age": "86400"  # 24 hours
        })
        return Response(status_code=204, headers=headers)
    
    print("[SSE] Starting SSE stream")
    
    async def event_wrapper():
        try:
            async for event in list_streams_sse():
                yield event
        except Exception as e:
            print(f"[SSE] Error in event generator: {str(e)}")
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'error': True, 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        event_wrapper(),
        media_type="text/event-stream",
        headers=headers
    )

import json
import datetime

async def list_streams_sse():
    print("[SSE] Starting stream generator")
    txt_path = Path("./public_streams.txt")
    
    if not txt_path.exists():
        print(f"[SSE] No public_streams.txt found")
        yield f"data: {json.dumps({'end': True})}\n\n"
        return
    
    try:
        # Send initial ping
        print("[SSE] Sending initial ping")
        yield ":ping\n\n"
        
        # Read and send the file contents
        with txt_path.open("r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                    
                try:
                    # Parse the JSON to validate it
                    stream = json.loads(line)
                    print(f"[SSE] Sending stream data: {stream}")
                    
                    # Send the data as an SSE event
                    event = f"data: {json.dumps(stream)}\n\n"
                    yield event
                    
                    # Small delay to prevent overwhelming the client
                    await asyncio.sleep(0.1)
                    
                except json.JSONDecodeError as e:
                    print(f"[SSE] JSON decode error: {e} in line: {line}")
                    continue
                except Exception as e:
                    print(f"[SSE] Error processing line: {e}")
                    continue
        
        print("[SSE] Sending end event")
        yield f"data: {json.dumps({'end': True})}\n\n"
        
    except Exception as e:
        print(f"[SSE] Error in stream generator: {str(e)}")
        import traceback
        traceback.print_exc()
        yield f"data: {json.dumps({'error': True, 'message': str(e)})}\n\n"
    finally:
        print("[SSE] Stream generator finished")

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
