"""Authentication middleware and utilities for dicta2stream"""
from fastapi import Request, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from typing import Optional

from .models import User, Session as DBSession, verify_session
from .database import get_db

security = HTTPBearer()

def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """Dependency to get the current authenticated user"""
    token = credentials.credentials
    
    # Use the database session context manager
    with get_db() as db:
        db_session = verify_session(db, token)
        
        if not db_session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get the user from the session
        user = db.exec(select(User).where(User.email == db_session.uid)).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Attach the session to the request state for later use
        request.state.session = db_session
        return user


def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security, use_cache=False)
) -> Optional[User]:
    """Dependency that returns the current user if authenticated, None otherwise"""
    if not credentials:
        return None
        
    try:
        # get_current_user now handles its own database session
        return get_current_user(request, credentials)
    except HTTPException:
        return None


def create_session(user: User, request: Request) -> DBSession:
    """Create a new session for the user (valid for 24 hours)"""
    import secrets
    from datetime import datetime, timedelta, timezone
    
    user_agent = request.headers.get("user-agent", "")
    ip_address = request.client.host if request.client else "0.0.0.0"
    
    # Create session token and set 24-hour expiry
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    
    # Create the session object
    session = DBSession(
        token=session_token,
        user_id=user.email,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at,
        is_active=True
    )
    
    # Use the database session context manager
    with get_db() as db:
        try:
            db.add(session)
            db.commit()
            db.refresh(session)  # Ensure we have the latest data
            return session
        except Exception as e:
            db.rollback()
            # Debug messages disabled
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create session"
            )
