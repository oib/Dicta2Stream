"""
Shared test fixtures for dicta2stream test suite.
Uses an in-memory SQLite database to avoid touching production data.
"""

import os
import sys
import pytest
import tempfile
import shutil

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Override DATABASE_URL before any app imports
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["ADMIN_SECRET"] = "test-admin-secret"
os.environ["DEBUG"] = "0"

from sqlmodel import SQLModel, Session, create_engine
from starlette.testclient import TestClient


# --- Test database engine (SQLite in-memory) ---

TEST_DATABASE_URL = "sqlite:///./test.db"

@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine (SQLite file, shared across session)."""
    engine = create_engine(TEST_DATABASE_URL, echo=False)
    SQLModel.metadata.create_all(engine)
    yield engine
    # Cleanup
    engine.dispose()
    if os.path.exists("test.db"):
        os.remove("test.db")


@pytest.fixture(scope="function")
def db_session(test_engine):
    """Provide a clean database session for each test."""
    # Recreate all tables for isolation
    SQLModel.metadata.drop_all(test_engine)
    SQLModel.metadata.create_all(test_engine)
    session = Session(test_engine)
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(test_engine, tmp_path):
    """Provide a FastAPI TestClient with test database and temp directories."""
    import src.backend.database as db_module
    from src.backend.main import app

    # Patch the engine used by the app
    original_engine = db_module.engine
    db_module.engine = test_engine

    # Recreate tables
    SQLModel.metadata.drop_all(test_engine)
    SQLModel.metadata.create_all(test_engine)

    # Create required directories
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    log_dir = tmp_path / "log"
    log_dir.mkdir()

    # Create a minimal index.html for the / and /me routes
    frontend_dir = tmp_path / "src" / "frontend" / "static"
    frontend_dir.mkdir(parents=True)
    (frontend_dir / "index.html").write_text("<html><body>test</body></html>")

    with TestClient(app) as tc:
        yield tc

    # Restore original engine
    db_module.engine = original_engine


@pytest.fixture
def sample_user_data():
    """Sample user data for registration tests."""
    return {
        "email": "test@example.com",
        "user": "testuser",
    }


@pytest.fixture
def confirmed_user(db_session):
    """Create a confirmed user in the test database."""
    from src.backend.models import User, UserQuota
    import uuid

    user = User(
        email="confirmed@example.com",
        username="confirmeduser",
        token=str(uuid.uuid4()),
        confirmed=True,
        ip="127.0.0.1",
    )
    quota = UserQuota(uid="confirmed@example.com", storage_bytes=0)
    db_session.add(user)
    db_session.add(quota)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def tmp_user_dir(tmp_path):
    """Create a temporary user directory with test audio files."""
    user_dir = tmp_path / "testuser"
    user_dir.mkdir()
    return user_dir


@pytest.fixture
def tmp_log_dir(tmp_path):
    """Create a temporary log directory."""
    log_dir = tmp_path / "log"
    log_dir.mkdir()
    return log_dir
