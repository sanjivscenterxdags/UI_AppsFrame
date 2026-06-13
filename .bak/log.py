from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SystemLogCreate(BaseModel):
    level: str = "INFO"
    source: str = "SYSTEM"
    message: str
    metadata_json: Optional[str] = None

class SystemLogResponse(SystemLogCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
        
# end of file ./schemas/log.py