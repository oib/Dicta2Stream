# magic.py — handle magic token login confirmation

from fastapi import APIRouter, Form, HTTPException, Depends, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse
from sqlmodel import Session, select
from database import get_db
from models import User, DBSession
from datetime import datetime, timedelta
import secrets
import json

router = APIRouter()

@router.post("/magic-login")
async def magic_login(request: Request, response: Response, token: str = Form(...)):
    # Debug messages disabled
    
    # Use the database session context manager
    with get_db() as db:
        try:
            # Look up user by token
            user = db.query(User).filter(User.token == token).first()
            # Debug messages disabled

            if not user:
                # Debug messages disabled
                raise HTTPException(status_code=401, detail="Invalid or expired token")

            if datetime.utcnow() - user.token_created > timedelta(minutes=30):
                # Debug messages disabled
                raise HTTPException(status_code=401, detail="Token expired")

            # Mark user as confirmed if not already
            if not user.confirmed:
                user.confirmed = True
                user.ip = request.client.host
                db.add(user)
                # Debug messages disabled

            # Create a new session for the user (valid for 24 hours)
            session_token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(hours=24)
            
            # Create new session
            session = DBSession(
                token=session_token,
                uid=user.email or user.username,  # Use email as UID
                ip_address=request.client.host or "",
                user_agent=request.headers.get("user-agent", ""),
                expires_at=expires_at,
                is_active=True
            )
            db.add(session)
            db.commit()
            
            # Store user data for use after the session is committed
            user_email = user.email or user.username
            username = user.username
            
        except Exception as e:
            db.rollback()
            # Debug messages disabled
            # Debug messages disabled
            raise HTTPException(status_code=500, detail="Database error during login")
    
    # Determine if we're running in development (localhost) or production
    is_localhost = request.url.hostname == "localhost"
    
    # Prepare response data
    response_data = {
        "success": True,
        "message": "Login successful",
        "user": {
            "email": user_email,
            "username": username
        },
        "token": session_token  # Include the token in the JSON response
    }
    
    # Create the response
    response = JSONResponse(
        content=response_data,
        status_code=200
    )
    
    # Set cookies
    response.set_cookie(
        key="sessionid",
        value=session_token,
        httponly=True,
        secure=not is_localhost,
        samesite="lax" if is_localhost else "none",
        max_age=86400,  # 24 hours
        path="/"
    )
    
    response.set_cookie(
        key="uid",
        value=user_email,
        samesite="lax" if is_localhost else "none",
        secure=not is_localhost,
        max_age=86400,  # 24 hours
        path="/"
    )
    
    response.set_cookie(
        key="authToken",
        value=session_token,
        samesite="lax" if is_localhost else "none",
        secure=not is_localhost,
        max_age=86400,  # 24 hours
        path="/"
    )
    
    # Debug messages disabled
    # Debug messages disabled
    # Debug messages disabled
    return response
