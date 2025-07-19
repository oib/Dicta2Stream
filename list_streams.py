# list_streams.py — FastAPI route to list all public streams (users with stream.opus)

from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import select
from models import PublicStream
from database import get_db
from pathlib import Path
import asyncio
import os
import json

router = APIRouter()
DATA_ROOT = Path("./data")

@router.get("/streams-sse")
async def streams_sse(request: Request, db: Session = Depends(get_db)):
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
        headers.update({
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers", "*"),
            "Access-Control-Max-Age": "86400"  # 24 hours
        })
        return Response(status_code=204, headers=headers)
    
    async def event_wrapper():
        try:
            async for event in list_streams_sse(db):
                yield event
        except Exception as e:
            # Only log errors if DEBUG is enabled
            if os.getenv("DEBUG") == "1":
                import traceback
                traceback.print_exc()
            yield f"data: {json.dumps({'error': True, 'message': 'An error occurred'})}\n\n"
    
    return StreamingResponse(
        event_wrapper(),
        media_type="text/event-stream",
        headers=headers
    )

async def list_streams_sse(db):
    """Stream public streams from the database as Server-Sent Events"""
    try:
        # Send initial ping
        yield ":ping\n\n"
        
        # Query all public streams from the database
        stmt = select(PublicStream).order_by(PublicStream.mtime.desc())
        result = db.execute(stmt)
        streams = result.scalars().all()
        
        if not streams:
            yield f"data: {json.dumps({'end': True})}\n\n"
            return
            
        # Send each stream as an SSE event
        for stream in streams:
            try:
                stream_data = {
                    'uid': stream.uid,
                    'size': stream.size,
                    'mtime': stream.mtime,
                    'created_at': stream.created_at.isoformat() if stream.created_at else None,
                    'updated_at': stream.updated_at.isoformat() if stream.updated_at else None
                }
                yield f"data: {json.dumps(stream_data)}\n\n"
                # Small delay to prevent overwhelming the client
                await asyncio.sleep(0.1)
            except Exception as e:
                if os.getenv("DEBUG") == "1":
                    import traceback
                    traceback.print_exc()
                continue
        
        # Send end of stream marker
        yield f"data: {json.dumps({'end': True})}\n\n"
        
    except Exception as e:
        if os.getenv("DEBUG") == "1":
            import traceback
            traceback.print_exc()
        yield f"data: {json.dumps({'error': True, 'message': str(e)})}\n\n"
        yield f"data: {json.dumps({'error': True, 'message': 'Stream generation failed'})}\n\n"

def list_streams(db: Session = Depends(get_db)):
    """List all public streams from the database"""
    try:
        stmt = select(PublicStream).order_by(PublicStream.mtime.desc())
        result = db.execute(stmt)
        streams = result.scalars().all()
        
        return {
            "streams": [
                {
                    'uid': stream.uid,
                    'size': stream.size,
                    'mtime': stream.mtime,
                    'created_at': stream.created_at.isoformat() if stream.created_at else None,
                    'updated_at': stream.updated_at.isoformat() if stream.updated_at else None
                }
                for stream in streams
            ]
        }
    except Exception as e:
        if os.getenv("DEBUG") == "1":
            import traceback
            traceback.print_exc()
        return {"streams": []}
