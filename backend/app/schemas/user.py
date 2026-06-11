"""
Pydantic schemas for user authentication and user management.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserLogin(BaseModel):
    username: str = Field(..., min_length=1, description="Username to authenticate.")
    password: str = Field(..., min_length=1, description="Password to authenticate.")


class LoginResponse(BaseModel):
    status: str
    token: str
    id: int
    username: str
    email: str
    role: str


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, description="Unique username for the new user.")
    email: EmailStr = Field(..., description="Unique email address for the new user.")
    password: str = Field(..., min_length=8, description="Plain-text password (will be hashed before storage).")


class UserResponse(BaseModel):
    id: int = Field(..., description="Unique identifier for the user.")
    username: str = Field(..., description="Username of the user.")
    email: str = Field(..., description="Email address of the user.")
    role: str = Field(..., description="Role assigned to the user (e.g., 'admin', 'user').")
    created_at: datetime = Field(..., description="Timestamp when the user account was created.")
    updated_at: Optional[datetime] = Field(None, description="Timestamp when the user account was last updated.")

    class Config:
        from_attributes = True

# end of file ./schemas/user.py
