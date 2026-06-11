from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime, timezone
from app.database import Base   


class SystemLog(Base):
    """_summary_
    Represents system events or user interaction logs for monitoring and debugging purposes. 
    Each log entry includes a timestamp, log level (e.g., INFO, WARNING, ERROR), and a message describing the event.

    Args:
        Base (_type_): _description_

    Returns:
        _type_: _description_
    """

    __tablename__ = 'system_logs'
    
    id          = Column(Integer, primary_key=True, index=True)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc) )      
    level       = Column(String, nullable=False, default='INFO') # e.g., INFO, WARNING, ERROR, SUCCESS
    source      = Column(String, nullable=True, default="SYSTEM") # Optional source of the log (e.g., 'AgentManager', 'API', 'Database')
    message     = Column(Text, nullable=False) # Log message content 
    # Optional JSON string for additional structured metadata (e.g., {"agent_id": 123, "user_id": 456}) 
    metadata_json = Column(Text, nullable=True) # Context stored as JSON string 
    

""" 
def __repr__(self):
    return f"<SystemLog(id={self.id}, created_at={self.created_at}, level='{self.level}', source='{self.source}', message='{self.message[:20]}...')>"   
""" 

# end of SystemLog model definition










