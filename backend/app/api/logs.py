"""
API routes for streaming system and user interaction logs.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.log import SystemLog
from app.schemas.log import SystemLogCreate, SystemLogResponse
from app.api.auth import require_jwt

router = APIRouter(prefix="/logs", tags=["Logs"])

@router.get("/", response_model=List[SystemLogResponse])
def get_logs(limit: int = Query(50, ge=1, le=500), db: Session = Depends(get_db), _token: dict = Depends(require_jwt)):
    """
    Get the most recent log entries, newest first. Max 500 per request.
    """
    return db.query(SystemLog).order_by(SystemLog.created_at.desc()).limit(limit).all()

@router.post("/", response_model=SystemLogResponse)
def create_log(log: SystemLogCreate, db: Session = Depends(get_db), _token: dict = Depends(require_jwt)):
    """
    Add a manual log entry from the frontend client.
    """
    db_log = SystemLog(
        level=log.level,
        source=log.source,
        message=log.message,
        metadata_json=log.metadata_json
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log 

# end of file