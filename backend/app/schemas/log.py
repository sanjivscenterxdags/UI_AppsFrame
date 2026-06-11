"""
Pydantic schemas for system log creation and retrieval.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal, Optional

# Valid severity levels must match the DB CheckConstraint in models/log.py
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "SUCCESS"]


class SystemLogCreate(BaseModel):
    level: LogLevel = Field("INFO", description="Severity level of the log entry.")
    source: str = Field("SYSTEM", description="Origin of the log entry.")
    message: str = Field(..., min_length=1, description="Log message content.")
    metadata_json: Optional[str] = Field(None, description="Optional JSON string for structured metadata.")


class SystemLogResponse(BaseModel):
    id: int = Field(..., description="Unique identifier for the log entry.")
    created_at: datetime = Field(..., description="Timestamp when the log entry was created.")
    level: LogLevel = Field(..., description="Severity level of the log entry.")
    source: str = Field(..., description="Origin of the log entry.")
    message: str = Field(..., description="Log message content.")
    metadata_json: Optional[str] = Field(None, description="Optional JSON string for structured metadata.")

    class Config:
        from_attributes = True

# end of file ./schemas/log.py
