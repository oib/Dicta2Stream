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

def initialize_user_directory(uid: str):
    """Initialize user directory with a silent stream.opus file"""
    try:
        user_dir = DATA_ROOT / uid
        default_stream_path = DATA_ROOT / "stream.opus"
        
        # Debug messages disabled
        
        # Create the directory if it doesn't exist
        user_dir.mkdir(parents=True, exist_ok=True)
        # Debug messages disabled
        
        # Create stream.opus by copying the default stream.opus file
        user_stream_path = user_dir / "stream.opus"
        # Debug messages disabled
        
        if not user_stream_path.exists():
            if default_stream_path.exists():
                import shutil
                shutil.copy2(default_stream_path, user_stream_path)
                # Debug messages disabled
            else:
                print(f"[ERROR] Default stream.opus not found at {default_stream_path}")
                # Fallback: create an empty file to prevent errors
                with open(user_stream_path, 'wb') as f:
                    f.write(b'')
                
        return True
    except Exception as e:
        print(f"Error initializing user directory for {uid}: {str(e)}")
        return False

@router.post("/register")
def register(request: Request, email: str = Form(...), user: str = Form(...)):
    from sqlalchemy.exc import IntegrityError
    from datetime import datetime
    
    # Use the database session context manager
    with get_db() as db:
        try:
            # Check if user exists by email
            existing_user_by_email = db.get(User, email)
            
            # Check if user exists by username
            existing_user_by_username = db.query(User).filter(User.username == user).first()
            
            token = str(uuid.uuid4())
            action = None
            
            # Case 1: Email and username match in db - it's a login
            if existing_user_by_email and existing_user_by_username and existing_user_by_email.email == existing_user_by_username.email:
                # Update token for existing user (login)
                existing_user_by_email.token = token
                existing_user_by_email.token_created = datetime.utcnow()
                existing_user_by_email.confirmed = False
                existing_user_by_email.ip = request.client.host
                db.add(existing_user_by_email)
                db.commit()
                action = "login"
            
            # Case 2: Email matches but username does not - only one account per email
            elif existing_user_by_email and (not existing_user_by_username or existing_user_by_email.email != existing_user_by_username.email):
                raise HTTPException(status_code=409, detail="📧 This email is already registered with a different username.\nOnly one account per email is allowed.")
            
            # Case 3: Email does not match but username is in db - username already taken
            elif not existing_user_by_email and existing_user_by_username:
                raise HTTPException(status_code=409, detail="👤 This username is already taken.\nPlease choose a different username.")
            
            # Case 4: Neither email nor username exist - create new user
            elif not existing_user_by_email and not existing_user_by_username:
                # Register new user
                new_user = User(email=email, username=user, token=token, confirmed=False, ip=request.client.host)
                new_quota = UserQuota(uid=email)  # Use email as UID for quota tracking
                
                db.add(new_user)
                db.add(new_quota)
                db.commit()
                action = "register"
                
                # Initialize user directory after successful registration
                if not initialize_user_directory(email):
                    print(f"[WARNING] Failed to initialize user directory for {email}")
            
            # If we get here, we've either logged in or registered successfully
            if action not in ["login", "register"]:
                raise HTTPException(status_code=400, detail="Invalid registration request")
                
            # Store the email for use after the session is committed
            user_email = email
            
            # Only after successful commit, initialize the user directory
            initialize_user_directory(email)
        except Exception as e:
            db.rollback()
            if isinstance(e, IntegrityError):
                # Race condition: user created after our check
                # Check which constraint was violated to provide specific feedback
                error_str = str(e).lower()
                
                if 'username' in error_str or 'user_username_key' in error_str:
                    raise HTTPException(status_code=409, detail="👤 This username is already taken.\nPlease choose a different username.")
                elif 'email' in error_str or 'user_pkey' in error_str:
                    raise HTTPException(status_code=409, detail="📧 This email is already registered with a different username.\nOnly one account per email is allowed.")
                else:
                    # Generic fallback if we can't determine the specific constraint
                    raise HTTPException(status_code=409, detail="⚠️ Registration failed due to a conflict.\nPlease try again with different credentials.")
            else:
                raise HTTPException(status_code=500, detail=f"Database error: {e}")
        
        # Send magic link with appropriate message based on action
        msg = EmailMessage()
        msg["From"] = MAGIC_FROM
        msg["To"] = email
    
    if action == "login":
        msg["Subject"] = "Your magic login link"
        msg.set_content(
            f"Hello {user},\n\nClick to log in to your account:\n{MAGIC_DOMAIN}/?token={token}\n\nThis link is valid for one-time login."
        )
        response_message = "📧 Check your email for a magic login link!"
    else:  # registration
        msg["Subject"] = "Welcome to dicta2stream - Confirm your account"
        msg.set_content(
            f"Hello {user},\n\nWelcome to dicta2stream! Click to confirm your new account:\n{MAGIC_DOMAIN}/?token={token}\n\nThis link is valid for one-time confirmation."
        )
        response_message = "🎉 Account created! Check your email for a magic login link!"
    
    try:
        with smtplib.SMTP("localhost") as smtp:
            smtp.send_message(msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email failed: {e}")
    
    return {"message": response_message, "action": action}
