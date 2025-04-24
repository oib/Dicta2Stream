# dev_user.py — Script to create and confirm a dev user for dicta2stream

import os
from sqlmodel import Session
from database import engine
from models import User, UserQuota
from datetime import datetime
import uuid

USERNAME = os.getenv("DEV_USERNAME", "devuser")
EMAIL = os.getenv("DEV_EMAIL", "devuser@localhost")
IP = os.getenv("DEV_IP", "127.0.0.1")

with Session(engine) as session:
    user = session.get(User, EMAIL)
    if not user:
        token = str(uuid.uuid4())
        user = User(
            email=EMAIL,
            username=USERNAME,
            token=token,
            confirmed=True,
            ip=IP,
            token_created=datetime.utcnow()
        )
        session.add(user)
        print(f"[INFO] Created new dev user: {USERNAME} with email: {EMAIL}")
    else:
        user.confirmed = True
        user.ip = IP
        print(f"[INFO] Existing user found. Marked as confirmed: {USERNAME}")

    quota = session.get(UserQuota, USERNAME)
    if not quota:
        quota = UserQuota(uid=USERNAME, storage_bytes=0)
        session.add(quota)
        print(f"[INFO] Created quota for user: {USERNAME}")
    session.commit()
    print(f"[INFO] Dev user ready: {USERNAME} ({EMAIL}) — confirmed, IP={IP}")
    print(f"[INFO] To use: set localStorage uid and confirmed_uid to '{USERNAME}' in your browser.")
