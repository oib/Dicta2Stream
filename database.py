# database.py — SQLModel engine/session for PostgreSQL

from sqlmodel import create_engine, Session, SQLModel
import os

POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://d2s:kuTy4ZKs2VcjgDh6@localhost:5432/dictastream")
engine = create_engine(POSTGRES_URL, echo=False)

# SQLAlchemy Base class for models
Base = SQLModel

def get_db():
    with Session(engine) as session:
        yield session
