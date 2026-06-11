"""
Represents a user in the system.
Includes fields for username, email, password hash, and timestamps for creation and updates.    

June 08, 2026    
User model for authentication and user management in the application.
This model includes fields for username, email, password hash, and timestamps for creation and updates.
The username and email fields are unique to ensure that each user can be distinctly identified.
The model also includes automatic timestamping for creation and updates, facilitating tracking of user accounts.

"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base


class User(Base):
    """
Represents a user in the system.
    """

    __tablename__ = 'users'

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String,  unique=True, index=True, nullable=False)
    email         = Column(String,  unique=True, nullable=False)
    hashed_password = Column(String,  nullable=False)
    role          = Column(String,  nullable=False, default='admin')  # e.g., 'user', 'admin'
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<User id={self.id} username={self.username!r} email={self.email!r}>"

# end of User model definition






