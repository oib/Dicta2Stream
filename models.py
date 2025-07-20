# models.py — UploadLog table (SQLModel) and related models

from sqlmodel import SQLModel, Field, Session, select
from typing import Optional
from datetime import datetime
from database import engine

class User(SQLModel, table=True):
    token_created: datetime = Field(default_factory=datetime.utcnow)
    email: str = Field(primary_key=True)
    username: str = Field(unique=True, index=True)
    display_name: str = Field(default="", nullable=True)
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
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DBSession(SQLModel, table=True):
    token: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="user.username")
    ip_address: str
    user_agent: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    is_active: bool = True
    last_activity: datetime = Field(default_factory=datetime.utcnow)


class PublicStream(SQLModel, table=True):
    """Stores public stream metadata for all users"""
    uid: str = Field(primary_key=True)
    username: Optional[str] = Field(default=None, index=True)
    display_name: Optional[str] = Field(default=None)
    storage_bytes: int = 0
    mtime: int = Field(default_factory=lambda: int(datetime.utcnow().timestamp()))
    last_updated: Optional[datetime] = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


def get_user_by_uid(uid: str) -> Optional[User]:
    """
    Retrieve a user by their UID (username).
    
    Note: In this application, the User model uses email as primary key,
    but we're using username as UID for API routes. This function looks up
    users by username.
    
    Args:
        uid: The username to look up
        
    Returns:
        User object if found, None otherwise
    """
    with Session(engine) as session:
        # First try to find by username (which is what we're using as UID)
        statement = select(User).where(User.username == uid)
        user = session.exec(statement).first()
        
        # If not found by username, try by email (for backward compatibility)
        if not user and '@' in uid:
            statement = select(User).where(User.email == uid)
            user = session.exec(statement).first()
            
        return user


def verify_session(db: Session, token: str) -> DBSession:
    """Verify a session token and return the session if valid"""
    from datetime import datetime
    
    # Find the session
    session = db.exec(
        select(DBSession)
        .where(DBSession.token == token)
        .where(DBSession.is_active == True)  # noqa: E712
        .where(DBSession.expires_at > datetime.utcnow())
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last activity
    session.last_activity = datetime.utcnow()
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return session
