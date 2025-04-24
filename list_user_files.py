# list_user_files.py
from fastapi import APIRouter, Depends, HTTPException
from pathlib import Path
from models import User
from database import get_db

router = APIRouter()

@router.get("/user-files/{uid}")
def list_user_files(uid: str, db = Depends(get_db)):
    # Check user exists and is confirmed
    from sqlmodel import select
    user = db.exec(select(User).where((User.username == uid) | (User.email == uid))).first()
    if user is not None and not isinstance(user, User) and hasattr(user, "__getitem__"):
        user = user[0]
    if not user or not user.confirmed:
        raise HTTPException(status_code=403, detail="Account not confirmed")
    user_dir = Path("data") / uid
    if not user_dir.exists() or not user_dir.is_dir():
        return {"files": []}
    files = [f.name for f in user_dir.iterdir() if f.is_file() and not f.name.startswith(".")]
    files.sort()
    return {"files": files}
