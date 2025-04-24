# register.py — user registration and magic link sender

from fastapi import APIRouter, Form, Request, HTTPException, Depends
from sqlmodel import Session, select
from models import User, UserQuota
from database import get_db
import uuid
import smtplib
from email.message import EmailMessage

router = APIRouter()

MAGIC_FROM = "noreply@dicta2stream.net"
MAGIC_DOMAIN = "https://dicta2stream.net"

@router.post("/register")
def register(request: Request, email: str = Form(...), user: str = Form(...), db: Session = Depends(get_db)):
    if db.get(User, email):
        raise HTTPException(status_code=400, detail="Email already registered")

    token = str(uuid.uuid4())
    db.add(User(email=email, username=user, token=token, confirmed=False, ip=request.client.host))
    db.add(UserQuota(uid=user))
    db.commit()

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
