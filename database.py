# database.py — SQLModel engine/session for PostgreSQL

from sqlmodel import create_engine, Session
import os

POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://d2s:kuTy4ZKs2VcjgDh6@localhost:5432/dictastream")
engine = create_engine(POSTGRES_URL, echo=False)

def get_db():
    with Session(engine) as session:
        yield session
