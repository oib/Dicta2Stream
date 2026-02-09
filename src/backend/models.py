# models.py — UploadLog table (SQLModel) and related models

from sqlmodel import SQLModel, Field, Session, select
from typing import Optional
from datetime import datetime, timezone
from .database import engine

class User(SQLModel, table=True):
    token_created: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    email: str = Field(primary_key=True)
    username: str = Field(unique=True, index=True)
    token: str
    confirmed: bool = False
    ip: str = Field(default="")


class UserQuota(SQLModel, table=True):
    uid: str = Field(primary_key=True)
    storage_bytes: int = 0


class UploadLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    uid: str
    ip: str
    filename: Optional[str]  # Original filename
    processed_filename: Optional[str]  # Processed filename (UUID.opus)
    size_bytes: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DBSession(SQLModel, table=True):
    token: str = Field(primary_key=True)
    uid: str = Field(foreign_key="user.email")  # This references User.email (primary key)
    ip_address: str
    user_agent: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    is_active: bool = True
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PublicStream(SQLModel, table=True):
    """Stores public stream metadata for all users"""
    uid: str = Field(primary_key=True)
    username: Optional[str] = Field(default=None, index=True)
    storage_bytes: int = 0
    mtime: int = Field(default_factory=lambda: int(datetime.now(timezone.utc).timestamp()))
    last_updated: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def get_user_by_uid(uid: str) -> Optional[User]:
    """
    Retrieve a user by their UID (email).
    
    Note: In this application, UIDs are consistently email-based.
    The User model uses email as primary key, and all user references
    throughout the system use email format.
    
    Args:
        uid: The email to look up
        
    Returns:
        User object if found, None otherwise
    """
    with Session(engine) as session:
        # Primary lookup by email (which is what we're using as UID)
        statement = select(User).where(User.email == uid)
        user = session.exec(statement).first()
        
        # Fallback: try by username for legacy compatibility
        if not user and '@' not in uid:
            statement = select(User).where(User.username == uid)
            user = session.exec(statement).first()
            
        return user


def verify_session(db: Session, token: str) -> DBSession:
    """Verify a session token and return the session if valid"""
    
    # Find the session
    statement = select(DBSession).where(
        DBSession.token == token,
        DBSession.is_active == True,  # noqa: E712
        DBSession.expires_at > datetime.now(timezone.utc)
    )
    session = db.exec(statement).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last activity
    session.last_activity = datetime.now(timezone.utc)
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return session
