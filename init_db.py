#!/usr/bin/env python3
"""Initialize the database with required tables"""
import os
import sys
from sqlmodel import SQLModel, create_engine
from dotenv import load_dotenv

# Add the parent directory to the path so we can import our models
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import User, UserQuota, UploadLog, PublicStream, Session

def init_db():
    """Initialize the database with required tables"""
    # Load environment variables
    load_dotenv()
    
    # Get database URL from environment or use default
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost/dicta2stream"
    )
    
    print(f"Connecting to database: {database_url}")
    
    # Create database engine
    engine = create_engine(database_url)
    
    # Create all tables
    print("Creating database tables...")
    SQLModel.metadata.create_all(engine)
    
    print("Database initialized successfully!")

if __name__ == "__main__":
    init_db()
