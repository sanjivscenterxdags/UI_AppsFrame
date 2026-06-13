from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = 'users'

    id               = Column(Integer,  primary_key=True, index=True)
    username         = Column(String,   unique=True, index=True, nullable=False)
    email            = Column(String,   unique=True, nullable=False)
    hashed_password  = Column(String,   nullable=False)
    role             = Column(String,   nullable=False, default='general-user')
    is_active        = Column(Boolean,  nullable=False, default=True)
    corporate_id     = Column(String,   nullable=True)
    uid              = Column(String,   unique=True, nullable=False, index=True)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                              onupdate=lambda: datetime.now(timezone.utc))

    ea_access = relationship("UserEaAccess", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} username={self.username!r} role={self.role!r}>"


class UserEaAccess(Base):
    """Per-user EA access list — only relevant for general-user role."""
    __tablename__ = 'user_ea_access'

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    expert_agent_id = Column(Integer, ForeignKey('expert_agents.id', ondelete='CASCADE'), nullable=False)

    __table_args__ = (UniqueConstraint('user_id', 'expert_agent_id', name='uq_user_ea'),)

    user = relationship("User", back_populates="ea_access")
