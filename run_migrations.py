#!/usr/bin/env python3
"""Run database migrations"""
import os
import sys
from alembic.config import Config
from alembic import command
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def run_migrations():
    # Get database URL from environment or use default
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost/dicta2stream"
    )
    
    # Set up Alembic config
    alembic_cfg = Config()
    alembic_cfg.set_main_option("script_location", "dev/migrations")
    alembic_cfg.set_main_option("sqlalchemy.url", database_url)
    
    # Run migrations
    command.upgrade(alembic_cfg, "head")
    print("Database migrations completed successfully.")

if __name__ == "__main__":
    run_migrations()
