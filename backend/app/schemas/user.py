from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

# ---------------------------------------------------------------------------
# Existing schemas — unchanged (used by auth endpoints)
# ---------------------------------------------------------------------------

class UserLogin(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    status: str
    token: str
    id: int
    username: str
    email: str
    role: str


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Valid role strings (used for validation in the users API)
# ---------------------------------------------------------------------------

VALID_ROLES: frozenset = frozenset({
    "superuser", "operator",
    "admin-data-manager", "admin-asset-register-manager",
    "admin-asset-risk-manager", "admin-change-manager",
    "admin-logging-manager", "admin-siem-manager",
    "admin-reports-manager", "general-user",
    "admin",  # legacy — keep during migration
})


# ---------------------------------------------------------------------------
# User Management schemas (Iteration 3 — used by /api/users/ endpoints)
# ---------------------------------------------------------------------------

class UserCreateAdmin(BaseModel):
    username:     str           = Field(..., min_length=1, description="first_name.last_initial format, lowercase")
    email:        EmailStr
    password:     str           = Field(..., min_length=8)
    role:         str           = Field(..., description="Must be one of the defined VALID_ROLES")
    full_name:    Optional[str] = Field(None, description="Full display name, e.g. Alice Smith")
    corporate_id: Optional[str] = Field(None, description="Alphanumeric external corporate ID")
    is_active:    bool          = Field(True)


class UserListItem(BaseModel):
    id:           int
    uid:          str
    username:     str
    full_name:    Optional[str] = None
    email:        str
    role:         str
    is_active:    bool
    corporate_id: Optional[str]
    created_at:   datetime
    updated_at:   Optional[datetime] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    email:        Optional[EmailStr] = None
    role:         Optional[str]      = None
    full_name:    Optional[str]      = None
    corporate_id: Optional[str]      = None
    is_active:    Optional[bool]     = None


class PasswordReset(BaseModel):
    new_password: str = Field(..., min_length=8)


class EaAccessItem(BaseModel):
    id:              int
    user_id:         int
    expert_agent_id: int

    class Config:
        from_attributes = True


class EaAccessUpdate(BaseModel):
    expert_agent_id: int


# ---------------------------------------------------------------------------
# Iteration 3b — new schemas
# ---------------------------------------------------------------------------

class IamLookupRequest(BaseModel):
    email: EmailStr
