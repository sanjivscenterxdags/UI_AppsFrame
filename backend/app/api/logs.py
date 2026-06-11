"""
API routes for streaming system and user interaction logs.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.log import SystemLog
from app.schemas.log import SystemLogCreate, SystemLogResponse

router = APIRouter(prefix="/logs", tags=["Logs"])

@router.get("/", response_model=List[SystemLogResponse])
def get_logs(limit: int = 50, db: Session = Depends(get_db)):
    """
    Get the most recent log entries ordered chronologically.
    """
    return db.query(SystemLog).order_by(SystemLog.created_at.asc()).limit(limit).all()

@router.post("/", response_model=SystemLogResponse)
def create_log(log: SystemLogCreate, db: Session = Depends(get_db)):
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