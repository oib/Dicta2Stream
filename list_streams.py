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
async def streams_sse(request: Request):
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
        # Use the database session context manager
        with get_db() as db:
            try:
                async for event in list_streams_sse(db):
                    yield event
            except Exception as e:
                # Only log errors if DEBUG is enabled
                # Debug messages disabled
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
        
        # Query all public streams from the database with required fields
        # Also get all valid users to filter out orphaned streams
        from models import User
        
        # Use the query interface instead of execute
        all_streams = db.query(PublicStream).order_by(PublicStream.mtime.desc()).all()
        
        # Get all valid user UIDs (email and username)
        all_users = db.query(User).all()
        
        valid_uids = set()
        for user in all_users:
            valid_uids.add(user.email)
            valid_uids.add(user.username)
        
        # Filter out orphaned streams (streams without corresponding user accounts)
        streams = []
        orphaned_count = 0
        for stream in all_streams:
            if stream.uid in valid_uids:
                streams.append(stream)
            else:
                orphaned_count += 1
                print(f"[STREAMS] Filtering out orphaned stream: {stream.uid} (username: {stream.username})")
        
        if orphaned_count > 0:
            print(f"[STREAMS] Filtered out {orphaned_count} orphaned streams from public display")
        
        if not streams:
            print("No public streams found in the database")
            yield f"data: {json.dumps({'end': True})}\n\n"
            return
            
        # Debug messages disabled
        
        # Send each stream as an SSE event
        for stream in streams:
            try:
                # Ensure we have all required fields with fallbacks
                stream_data = {
                    'uid': stream.uid or '',
                    'size': stream.storage_bytes or 0,
                    'mtime': int(stream.mtime) if stream.mtime is not None else 0,
                    'username': stream.username or '',
                    'created_at': stream.created_at.isoformat() if stream.created_at else None,
                    'updated_at': stream.updated_at.isoformat() if stream.updated_at else None
                }
                # Debug messages disabled
                yield f"data: {json.dumps(stream_data)}\n\n"
                # Small delay to prevent overwhelming the client
                await asyncio.sleep(0.1)
            except Exception as e:
                print(f"Error processing stream {stream.uid}: {str(e)}")
                # Debug messages disabled
                continue
        
        # Send end of stream marker
        # Debug messages disabled
        yield f"data: {json.dumps({'end': True})}\n\n"
        
    except Exception as e:
        print(f"Error in list_streams_sse: {str(e)}")
        # Debug messages disabled
        yield f"data: {json.dumps({'error': True, 'message': str(e)})}\n\n"

@router.get("/streams")
def list_streams():
    """List all public streams from the database"""
    # Use the database session context manager
    with get_db() as db:
        try:
            # Use the query interface instead of execute
            streams = db.query(PublicStream).order_by(PublicStream.mtime.desc()).all()
            
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
            # Debug messages disabled
            return {"streams": []}
