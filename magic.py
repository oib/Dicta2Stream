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
    user = db.exec(select(User).where(User.token == token)).first()

    if not user:
        return RedirectResponse(url="/?error=Invalid%20or%20expired%20token", status_code=302)

    if user.confirmed:
        return RedirectResponse(url="/?error=Token%20already%20used", status_code=302)

    if datetime.utcnow() - user.token_created > timedelta(minutes=15):
        return RedirectResponse(url="/?error=Token%20expired", status_code=302)

    user.confirmed = True
    # record client IP on confirmation
    user.ip = request.client.host
    db.commit()

    return RedirectResponse(url=f"/?login=success&confirmed_uid={user.username}", status_code=302)
