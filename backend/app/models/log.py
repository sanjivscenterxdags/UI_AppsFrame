"""
SQLAlchemy model representing system event and interaction logs for monitoring and debugging.
This includes the SystemLog model with structured fields for level, source, message, and metadata.

"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, CheckConstraint
from app.database import Base


# -----------------------------------------------------------------------------------------------------
# Step 1: Define the SystemLog model representing system events and user interaction logs
# -----------------------------------------------------------------------------------------------------
class SystemLog(Base):
    """
    Represents a system event or user interaction log entry for monitoring and debugging.

    Each log entry captures a timestamp, severity level, originating source, a descriptive
        message, and an optional JSON string for additional structured metadata.

    The 'level' field is constrained to valid severity values: DEBUG, INFO, WARNING, ERROR, SUCCESS.

    The 'metadata_json' field can store arbitrary context as a JSON string
        (e.g., '{"agent_id": 123, "user_id": 456}') to associate a log entry with
        specific agents or interactions.
    """

    __tablename__ = 'system_logs'

    __table_args__ = (
        CheckConstraint(
            "level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'SUCCESS')",
            name='ck_system_logs_level'
        ),
    )

    id            = Column(Integer, primary_key=True, index=True)
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Severity level of the log entry
    level         = Column(String, nullable=False, default='INFO')
    # Origin of the log (e.g., 'AgentManager', 'API', 'Database')
    source        = Column(String, nullable=True, default="SYSTEM")
    # Log message content
    message       = Column(Text, nullable=False)
    # Optional JSON string for additional structured metadata (e.g., {"agent_id": 123, "user_id": 456})
    metadata_json = Column(Text, nullable=True)

    def __repr__(self):
        return f"<SystemLog id={self.id} level={self.level!r} source={self.source!r} message={self.message[:20]!r}>"
# end of SystemLog model definition
