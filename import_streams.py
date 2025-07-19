#!/usr/bin/env python3
"""
Script to import stream data from backup file into the publicstream table.
"""
import json
from datetime import datetime
from pathlib import Path
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlmodel import Session
from models import PublicStream, User, UserQuota, DBSession, UploadLog
from database import engine

# Database connection URL - using the same as in database.py
DATABASE_URL = "postgresql://d2s:kuTy4ZKs2VcjgDh6@localhost:5432/dictastream"

def import_streams_from_backup(backup_file: str):
    """Import stream data from backup file into the database."""
    # Set up database connection
    SessionLocal = sessionmaker(bind=engine)
    
    with Session(engine) as session:
        try:
            # Read the backup file
            with open(backup_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        # Parse the JSON data
                        stream_data = json.loads(line)
                        uid = stream_data.get('uid')
                        size = stream_data.get('size', 0)
                        mtime = stream_data.get('mtime', int(datetime.now().timestamp()))
                        
                        if not uid:
                            print(f"Skipping invalid entry (missing uid): {line}")
                            continue
                        
                        # Check if the stream already exists
                        existing = session.exec(
                            select(PublicStream).where(PublicStream.uid == uid)
                        ).first()
                        
                        now = datetime.utcnow()
                        
                        if existing:
                            # Update existing record
                            existing.size = size
                            existing.mtime = mtime
                            existing.updated_at = now
                            session.add(existing)
                            print(f"Updated stream: {uid}")
                        else:
                            # Create new record
                            stream = PublicStream(
                                uid=uid,
                                size=size,
                                mtime=mtime,
                                created_at=now,
                                updated_at=now
                            )
                            session.add(stream)
                            print(f"Added stream: {uid}")
                        
                        # Commit after each record to ensure data integrity
                        session.commit()
                        
                    except json.JSONDecodeError as e:
                        print(f"Error parsing line: {line}")
                        print(f"Error: {e}")
                        session.rollback()
                    except Exception as e:
                        print(f"Error processing line: {line}")
                        print(f"Error: {e}")
                        session.rollback()
            
            print("Import completed successfully!")
            
        except Exception as e:
            session.rollback()
            print(f"Error during import: {e}")
            raise

if __name__ == "__main__":
    backup_file = "public_streams.txt.backup"
    if not Path(backup_file).exists():
        print(f"Error: Backup file '{backup_file}' not found.")
        exit(1)
    
    print(f"Starting import from {backup_file}...")
    import_streams_from_backup(backup_file)
