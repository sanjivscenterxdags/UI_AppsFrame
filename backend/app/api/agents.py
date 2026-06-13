"""
API endpoints for managing agents in the system.
API routes for querying and selecting Expert AI Agents 
available in the system. This includes fetching agent details, 
capabilities, and metadata to facilitate informed agent selection by users.   

"""
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.agent import ExpertAgent
from app.schemas.agent import ExpertAgentResponse, AgentSelectResponse
from app.models.log import SystemLog
from app.api.auth import require_jwt

router = APIRouter(prefix="/agents", tags=["Agents"])

@router.get("/", response_model=List[ExpertAgentResponse])
def list_agents(db: Session = Depends(get_db), _token: dict = Depends(require_jwt)):
    """
    Retrieve a list of all available Expert AI Agents marked 'active' with their details.
    """
    return db.query(ExpertAgent).filter(ExpertAgent.is_active == True).all()
    
@router.post("/{agent_id}/select", response_model=AgentSelectResponse)
def select_agent(agent_id: int, db: Session = Depends(get_db), _token: dict = Depends(require_jwt)):
    """
    Endpoint to select an agent by ID. In a real implementation, this would 
    involve session management and state tracking to associate the selected 
    agent with the user's session for subsequent interactions.
    
    Register the selection of an AI agent and log the event for auditing and analytics.    

    """
    agent = db.query(ExpertAgent).filter(ExpertAgent.id == agent_id, ExpertAgent.is_active == True).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with ID {agent_id} not found or inactive."
        )
    
    # Placeholder for session management logic to track selected agent
    # In production, implement proper session handling to maintain user-agent association
    
    # Write select action directly to database logs for simplicity. 
    # In production, consider using a more robust logging mechanism.
    log_entry = SystemLog(
        level="INFO",
        source="USER",
        message=f"Agent '{agent.name}' (ID: {agent.id}) selected by user.",
        metadata_json=json.dumps({"agent_id": agent.id, "name": agent.name})
    )
    db.add(log_entry)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Agent '{agent.name}' selected successfully.",
        "agent_id": agent.id
    }


# end of file