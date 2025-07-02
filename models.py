# models.py — UploadLog table (SQLModel) and related models

from sqlmodel import SQLModel, Field, Session, select
from typing import Optional
from datetime import datetime
from database import engine

class User(SQLModel, table=True):
    token_created: datetime = Field(default_factory=datetime.utcnow)
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


def get_user_by_uid(uid: str) -> Optional[User]:
    with Session(engine) as session:
        statement = select(User).where(User.username == uid)
        result = session.exec(statement).first()
        return result
