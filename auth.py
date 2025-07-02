"""Authentication middleware and utilities for dicta2stream"""
from fastapi import Request, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session
from typing import Optional

from models import User, Session as DBSession, verify_session
from database import get_db

security = HTTPBearer()

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """Dependency to get the current authenticated user"""
    token = credentials.credentials
    db_session = verify_session(db, token)
    
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get the user from the session
    user = db.exec(
        select(User).where(User.username == db_session.user_id)
    ).first()
    
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
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security, use_cache=False)
) -> Optional[User]:
    """Dependency that returns the current user if authenticated, None otherwise"""
    if not credentials:
        return None
        
    try:
        return get_current_user(request, db, credentials)
    except HTTPException:
        return None


def create_session(db: Session, user: User, request: Request) -> DBSession:
    """Create a new session for the user"""
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else "0.0.0.0"
    
    session = DBSession.create_for_user(
        user_id=user.username,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    db.add(session)
    db.commit()
    return session
