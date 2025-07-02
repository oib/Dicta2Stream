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
async def magic_login(request: Request, response: Response, db: Session = Depends(get_db), token: str = Form(...)):
    print(f"[magic-login] Received token: {token}")
    user = db.exec(select(User).where(User.token == token)).first()
    print(f"[magic-login] User lookup: {'found' if user else 'not found'}")

    if not user:
        print("[magic-login] Invalid or expired token")
        return RedirectResponse(url="/?error=Invalid%20or%20expired%20token", status_code=302)

    if datetime.utcnow() - user.token_created > timedelta(minutes=30):
        print(f"[magic-login] Token expired for user: {user.username}")
        return RedirectResponse(url="/?error=Token%20expired", status_code=302)

    # Mark user as confirmed if not already
    if not user.confirmed:
        user.confirmed = True
        user.ip = request.client.host
        db.add(user)
        print(f"[magic-login] User {user.username} confirmed.")

    # Create a new session for the user (valid for 1 hour)
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)
    
    # Create new session
    session = DBSession(
        token=session_token,
        user_id=user.username,
        ip_address=request.client.host or "",
        user_agent=request.headers.get("user-agent", ""),
        expires_at=expires_at,
        is_active=True
    )
    db.add(session)
    db.commit()
    
    # Set cookie with the session token (valid for 1 hour)
    response.set_cookie(
        key="sessionid",
        value=session_token,
        httponly=True,
        secure=not request.url.hostname == "localhost",
        samesite="lax",
        max_age=3600,  # 1 hour
        path="/"
    )
    
    print(f"[magic-login] Session created for user: {user.username}")
    
    # Redirect to success page
    return RedirectResponse(
        url=f"/?login=success&confirmed_uid={user.username}",
        status_code=302,
        headers=dict(response.headers)
    )
