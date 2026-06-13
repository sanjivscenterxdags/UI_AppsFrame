"""
FastAPI Main Application setup and router registration
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine

# Import all models before create_all so SQLAlchemy registers their table metadata
import app.models.user    # noqa: F401
import app.models.agent   # noqa: F401
import app.models.log     # noqa: F401

from app.api import auth, agents, logs, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="CDAGS AI Agent Management API",
    description="Mixture of Experts (MOE) orchestration framework. API for managing and interacting with Expert AI Agents",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend integration; restrict allow_origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers for authentication, agent management, and system logs
app.include_router(auth.router,   prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(logs.router,   prefix="/api")
app.include_router(users.router,  prefix="/api")


# Adding this block to handle the "/" URL
@app.get("/")
def read_root(): 
   return {"status": "success", "message": "Welcome to appsFrame2 API"}
    

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}

