# register.py — user registration and magic link sender

from fastapi import APIRouter, Form, Request, HTTPException, Depends
from sqlmodel import Session, select
from models import User, UserQuota
from database import get_db
import uuid
import smtplib
from email.message import EmailMessage
from pathlib import Path
import os

router = APIRouter()

MAGIC_FROM = "noreply@dicta2stream.net"
MAGIC_DOMAIN = "https://dicta2stream.net"
DATA_ROOT = Path("./data")

def initialize_user_directory(username: str):
    """Initialize user directory with a silent stream.opus file"""
    try:
        user_dir = DATA_ROOT / username
        default_stream_path = DATA_ROOT / "stream.opus"
        
        print(f"[DEBUG] Initializing user directory: {user_dir.absolute()}")
        
        # Create the directory if it doesn't exist
        user_dir.mkdir(parents=True, exist_ok=True)
        print(f"[DEBUG] Directory created or already exists: {user_dir.exists()}")
        
        # Create stream.opus by copying the default stream.opus file
        user_stream_path = user_dir / "stream.opus"
        print(f"[DEBUG] Creating stream.opus at: {user_stream_path.absolute()}")
        
        if not user_stream_path.exists():
            if default_stream_path.exists():
                import shutil
                shutil.copy2(default_stream_path, user_stream_path)
                print(f"[DEBUG] Copied default stream.opus to {user_stream_path}")
            else:
                print(f"[ERROR] Default stream.opus not found at {default_stream_path}")
                # Fallback: create an empty file to prevent errors
                with open(user_stream_path, 'wb') as f:
                    f.write(b'')
                
        return True
    except Exception as e:
        print(f"Error initializing user directory for {username}: {str(e)}")
        return False

@router.post("/register")
def register(request: Request, email: str = Form(...), user: str = Form(...), db: Session = Depends(get_db)):
    from sqlalchemy.exc import IntegrityError
    # Try to find user by email or username
    existing_user = db.get(User, email)
    if not existing_user:
        # Try by username (since username is not primary key, need to query)
        stmt = select(User).where(User.username == user)
        existing_user = db.exec(stmt).first()
    token = str(uuid.uuid4())
    if existing_user:
        # Update token, timestamp, and ip, set confirmed False
        from datetime import datetime
        existing_user.token = token
        existing_user.token_created = datetime.utcnow()
        existing_user.confirmed = False
        existing_user.ip = request.client.host
        db.add(existing_user)
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {e}")
    else:
        # Register new user
        db.add(User(email=email, username=user, token=token, confirmed=False, ip=request.client.host))
        db.add(UserQuota(uid=user))
        
        try:
            # First commit the user to the database
            db.commit()
            
            # Only after successful commit, initialize the user directory
            initialize_user_directory(user)
        except Exception as e:
            db.rollback()
            if isinstance(e, IntegrityError):
                # Race condition: user created after our check
                # Try again as login
                stmt = select(User).where((User.email == email) | (User.username == user))
                existing_user = db.exec(stmt).first()
                if existing_user:
                    existing_user.token = token
                    existing_user.confirmed = False
                    existing_user.ip = request.client.host
                    db.add(existing_user)
                    db.commit()
                else:
                    raise HTTPException(status_code=409, detail="Username or email already exists.")
            else:
                raise HTTPException(status_code=500, detail=f"Database error: {e}")
    # Send magic link
    msg = EmailMessage()
    msg["From"] = MAGIC_FROM
    msg["To"] = email
    msg["Subject"] = "Your magic login link"
    msg.set_content(
        f"Hello {user},\n\nClick to confirm your account:\n{MAGIC_DOMAIN}/?token={token}\n\nThis link is valid for one-time login."
    )
    try:
        with smtplib.SMTP("localhost") as smtp:
            smtp.send_message(msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email failed: {e}")
    return { "message": "Confirmation sent" }
