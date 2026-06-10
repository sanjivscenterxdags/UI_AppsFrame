"""
SQLAlchemy models representing Expert AI Agents, Sub-Agents, their interactions AND relationships.
This includes the ExpertAgent, SubAgent, and AgentInteraction models, along with their relationships and constraints.

"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Table, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

# -----------------------------------------------------------------------------------------------------
# Step 1: Association table mapping Expert Agents to Specific Sub-Agents
# for the many-to-many relationship between Expert-Agent and Sub-Agent
# One Expert Agent can have multiple Sub-Agents, and one Sub-Agent can belong to multiple Expert Agents.
# -----------------------------------------------------------------------------------------------------

expert_sub_agent_association = Table(
    'expert_sub_agent_mapping',
    Base.metadata,
    Column('expert_agent_id',
           Integer,
           ForeignKey('expert_agents.id', ondelete='CASCADE'), primary_key=True),
    Column('sub_agent_id',
           Integer,
           ForeignKey('sub_agents.id', ondelete='CASCADE'), primary_key=True)
    )

# -----------------------------------------------------------------------------------------------------
# Step 2: Define the ExpertAgent model representing the main AI agents with their attributes and relationships
# -----------------------------------------------------------------------------------------------------
class ExpertAgent(Base):
    """
    Represents an Expert AI Agent in a particular functional domain.

    Each Expert Agent can have multiple Sub-Agents that specialize in specific tasks
        within the domain.

    The model includes attributes for the agent's name, description, timestamps, and a
        relationship to its Sub-Agents.

    The 'name' field is unique to ensure that each Expert Agent can be distinctly identified.

    The relationship to Sub-Agents is defined as a many-to-many relationship using
        the 'expert_sub_agent_association' table, allowing for flexible associations between
        Expert Agents and Sub-Agents.

    The model also includes automatic timestamping for creation and updates, facilitating
        tracking of when agents are created and modified.
    """

    __tablename__ = 'expert_agents'

    id          = Column(Integer, primary_key=True, index=True)
    # Unique name for the Expert Agent
    name        = Column(String,  unique=True, nullable=False)

    # Optional description of the Expert Agent
    description = Column(Text,    nullable=True)

    # HEX color for styling UI representation
    color_theme = Column(String,  nullable=False, default="#1e293b")

    # Flag to indicate if the agent is active or archived
    is_active   = Column(Boolean, default=True)

    # Timestamp of creation
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Timestamp of last update
    updated_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Many-to-Many relationship between Expert Agents and Sub-Agents (Specific Agents Group)
    specific_sub_agents = relationship(
        "SubAgent",
        secondary=expert_sub_agent_association,
        back_populates="associated_experts"
    )

    def __repr__(self):
        return f"<ExpertAgent id={self.id} name={self.name!r} active={self.is_active}>"
# end of ExpertAgent model definition

# -----------------------------------------------------------------------------------------------------
# Step 3: Define the SubAgent model representing specialized agents within an Expert Agent's domain
# -----------------------------------------------------------------------------------------------------
class SubAgent(Base):
    """
    Represents a Sub-Agent that specializes in specific tasks within
        the domain of an Expert Agent.

    Each Sub-Agent can be associated with multiple Expert Agents, allowing for
        flexible specialization across different domains.

    The model includes attributes for the sub-agent's name, description, timestamps,
        and a relationship to its associated Expert Agents.

    The 'name' field is unique to ensure that each Sub-Agent can be distinctly identified.

    The relationship to Expert Agents is defined as a many-to-many relationship using
        the 'expert_sub_agent_association' table, allowing for flexible associations between
        Sub-Agents and Expert Agents.

    The model also includes automatic timestamping for creation and updates, facilitating
        tracking of when sub-agents are created and modified.

    """

    __tablename__ = 'sub_agents'

    id = Column(Integer, primary_key=True, index=True)
    # Unique name for the Sub-Agent
    name = Column(String,  unique=True, nullable=False)
    # Optional description of the Sub-Agent
    description = Column(Text, nullable=True)
    # 'CAG' or 'SAG' to indicate the type of sub-agent (Common or Specialized)
    group_type = Column(String, nullable=False, default="CAG")
    # Timestamp of creation
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Timestamp of last update
    updated_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Back-populated relationship to Expert Agents through the association table
    associated_experts = relationship(
        "ExpertAgent",
        secondary=expert_sub_agent_association,
        back_populates="specific_sub_agents"
    )

    def __repr__(self):
        return f"<SubAgent id={self.id} name={self.name!r} group={self.group_type!r}>"
# end of SubAgent model definition

# -----------------------------------------------------------------------------------------------------
# Step 4: Define the AgentInteraction model representing interactions between Expert Agents and Sub-Agents
# -----------------------------------------------------------------------------------------------------
class AgentInteraction(Base):
    """
    Records an interaction between an ExpertAgent and a SubAgent.

    Each interaction captures the input prompt sent to the sub-agent, the response
        returned, and optional metadata such as duration and token counts.

    The model includes foreign keys to both the ExpertAgent and SubAgent involved,
        along with a timestamp marking when the interaction occurred.
    """

    __tablename__ = 'agent_interactions'

    id             = Column(Integer, primary_key=True, index=True)

    # FK to the Expert Agent that initiated the interaction
    expert_agent_id = Column(Integer, ForeignKey('expert_agents.id', ondelete='CASCADE'), nullable=False)
    # FK to the Sub-Agent that handled the interaction
    sub_agent_id    = Column(Integer, ForeignKey('sub_agents.id',    ondelete='CASCADE'), nullable=False)

    # The prompt/input sent to the sub-agent
    input_prompt   = Column(Text, nullable=False)
    # The response returned by the sub-agent
    output_response = Column(Text, nullable=True)

    # Optional metadata
    duration_ms    = Column(Integer, nullable=True)   # response time in milliseconds
    input_tokens   = Column(Integer, nullable=True)
    output_tokens  = Column(Integer, nullable=True)

    # Timestamp of when the interaction occurred
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships back to the parent models
    expert_agent = relationship("ExpertAgent", backref="interactions")
    sub_agent    = relationship("SubAgent",    backref="interactions")

    def __repr__(self):
        return f"<AgentInteraction id={self.id} expert_agent_id={self.expert_agent_id} sub_agent_id={self.sub_agent_id}>"
# end of AgentInteraction model definition
