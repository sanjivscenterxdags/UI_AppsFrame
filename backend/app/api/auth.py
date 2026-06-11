"""
Authentication routes implementing a mock admin session.
"""
from fastapi import APIRouter, HTTPException, status
from app.schemas.user import UserLogin, LoginResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=LoginResponse)
def login(payload: UserLogin):
    """
    Validates username and password. Deferred hashing: checks for admin/admin.
    """
    if payload.username == "admin" and payload.password == "admin":
        return {
            "status": "success",
            "token": "mock-jwt-token-cdags-12345",
            "id": 1,
            "username": "admin",
            "email": "admin@localhost",
            "role": "admin"
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password"
    )

# end of file ./api/auth.py
