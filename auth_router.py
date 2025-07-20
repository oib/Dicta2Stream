"""Authentication routes for dicta2stream"""
from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from datetime import datetime

from models import Session as DBSession, User
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/api", tags=["auth"])
security = HTTPBearer()

@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Log out by invalidating the current session"""
    try:
        # Get the token from the Authorization header
        token = credentials.credentials if credentials else None
        
        if not token:
            return {"message": "No session to invalidate"}
        
        try:
            # Find and invalidate the session
            session = db.exec(
                select(DBSession)
                .where(DBSession.token == token)
                .where(DBSession.is_active == True)  # noqa: E712
            ).first()
            
            if session:
                try:
                    session.is_active = False
                    db.add(session)
                    db.commit()
                except Exception:
                    db.rollback()
                    
        except Exception:
            # Continue with logout even if session lookup fails
            pass
        
        # Clear the session cookie
        response.delete_cookie(
            key="sessionid",
            httponly=True,
            secure=True,
            samesite="lax",
            path="/"
        )
        
        # Clear any other auth-related cookies
        for cookie_name in ["uid", "authToken", "isAuthenticated", "token"]:
            response.delete_cookie(
                key=cookie_name,
                path="/",
                domain=request.url.hostname,
                secure=True,
                httponly=True,
                samesite="lax"
            )
        
        return {"message": "Successfully logged out"}
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception:
        # Don't expose internal errors to the client
        return {"message": "Logout processed"}


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
