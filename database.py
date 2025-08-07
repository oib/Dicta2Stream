# database.py — SQLModel engine/session for PostgreSQL

from sqlmodel import create_engine, Session, SQLModel
from contextlib import contextmanager
import os

# Debug messages disabled

POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://d2s:kuTy4ZKs2VcjgDh6@localhost:5432/dictastream")
engine = create_engine(POSTGRES_URL, echo=False)  # Disable echo for production

# SQLAlchemy Base class for models
Base = SQLModel

@contextmanager
def get_db():
    """Session management context manager that ensures proper commit/rollback."""
    session = Session(engine)
    try:
        # Debug messages disabled
        yield session
        session.commit()
        # Debug messages disabled
    except Exception as e:
        # Debug messages disabled
        session.rollback()
        raise
    finally:
        # Debug messages disabled
        session.close()

# For backward compatibility
get_db_deprecated = get_db
