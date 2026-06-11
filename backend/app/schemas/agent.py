"""
June 10, 2026

"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SubAgentResponse(BaseModel):
    """
    Represents a Sub-Agent record returned from the database.
    """

    id: int = Field(..., description="Unique identifier for the Sub-Agent.")
    name: str = Field(..., description="Name of the Sub-Agent.")
    description: Optional[str] = Field(None, description="Optional description of the Sub-Agent.")
    group_type: str = Field(..., description="Group type of the Sub-Agent (e.g., 'CAG' or 'SAG').")
    created_at: datetime = Field(..., description="Timestamp when the Sub-Agent was created.")
    updated_at: Optional[datetime] = Field(None, description="Timestamp when the Sub-Agent was last updated.")

    class Config:
        from_attributes = True

class ExpertAgentResponse(BaseModel):
    """
    Represents an Expert Agent record returned from the database,
    including its associated Sub-Agents.
    """

    id: int = Field(..., description="Unique identifier for the Expert Agent.")
    name: str = Field(..., description="Name of the Expert Agent.")
    description: Optional[str] = Field(None, description="Optional description of the Expert Agent.")
    color_theme: Optional[str] = Field(None, description="Optional HEX color theme for UI representation.")
    is_active: bool = Field(..., description="Indicates whether the Expert Agent is currently active.")
    created_at: datetime = Field(..., description="Timestamp when the Expert Agent was created.")
    updated_at: Optional[datetime] = Field(None, description="Timestamp when the Expert Agent was last updated.")
    specific_sub_agents: List[SubAgentResponse] = Field(default_factory=list, description="Sub-Agents associated with this Expert Agent.")

    class Config:
        from_attributes = True

class AgentInteractionResponse(BaseModel):
    """
    Represents an interaction between an Expert Agent and a Sub-Agent.
    """

    id: int = Field(..., description="Unique identifier for the interaction.")
    expert_agent_id: int = Field(..., description="ID of the Expert Agent that initiated the interaction.")
    sub_agent_id: int = Field(..., description="ID of the Sub-Agent that handled the interaction.")
    input_prompt: str = Field(..., description="The prompt/input sent to the Sub-Agent.")
    output_response: Optional[str] = Field(None, description="The response returned by the Sub-Agent.")
    duration_ms: Optional[int] = Field(None, description="Time taken to generate the response in milliseconds.")
    input_tokens: Optional[int] = Field(None, description="Number of tokens in the input prompt.")
    output_tokens: Optional[int] = Field(None, description="Number of tokens in the output response.")
    created_at: datetime = Field(..., description="Timestamp when the interaction occurred.")

    class Config:
        from_attributes = True

# end of file ./schemas/agent.py
