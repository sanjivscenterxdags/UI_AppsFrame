import io
import os
import uuid
from typing import List

import openpyxl
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserEaAccess
from app.models.agent import ExpertAgent
from app.schemas.user import (
    UserCreateAdmin, UserListItem, UserUpdate,
    PasswordReset, EaAccessItem, EaAccessUpdate, VALID_ROLES,
    IamLookupRequest,
)
from app.api.auth import require_jwt, pwd_context

router = APIRouter(prefix="/users", tags=["Users"])


def require_superuser(payload: dict = Depends(require_jwt)) -> dict:
    """Restricts endpoint access to superuser and admin (legacy) roles."""
    if payload.get("role") not in ("superuser", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser role required",
        )
    return payload


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[UserListItem])
def list_users(db: Session = Depends(get_db), _token: dict = Depends(require_superuser)):
    return db.query(User).order_by(User.username).all()


@router.post("/", response_model=UserListItem, status_code=201)
def create_user(payload: UserCreateAdmin, db: Session = Depends(get_db),
                _token: dict = Depends(require_superuser)):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{payload.role}'")
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    if db.query(User).filter_by(email=str(payload.email)).first():
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        username=payload.username,
        email=str(payload.email),
        hashed_password=pwd_context.hash(payload.password),
        role=payload.role,
        full_name=payload.full_name,
        corporate_id=payload.corporate_id,
        is_active=payload.is_active,
        uid=uuid.uuid4().hex[:8],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserListItem)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db),
                _token: dict = Depends(require_superuser)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.role is not None and payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{payload.role}'")

    update_data = payload.model_dump(exclude_none=True)
    if "email" in update_data:
        update_data["email"] = str(update_data["email"])
    for field, value in update_data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", response_model=UserListItem)
def reset_password(user_id: int, payload: PasswordReset, db: Session = Depends(get_db),
                   _token: dict = Depends(require_superuser)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = pwd_context.hash(payload.new_password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db),
                _token: dict = Depends(require_superuser)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


# ---------------------------------------------------------------------------
# EA access list (general-user role only — but enforced in frontend)
# ---------------------------------------------------------------------------

@router.get("/{user_id}/ea-access", response_model=List[EaAccessItem])
def get_ea_access(user_id: int, db: Session = Depends(get_db),
                  _token: dict = Depends(require_superuser)):
    if not db.query(User).filter_by(id=user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    return db.query(UserEaAccess).filter_by(user_id=user_id).all()


@router.post("/{user_id}/ea-access", response_model=EaAccessItem, status_code=201)
def add_ea_access(user_id: int, payload: EaAccessUpdate, db: Session = Depends(get_db),
                  _token: dict = Depends(require_superuser)):
    if not db.query(User).filter_by(id=user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    if not db.query(ExpertAgent).filter_by(id=payload.expert_agent_id).first():
        raise HTTPException(status_code=404, detail="Expert Agent not found")
    if db.query(UserEaAccess).filter_by(user_id=user_id,
                                         expert_agent_id=payload.expert_agent_id).first():
        raise HTTPException(status_code=409, detail="EA access entry already exists")

    entry = UserEaAccess(user_id=user_id, expert_agent_id=payload.expert_agent_id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{user_id}/ea-access/{expert_agent_id}", status_code=204)
def remove_ea_access(user_id: int, expert_agent_id: int, db: Session = Depends(get_db),
                     _token: dict = Depends(require_superuser)):
    entry = db.query(UserEaAccess).filter_by(
        user_id=user_id, expert_agent_id=expert_agent_id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="EA access entry not found")
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Iteration 3b — Excel export
# ---------------------------------------------------------------------------

@router.post("/export")
def export_users_excel(db: Session = Depends(get_db),
                       _token: dict = Depends(require_superuser)):
    """Generate an in-memory Excel workbook of the full user roster and stream it."""
    users = db.query(User).order_by(User.username).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CDAGS Users"

    headers = ["UID", "Username", "Full Name", "Email", "Role",
               "Corporate ID", "Active", "Created At"]
    ws.append(headers)

    for u in users:
        ws.append([
            u.uid,
            u.username,
            u.full_name or "",
            u.email,
            u.role,
            u.corporate_id or "",
            "Yes" if u.is_active else "No",
            u.created_at.strftime("%Y-%m-%d") if u.created_at else "",
        ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=cdags_users.xlsx"},
    )


# ---------------------------------------------------------------------------
# Iteration 3b — IAM lookup (FreeIPA / Keycloak LDAP)
# ---------------------------------------------------------------------------

@router.post("/iam-lookup")
def iam_lookup(payload: IamLookupRequest,
               _token: dict = Depends(require_superuser)):
    """Query FreeIPA / Keycloak LDAP for corporate_id by corporate email address."""
    iam_url  = os.getenv("IAM_LDAP_URL")
    iam_dn   = os.getenv("IAM_BIND_DN")
    iam_pass = os.getenv("IAM_BIND_PASSWORD")
    iam_base = os.getenv("IAM_SEARCH_BASE")

    if not all([iam_url, iam_dn, iam_pass, iam_base]):
        raise HTTPException(
            status_code=503,
            detail="IAM integration not configured — set IAM_LDAP_URL, IAM_BIND_DN, IAM_BIND_PASSWORD, IAM_SEARCH_BASE in .env",
        )

    try:
        from ldap3 import Server, Connection, ALL
        server = Server(iam_url, get_info=ALL)
        conn = Connection(server, iam_dn, iam_pass, auto_bind=True)
        conn.search(
            iam_base,
            f"(mail={str(payload.email)})",
            attributes=["employeeNumber", "uid", "cn"],
        )
        if not conn.entries:
            raise HTTPException(status_code=404, detail="No IAM entry found for this email")

        entry = conn.entries[0]
        # Prefer employeeNumber; fall back to uid attribute; then empty string
        corp_id = ""
        if entry.employeeNumber and entry.employeeNumber.value:
            corp_id = str(entry.employeeNumber.value)
        elif entry.uid and entry.uid.value:
            corp_id = str(entry.uid.value)

        display = str(entry.cn.value) if entry.cn and entry.cn.value else ""
        return {"corporate_id": corp_id, "display_name": display}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"IAM query failed: {str(exc)}")
