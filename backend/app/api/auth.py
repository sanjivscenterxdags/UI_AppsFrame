"""
Authentication routes — DB-backed login with signed HS256 JWT.

Required environment variables (add to .env):
    JWT_SECRET_KEY  — random secret used to sign tokens (e.g. `openssl rand -hex 32`)
    JWT_EXPIRE_MINUTES — optional token lifetime in minutes (default: 60)
"""
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserLogin, LoginResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_JWT_SECRET: str = os.getenv("JWT_SECRET_KEY") or ""
if not _JWT_SECRET:
    raise ValueError("JWT_SECRET_KEY is not set. Add it to your .env file.")

_JWT_ALGORITHM = "HS256"
_JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))


def _create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=_JWT_EXPIRE_MINUTES)
    return jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


@router.post("/login", response_model=LoginResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """
    Look up the user by username, verify bcrypt password, return a signed JWT.
    """
    user: User | None = db.query(User).filter(User.username == payload.username).first()

    if not user or not pwd_context.verify(payload.password, str(user.hashed_password)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = _create_access_token({"sub": str(user.id), "role": user.role})

    return {
        "status": "success",
        "token": token,
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
    }

# end of file
