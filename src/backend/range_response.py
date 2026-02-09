# range_response.py — Range request support for audio files in FastAPI
import os
from fastapi import Request, HTTPException
from fastapi.responses import StreamingResponse
from typing import Generator

def parse_range_header(range_header, file_size):
    if not range_header or not range_header.startswith('bytes='):
        return None
    ranges = range_header[6:].split(',')[0].strip().split('-')
    if len(ranges) != 2:
        return None
    try:
        start = int(ranges[0]) if ranges[0] else 0
        end = int(ranges[1]) if ranges[1] else file_size - 1
        if start > end or end >= file_size:
            return None
        return start, end
    except ValueError:
        return None

def file_stream_generator(path, start, end, chunk_size=8192) -> Generator[bytes, None, None]:
    with open(path, 'rb') as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = f.read(min(chunk_size, remaining))
            if not chunk:
                break
            yield chunk
            remaining -= len(chunk)

def range_response(request: Request, file_path: str, content_type: str = 'audio/ogg'):
    file_size = os.path.getsize(file_path)
    range_header = request.headers.get('range')
    range_tuple = parse_range_header(range_header, file_size)
    if range_tuple:
        start, end = range_tuple
        headers = {
            'Content-Range': f'bytes {start}-{end}/{file_size}',
            'Accept-Ranges': 'bytes',
            'Content-Length': str(end - start + 1),
        }
        return StreamingResponse(
            file_stream_generator(file_path, start, end),
            status_code=206,
            media_type=content_type,
            headers=headers
        )
    else:
        headers = {
            'Accept-Ranges': 'bytes',
            'Content-Length': str(file_size),
        }
        return StreamingResponse(
            file_stream_generator(file_path, 0, file_size - 1),
            status_code=200,
            media_type=content_type,
            headers=headers
        )
