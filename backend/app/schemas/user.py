from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UserLogin(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    status: str
    token: str
    id: int
    username: str
    email: str
    role: str

class UserCreate(BaseModel):
    username: str = Field(..., description="Unique username for the new user.")
    email: str = Field(..., description="Unique email address for the new user.")
    password: str = Field(..., description="Plain-text password (will be hashed before storage).")

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
