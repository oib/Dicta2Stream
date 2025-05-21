# magic.py — handle magic token login confirmation

from fastapi import APIRouter, Form, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from database import get_db
from models import User
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/magic-login")
def magic_login(request: Request, db: Session = Depends(get_db), token: str = Form(...)):
    print(f"[magic-login] Received token: {token}")
    user = db.exec(select(User).where(User.token == token)).first()
    print(f"[magic-login] User lookup: {'found' if user else 'not found'}")

    if not user:
        print("[magic-login] Invalid or expired token")
        return RedirectResponse(url="/?error=Invalid%20or%20expired%20token", status_code=302)

    if datetime.utcnow() - user.token_created > timedelta(minutes=30):
        print(f"[magic-login] Token expired for user: {user.username}")
        return RedirectResponse(url="/?error=Token%20expired", status_code=302)

    if not user.confirmed:
        user.confirmed = True
        user.ip = request.client.host
        db.commit()
        print(f"[magic-login] User {user.username} confirmed. Redirecting to /?login=success&confirmed_uid={user.username}")
    else:
        print(f"[magic-login] Token already used for user: {user.username}, but allowing multi-use login.")

    return RedirectResponse(url=f"/?login=success&confirmed_uid={user.username}", status_code=302)
