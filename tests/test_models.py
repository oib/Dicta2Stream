"""Tests for database models (User, UserQuota, UploadLog, PublicStream, DBSession)."""

import pytest
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select


def test_create_user(db_session):
    """Test creating a User record."""
    from src.backend.models import User

    user = User(
        email="user@test.com",
        username="testuser",
        token="abc123",
        confirmed=False,
        ip="192.168.1.1",
    )
    db_session.add(user)
    db_session.commit()

    result = db_session.get(User, "user@test.com")
    assert result is not None
    assert result.username == "testuser"
    assert result.token == "abc123"
    assert result.confirmed is False
    assert result.ip == "192.168.1.1"
    assert isinstance(result.token_created, datetime)


@pytest.mark.filterwarnings("ignore::sqlalchemy.exc.SAWarning")
def test_user_email_is_primary_key(db_session):
    """Test that email serves as primary key — duplicates raise error."""
    from src.backend.models import User
    from sqlalchemy.exc import IntegrityError

    user1 = User(email="dup@test.com", username="user1", token="t1")
    user2 = User(email="dup@test.com", username="user2", token="t2")
    db_session.add(user1)
    db_session.commit()

    db_session.add(user2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_user_username_unique(db_session):
    """Test that username must be unique."""
    from src.backend.models import User
    from sqlalchemy.exc import IntegrityError

    user1 = User(email="a@test.com", username="samename", token="t1")
    user2 = User(email="b@test.com", username="samename", token="t2")
    db_session.add(user1)
    db_session.commit()

    db_session.add(user2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_create_user_quota(db_session):
    """Test creating a UserQuota record."""
    from src.backend.models import UserQuota

    quota = UserQuota(uid="user@test.com", storage_bytes=1024)
    db_session.add(quota)
    db_session.commit()

    result = db_session.get(UserQuota, "user@test.com")
    assert result is not None
    assert result.storage_bytes == 1024


def test_user_quota_default_zero(db_session):
    """Test that UserQuota defaults to 0 bytes."""
    from src.backend.models import UserQuota

    quota = UserQuota(uid="new@test.com")
    db_session.add(quota)
    db_session.commit()

    result = db_session.get(UserQuota, "new@test.com")
    assert result.storage_bytes == 0


def test_create_upload_log(db_session):
    """Test creating an UploadLog record."""
    from src.backend.models import UploadLog

    log = UploadLog(
        uid="user@test.com",
        ip="10.0.0.1",
        filename="recording.mp3",
        processed_filename="abc123.opus",
        size_bytes=50000,
    )
    db_session.add(log)
    db_session.commit()

    from sqlmodel import select
    result = db_session.exec(select(UploadLog)).first()
    assert result is not None
    assert result.uid == "user@test.com"
    assert result.filename == "recording.mp3"
    assert result.processed_filename == "abc123.opus"
    assert result.size_bytes == 50000
    assert result.id is not None
    assert isinstance(result.created_at, datetime)


def test_create_public_stream(db_session):
    """Test creating a PublicStream record."""
    from src.backend.models import PublicStream

    stream = PublicStream(
        uid="user@test.com",
        username="testuser",
        storage_bytes=2048,
    )
    db_session.add(stream)
    db_session.commit()

    result = db_session.get(PublicStream, "user@test.com")
    assert result is not None
    assert result.username == "testuser"
    assert result.storage_bytes == 2048
    assert isinstance(result.created_at, datetime)


def test_create_db_session(db_session):
    """Test creating a DBSession record."""
    from src.backend.models import User, DBSession

    # Need a user first (foreign key)
    user = User(email="sess@test.com", username="sessuser", token="tok")
    db_session.add(user)
    db_session.commit()

    session = DBSession(
        token="session-token-123",
        uid="sess@test.com",
        ip_address="127.0.0.1",
        user_agent="TestAgent/1.0",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        is_active=True,
    )
    db_session.add(session)
    db_session.commit()

    result = db_session.get(DBSession, "session-token-123")
    assert result is not None
    assert result.uid == "sess@test.com"
    assert result.is_active is True
    assert result.ip_address == "127.0.0.1"


def test_db_session_expired(db_session):
    """Test that expired sessions can be detected."""
    from src.backend.models import User, DBSession

    user = User(email="exp@test.com", username="expuser", token="tok")
    db_session.add(user)
    db_session.commit()

    expired_session = DBSession(
        token="expired-token",
        uid="exp@test.com",
        ip_address="127.0.0.1",
        user_agent="TestAgent/1.0",
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),  # Already expired
        is_active=True,
    )
    db_session.add(expired_session)
    db_session.commit()

    # Query for active, non-expired sessions
    from sqlmodel import select as sel
    result = db_session.exec(sel(DBSession).where(
        DBSession.token == "expired-token",
        DBSession.is_active == True,
        DBSession.expires_at > datetime.now(timezone.utc),
    )).first()
    assert result is None  # Should not find expired session


def test_multiple_upload_logs_per_user(db_session):
    """Test that a user can have multiple upload logs."""
    from src.backend.models import UploadLog

    for i in range(5):
        log = UploadLog(
            uid="user@test.com",
            ip="10.0.0.1",
            filename=f"file_{i}.mp3",
            processed_filename=f"uuid_{i}.opus",
            size_bytes=1000 * (i + 1),
        )
        db_session.add(log)
    db_session.commit()

    from sqlmodel import select as sel2
    logs = db_session.exec(sel2(UploadLog).where(UploadLog.uid == "user@test.com")).all()
    assert len(logs) == 5
    assert sum(l.size_bytes for l in logs) == 15000
