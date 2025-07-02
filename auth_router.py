"""Authentication routes for dicta2stream"""
from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session

from models import Session as DBSession, User
from database import get_db
from auth import get_current_user

router = APIRouter()
security = HTTPBearer()

@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Log out by invalidating the current session"""
    token = credentials.credentials
    
    # Find and invalidate the session
    session = db.exec(
        select(DBSession)
        .where(DBSession.token == token)
        .where(DBSession.is_active == True)  # noqa: E712
    ).first()
    
    if session:
        session.is_active = False
        db.add(session)
        db.commit()
    
    # Clear the session cookie
    response.delete_cookie(
        key="sessionid",  # Must match the cookie name in main.py
        httponly=True,
        secure=True,  # Must match the cookie settings from login
        samesite="lax",
        path="/"
    )
    
    return {"message": "Successfully logged out"}


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    return {
        "username": current_user.username,
        "email": current_user.email,
        "created_at": current_user.token_created.isoformat(),
        "is_confirmed": current_user.confirmed
    }


@router.get("/sessions")
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all active sessions for the current user"""
    sessions = DBSession.get_active_sessions(db, current_user.username)
    return [
        {
            "id": s.id,
            "ip_address": s.ip_address,
            "user_agent": s.user_agent,
            "created_at": s.created_at.isoformat(),
            "last_used_at": s.last_used_at.isoformat(),
            "expires_at": s.expires_at.isoformat()
        }
        for s in sessions
    ]


@router.post("/sessions/{session_id}/revoke")
async def revoke_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke a specific session"""
    session = db.get(DBSession, session_id)
    
    if not session or session.user_id != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is already inactive"
        )
    
    session.is_active = False
    db.add(session)
    db.commit()
    
    return {"message": "Session revoked"}
