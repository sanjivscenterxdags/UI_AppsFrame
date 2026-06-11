"""
API routes for Expert Agents, Sub-Agents, and Agent Interactions.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.agent import ExpertAgent, SubAgent, AgentInteraction
from app.schemas.agent import ExpertAgentResponse, SubAgentResponse, AgentInteractionResponse

router = APIRouter(prefix="/agents", tags=["Agents"])

# ---------------------------------------------------------------------------
# Expert Agent routes
# ---------------------------------------------------------------------------

@router.get("/experts", response_model=List[ExpertAgentResponse])
def get_expert_agents(db: Session = Depends(get_db)):
    """Return all Expert Agents with their associated Sub-Agents."""
    return db.query(ExpertAgent).all()

@router.get("/experts/{expert_id}", response_model=ExpertAgentResponse)
def get_expert_agent(expert_id: int, db: Session = Depends(get_db)):
    """Return a single Expert Agent by ID."""
    agent = db.query(ExpertAgent).filter(ExpertAgent.id == expert_id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expert Agent not found")
    return agent

# ---------------------------------------------------------------------------
# Sub-Agent routes
# ---------------------------------------------------------------------------

@router.get("/sub-agents", response_model=List[SubAgentResponse])
def get_sub_agents(db: Session = Depends(get_db)):
    """Return all Sub-Agents."""
    return db.query(SubAgent).all()

@router.get("/sub-agents/{sub_agent_id}", response_model=SubAgentResponse)
def get_sub_agent(sub_agent_id: int, db: Session = Depends(get_db)):
    """Return a single Sub-Agent by ID."""
    agent = db.query(SubAgent).filter(SubAgent.id == sub_agent_id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sub-Agent not found")
    return agent

# ---------------------------------------------------------------------------
# Agent Interaction routes
# ---------------------------------------------------------------------------

@router.get("/interactions", response_model=List[AgentInteractionResponse])
def get_interactions(limit: int = 50, db: Session = Depends(get_db)):
    """Return the most recent Agent Interactions."""
    return db.query(AgentInteraction).order_by(AgentInteraction.created_at.desc()).limit(limit).all()

@router.get("/interactions/{interaction_id}", response_model=AgentInteractionResponse)
def get_interaction(interaction_id: int, db: Session = Depends(get_db)):
    """Return a single Agent Interaction by ID."""
    interaction = db.query(AgentInteraction).filter(AgentInteraction.id == interaction_id).first()
    if not interaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interaction not found")
    return interaction

# end of file ./api/agents.py
