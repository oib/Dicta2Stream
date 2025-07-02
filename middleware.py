"""Custom middleware for the dicta2stream application"""
import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from starlette.types import ASGIApp

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to implement rate limiting"""
    def __init__(self, app: ASGIApp, limit: int = 100, window: int = 60):
        super().__init__(app)
        self.limit = limit
        self.window = window
        self.requests = {}

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Get client IP
        if "x-forwarded-for" in request.headers:
            ip = request.headers["x-forwarded-for"].split(",")[0]
        else:
            ip = request.client.host or "unknown"
        
        # Get current timestamp
        current_time = int(time.time())
        
        # Clean up old entries
        self.requests = {
            k: v 
            for k, v in self.requests.items() 
            if current_time - v["timestamp"] < self.window
        }
        
        # Check rate limit
        if ip in self.requests:
            self.requests[ip]["count"] += 1
            if self.requests[ip]["count"] > self.limit:
                raise HTTPException(
                    status_code=429, 
                    detail="Too many requests. Please try again later."
                )
        else:
            self.requests[ip] = {"count": 1, "timestamp": current_time}
        
        # Process the request
        response = await call_next(request)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to responses"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy
        csp_parts = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "media-src 'self' blob: data:",
            "connect-src 'self' https: wss:",
            "frame-ancestors 'none'"
        ]
        
        response.headers["Content-Security-Policy"] = "; ".join(csp_parts)
        
        return response
