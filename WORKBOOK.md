# CDAGS AI-Agent Framework: Iteration 1 Workbook

Welcome to the **CDAGS AI-Agent Application Framework Workbook**. This document is a hands-on, step-by-step tutorial for building Iteration 1 of the framework. You will follow along, create directories, write files, and learn the architectural concepts behind each piece.

By the end of this workbook, you will have built:
1. A FastAPI backend running a mock-authenticated SQLite database and logging engine.
2. A React + TypeScript frontend running on Vite (port `6173`) using Vanilla CSS variables for light/dark mode and professional styling.
3. An interactive layout linking grid tile selections to sidebar highlights and real-time scrolling console logs.

---

## Table of Contents
1. [Prerequisites & Workspace Preparation](#chapter-1-prerequisites--workspace-preparation)
2. [Backend Architecture & Database Setup](#chapter-2-backend-architecture--database-setup)
3. [FastAPI Endpoints & Routing](#chapter-3-fastapi-endpoints--routing)
4. [Frontend Project Initialisation](#chapter-4-frontend-project-initialisation)
5. [Vanilla CSS Styling & Theme Engine](#chapter-5-vanilla-css-styling--theme-engine)
6. [Task 1: Creating the Auth Shell](#chapter-6-task-1-creating-the-auth-shell)
7. [Task 2 & 4: Sidebar Layout & Interactive Highlighting](#chapter-7-task-2--4-sidebar-layout--interactive-highlighting)
8. [Task 3: Styling the Expert Agent Tiles](#chapter-8-task-3-styling-the-expert-agent-tiles)
9. [Task 4: Implementing the System Log Panel](#chapter-9-task-4-implementing-the-system-log-panel)
10. [Running & Verifying the Application](#chapter-10-running--verifying-the-application)

---

## Chapter 1: Prerequisites & Workspace Preparation

Before writing code, let's understand the tools we are using:
* **FastAPI**: A modern, high-performance web framework for building APIs with Python. It automatically generates interactive Swagger documentation and utilizes Pydantic for validation.
* **SQLAlchemy**: An Object-Relational Mapper (ORM) that lets us interact with our SQLite database using Python classes (models) instead of writing raw SQL.
* **Vite**: A fast frontend build tool that compiles TypeScript, manages hot module replacement, and serves our React app.

### Step 1.1: Verify Python & Node.js
Open your terminal and run the following commands to verify your environment:
```bash
python3 --version  # Should be 3.11 or higher
node --version     # Should be 20 or higher
```

### Step 1.2: Check Directory Structure
Ensure you have `backend` and `frontend` folders in the root of your workspace:
```
appsFrame/
├── backend/
├── frontend/
├── requirements.txt
└── SPEC.md
```

---

## Chapter 2: Backend Architecture & Database Setup

In this chapter, we will initialize the Python virtual environment, set up the SQLite database, and configure our SQLAlchemy models.

### Step 2.1: Initialize the Python Environment
Run these commands in your terminal to set up a clean Python virtual environment:
```bash
# 1. Create the virtual environment in the .venv folder
python3 -m venv .venv

# 2. Activate the virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate

# 3. Upgrade pip and install requirements
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 2.2: Create the Backend Folders
Create the directory structure for your FastAPI app:
```bash
mkdir -p backend/app/models backend/app/schemas backend/app/api backend/app/services
touch backend/app/__init__.py
```

### Step 2.3: Configure Database Connection
Create `backend/app/database.py`. This file initializes the SQLAlchemy engine, configures SQLite to support multi-threaded access safely, and defines a session dependency `get_db()` that will manage connections for our API requests.

**Type this code into `backend/app/database.py`:**
```python
"""
Database connection setup and session management using SQLAlchemy.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Define SQLite database file location
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cdags_framework.db")

# Create engine. 'check_same_thread=False' is required for SQLite in multi-threaded FastAPI
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for database models
Base = declarative_base()

def get_db():
    """
    Dependency generator yielding a database session.
    Guarantees the connection is closed after a request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### Step 2.4: Create SQLAlchemy Models
Next, we define our database tables. Create `backend/app/models/agent.py` to store our Expert Agents, Sub-Agents, and their association table.

**Type this code into `backend/app/models/agent.py`:**
```python
"""
SQLAlchemy models representing Expert AI Agents, Sub-Agents, and relationships.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Table, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

# Association table mapping Expert Agents to Specific Sub-Agents (SAG)
expert_sub_agent_association = Table(
    "expert_sub_agent_mapping",
    Base.metadata,
    Column("expert_agent_id", Integer, ForeignKey("expert_agents.id", ondelete="CASCADE"), primary_key=True),
    Column("sub_agent_id", Integer, ForeignKey("sub_agents.id", ondelete="CASCADE"), primary_key=True)
)

class ExpertAgent(Base):
    """
    Represents an Expert level AI Agent in a particular functional domain.
    """
    __tablename__ = "expert_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code_name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    color_theme = Column(String, nullable=False, default="#1e293b")  # HEX color for styling
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Many-to-many relationship with sub-agents in SAG
    specific_sub_agents = relationship(
        "SubAgent",
        secondary=expert_sub_agent_association,
        back_populates="associated_experts"
    )

class SubAgent(Base):
    """
    Represents a utility Sub-Agent (either Common CAG or Specific SAG).
    """
    __tablename__ = "sub_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code_name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    group_type = Column(String, nullable=False, default="CAG")  # "CAG" or "SAG"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Back-reference mapping
    associated_experts = relationship(
        "ExpertAgent",
        secondary=expert_sub_agent_association,
        back_populates="specific_sub_agents"
    )
```

Create `backend/app/models/log.py` to record UI interaction events:
**Type this code into `backend/app/models/log.py`:**
```python
from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.database import Base

class SystemLog(Base):
    """
    Represents system events or user interaction logs.
    """
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    level = Column(String, default="INFO")       # INFO, WARNING, ERROR, SUCCESS
    source = Column(String, default="SYSTEM")     # SYSTEM, USER, AGENT
    message = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)  # Context stored as JSON string
```

Create `backend/app/models/user.py` for authentication:
**Type this code into `backend/app/models/user.py`:**
```python
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.database import Base

class User(Base):
    """
    Represents a user account in the system database.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="admin")
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## Chapter 3: FastAPI Endpoints & Routing

Now we will create the backend schemas (Pydantic validation), API endpoints, and a database seeding script.

### Step 3.1: Create Pydantic Schemas
Pydantic schemas validate the data coming *into* the API and structure the JSON data returning *out* of the API.
Create `backend/app/schemas/agent.py`:
```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class SubAgentResponse(BaseModel):
    id: int
    name: str
    code_name: str
    description: Optional[str] = None
    group_type: str
    created_at: datetime

    class Config:
        from_attributes = True

class ExpertAgentResponse(BaseModel):
    id: int
    name: str
    code_name: str
    description: Optional[str] = None
    color_theme: str
    is_active: bool
    created_at: datetime
    specific_sub_agents: List[SubAgentResponse] = []

    class Config:
        from_attributes = True
```

Create `backend/app/schemas/log.py`:
```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SystemLogCreate(BaseModel):
    level: str = "INFO"
    source: str = "SYSTEM"
    message: str
    metadata_json: Optional[str] = None

class SystemLogResponse(SystemLogCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True
```

Create `backend/app/schemas/user.py`:
```python
from pydantic import BaseModel

class UserLogin(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    status: str
    token: str
    username: str
    role: str
```

### Step 3.2: Implement API Routers
We will write three route files to manage API operations.

Create `backend/app/api/auth.py`:
```python
"""
Authentication routes implementing a mock admin session.
"""
from fastapi import APIRouter, HTTPException, status
from app.schemas.user import UserLogin, LoginResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=LoginResponse)
def login(payload: UserLogin):
    """
    Validates username and password. Deferred hashing: checks for admin/admin.
    """
    if payload.username == "admin" and payload.password == "admin":
        return {
            "status": "success",
            "token": "mock-jwt-token-cdags-12345",
            "username": "admin",
            "role": "admin"
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password"
    )
```

Create `backend/app/api/agents.py`:
```python
"""
API routes for querying and selecting Expert AI Agents.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.agent import ExpertAgent
from app.models.log import SystemLog
from app.schemas.agent import ExpertAgentResponse
from datetime import datetime

router = APIRouter(prefix="/agents", tags=["Agents"])

@router.get("/", response_model=List[ExpertAgentResponse])
def list_agents(db: Session = Depends(get_db)):
    """
    Retrieve all expert agents currently marked active.
    """
    return db.query(ExpertAgent).filter(ExpertAgent.is_active == True).all()

@router.post("/{agent_id}/select")
def select_agent(agent_id: int, db: Session = Depends(get_db)):
    """
    Register the selection of an AI agent and log the event.
    """
    agent = db.query(ExpertAgent).filter(ExpertAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    # Write select action directly to database logs
    log_entry = SystemLog(
        timestamp=datetime.utcnow(),
        level="INFO",
        source="USER",
        message=f"AI Agent '{agent.name}' has been selected.",
        metadata_json=f'{{"agent_id": {agent.id}, "code_name": "{agent.code_name}"}}'
    )
    db.add(log_entry)
    db.commit()
    return {"status": "success", "message": f"AI Agent '{agent.name}' selected."}
```

Create `backend/app/api/logs.py`:
```python
"""
API routes for streaming system and user interaction logs.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.log import SystemLog
from app.schemas.log import SystemLogCreate, SystemLogResponse

router = APIRouter(prefix="/logs", tags=["Logs"])

@router.get("/", response_model=List[SystemLogResponse])
def get_logs(limit: int = 50, db: Session = Depends(get_db)):
    """
    Get the most recent log entries ordered chronologically.
    """
    return db.query(SystemLog).order_by(SystemLog.timestamp.asc()).limit(limit).all()

@router.post("/", response_model=SystemLogResponse)
def create_log(log: SystemLogCreate, db: Session = Depends(get_db)):
    """
    Add a manual log entry from the frontend client.
    """
    db_log = SystemLog(
        level=log.level,
        source=log.source,
        message=log.message,
        metadata_json=log.metadata_json
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log
```

### Step 3.3: Assemble FastAPI App
We combine the database initialization, routing, and CORS middleware into `backend/app/main.py`.

**Type this code into `backend/app/main.py`:**
```python
"""
FastAPI Main Application setup and router registration.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.api import auth, agents, logs

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CDAGS AI-Agent Application Framework",
    description="Mixture of Experts (MOE) orchestration shell.",
    version="1.0.0"
)

# Enable CORS for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(logs.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "CDAGS AI Framework Backend API Running"}
```

### Step 3.4: Seed Mock Data
Let's build a script to populate the SQLite database with the 8 Expert Agents from Task 2.
Create `backend/seed.py`:

**Type this code into `backend/seed.py`:**
```python
"""
Seed script to pre-populate database tables with Iteration 1 Expert Agents.
"""
from app.database import SessionLocal, Base, engine
from app.models.agent import ExpertAgent, SubAgent
from app.models.log import SystemLog
from app.models.user import User

def seed_database():
    # Clear and recreate tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Create default admin user
        admin = User(username="admin", hashed_password="admin", role="admin")
        db.add(admin)

        # 2. Define common business color palette
        colors = [
            "#334155",  # Slate Grey
            "#1e3a8a",  # Navy Blue
            "#0f766e",  # Deep Teal
            "#15803d",  # Forest Green
            "#991b1b",  # Deep Crimson
            "#b45309",  # Dark Gold/Amber
            "#4338ca",  # Purple/Indigo
            "#0369a1"   # Steel Blue
        ]

        # 3. Define Expert Agent list
        agent_names = [
            "UI Color Palate Manager",
            "OT Plant Data Manager",
            "OT Plant Asset Register Manager",
            "OT Plant Asset Risk Register Manager",
            "OT Plant Change Management Manager",
            "OT Plant Logging & Monitoring Manager",
            "OT Plant Security Incident Manager",
            "OT Plant Analytics & Report Manager"
        ]

        # 4. Insert Expert Agents
        for i, name in enumerate(agent_names):
            code_name = name.lower().replace(" ", "_").replace("&", "and")
            agent = ExpertAgent(
                name=name,
                code_name=code_name,
                description=f"Domain expert for handling {name.replace(' Manager', '')}.",
                color_theme=colors[i],
                is_active=True
            )
            db.add(agent)

        # 5. Insert initial system initialization log
        initial_log = SystemLog(
            level="SUCCESS",
            source="SYSTEM",
            message="CDAGS AI Agent Application Framework initialized."
        )
        db.add(initial_log)

        db.commit()
        print("Database seeded successfully with 8 Expert Agents!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
```
Run `python seed.py` in your terminal to initialize the database:
```bash
cd backend
python seed.py
```

---

## Chapter 4: Frontend Project Initialisation

In this chapter, we initialize the React + TypeScript + Vite workspace and install basic node dependencies.

### Step 4.1: Initialise Vite Project
Navigate to the root of the workspace and run the Vite installer. We use the custom `--help` rules in non-interactive mode:
```bash
# From workspace root:
npm create vite@latest frontend -- --template react-ts
```

### Step 4.2: Edit Package Dependencies
Replace `frontend/package.json` with the following configuration:
```json
{
  "name": "cdags-ai-framework",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.2.2",
    "vite": "^5.3.1"
  }
}
```
Run installation:
```bash
cd frontend
npm install
```

### Step 4.3: Configure Vite Server Port
Modify `frontend/vite.config.ts` to bind development execution specifically to port **`6173`**:

**Type this code into `frontend/vite.config.ts`:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6173,      // Run server on port 6173
    strictPort: true // Fail if port is occupied
  }
});
```

---

## Chapter 5: Vanilla CSS Styling & Theme Engine

We will build the layout from the ground up using **Vanilla CSS variables** (Design tokens) to support seamless **Light and Dark mode** transitions.

### Step 5.1: Create CSS Folders & Files
Create the styles structure in your React source:
```bash
mkdir -p src/styles src/components src/context src/types
touch src/styles/variables.css src/styles/global.css src/styles/layouts.css src/styles/components.css src/styles/themes.css
```

### Step 5.2: Write Style Tokens (`variables.css`)
Type this variables definition containing fonts, borders, grid sizes, and colors for light/dark themes.

**Type this code into `src/styles/variables.css`:**
```css
:root {
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --border-radius-lg: 12px;
  --border-radius-md: 8px;
  --border-radius-sm: 4px;
  --border-width-thick: 3px;
  --transition-speed: 0.25s;
  
  --banner-height: 70px;
  --footer-height: 30px;
  --log-panel-height: 20vh;
}

body.light-theme {
  --bg-primary: #f8fafc;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f1f5f9;
  
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #64748b;
  
  --border-color: #cbd5e1;
  --border-color-dark: #475569;
  --shadow-color: rgba(15, 23, 42, 0.08);
  
  --active-highlight: #3b82f6;
  --active-highlight-bg: #eff6ff;
  
  --log-bg: #0f172a;
  --log-text: #f8fafc;
  --log-time: #38bdf8;
  --log-info: #34d399;
}

body.dark-theme {
  --bg-primary: #0b0f19;
  --bg-secondary: #121824;
  --bg-tertiary: #1e293b;
  
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-tertiary: #94a3b8;
  
  --border-color: #334155;
  --border-color-dark: #94a3b8;
  --shadow-color: rgba(0, 0, 0, 0.4);
  
  --active-highlight: #3b82f6;
  --active-highlight-bg: rgba(59, 130, 246, 0.15);
  
  --log-bg: #05070a;
  --log-text: #e2e8f0;
  --log-time: #7dd3fc;
  --log-info: #4ade80;
}
```

### Step 5.3: Write Layout CSS (`layouts.css`)
Configure the CSS Grid mapping the layout zones.

**Type this code into `src/styles/layouts.css`:**
```css
.app-container {
  display: grid;
  grid-template-rows: var(--banner-height) 1fr var(--log-panel-height) var(--footer-height);
  grid-template-columns: 280px 1fr;
  grid-template-areas:
    "banner banner"
    "sidebar main"
    "logs logs"
    "footer footer";
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-family);
  transition: background-color var(--transition-speed), color var(--transition-speed);
}

.banner {
  grid-area: banner;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 2px 4px var(--shadow-color);
}

.sidebar {
  grid-area: sidebar;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: 20px 16px;
  overflow-y: auto;
}

.main-content {
  grid-area: main;
  padding: 24px;
  overflow-y: auto;
  background-color: var(--bg-primary);
}

.log-panel {
  grid-area: logs;
  background-color: var(--log-bg);
  border-top: 2px solid var(--border-color);
  color: var(--log-text);
  padding: 16px 24px;
  overflow-y: auto;
  font-family: monospace;
}

.footer {
  grid-area: footer;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-tertiary);
}
```

### Step 5.4: Write Component Styling CSS (`components.css`)
Add styles for login cards, forms, grid items, and hover effects.

**Type this code into `src/styles/components.css`:**
```css
/* Login Page Layout */
.login-overlay {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background-color: var(--bg-primary);
}

.login-card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: 40px;
  width: 380px;
  box-shadow: 0 10px 25px var(--shadow-color);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.login-title {
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  color: var(--text-secondary);
}

.form-input {
  padding: 10px 12px;
  border-radius: var(--border-radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  font-size: 14px;
}

.form-input:focus {
  border-color: var(--active-highlight);
}

.login-btn {
  padding: 12px;
  background-color: var(--active-highlight);
  color: white;
  font-weight: 600;
  border-radius: var(--border-radius-md);
  border: none;
  cursor: pointer;
  margin-top: 8px;
}

/* Sidebar List */
.sidebar-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-item {
  padding: 12px;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all var(--transition-speed);
}

.sidebar-item.active {
  color: var(--active-highlight);
  background-color: var(--active-highlight-bg);
  font-weight: 600;
}

/* Agent Grid */
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.agent-tile {
  background-color: var(--bg-secondary);
  border-radius: var(--border-radius-lg);
  padding: 30px 20px;
  cursor: pointer;
  transition: transform var(--transition-speed), box-shadow var(--transition-speed);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 120px;
  text-align: center;
}

.agent-tile:hover {
  transform: translateY(-4px);
}

.agent-tile-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}

/* Theme Toggle Button */
.theme-toggle {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 18px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

### Step 5.5: Connect CSS Styles
Import the stylesheets into `src/styles/global.css`:
```css
@import './variables.css';
@import './layouts.css';
@import './components.css';

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}
```

---

## Chapter 6: Task 1: Creating the Auth Shell

We will establish our global Context states to handle authentication and theme switching.

### Step 6.1: Define TypeScript Types
Create `src/types/index.ts` to manage type safety:
```typescript
export interface UserSession {
  token: string;
  username: string;
  role: string;
}

export interface ExpertAgent {
  id: number;
  name: string;
  code_name: string;
  description?: string;
  color_theme: string;
  is_active: boolean;
}

export interface SystemLog {
  id: number;
  timestamp: string;
  level: string;
  source: string;
  message: string;
}
```

### Step 6.2: Create Theme Context
Create `src/context/ThemeContext.tsx` to handle light/dark mode operations.

**Type this code into `src/context/ThemeContext.tsx`:**
```typescript
import React, { createContext, useState, useEffect, useContext } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.className = `${theme}-theme`;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
```

### Step 6.3: Create Auth Context
Create `src/context/AuthContext.tsx` to hold mock credentials.

**Type this code into `src/context/AuthContext.tsx`:**
```typescript
import React, { createContext, useState, useContext } from 'react';
import { UserSession } from '../types';

interface AuthContextType {
  session: UserSession | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(() => {
    const stored = localStorage.getItem('session');
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) return false;
      const data = await response.json();
      
      const userSession: UserSession = {
        token: data.token,
        username: data.username,
        role: data.role
      };
      
      setSession(userSession);
      localStorage.setItem('session', JSON.stringify(userSession));
      return true;
    } catch (e) {
      console.error("Login failed: ", e);
      return false;
    }
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem('session');
  };

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

### Step 6.4: Implement Login Form Component
Create `src/components/LoginForm.tsx`:

**Type this code into `src/components/LoginForm.tsx`:**
```typescript
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const success = await login(username, password);
    if (!success) {
      setError('Invalid username or password (default: admin/admin)');
    }
  };

  return (
    <div className="login-overlay">
      <form className="login-card" onSubmit={handleSubmit}>
        <div>
          <h2 className="login-title">CDAGS Portal</h2>
          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Enter default credentials to access the AI Framework
          </p>
        </div>
        
        {error && (
          <div style={{ color: 'var(--text-primary)', backgroundColor: '#fecaca', padding: '10px', borderRadius: '4px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label>Username</label>
          <input 
            type="text" 
            className="form-input" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input 
            type="password" 
            className="form-input" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="login-btn">Log In</button>
      </form>
    </div>
  );
};
```

---

## Chapter 7: Task 2 & 4: Sidebar Layout & Interactive Highlighting

We will build the Layout components and link state selection events between the sidebar and grid items.

### Step 7.1: Setup Agent Context
Create `src/context/AgentContext.tsx` to handle selected active agents.

**Type this code into `src/context/AgentContext.tsx`:**
```typescript
import React, { createContext, useState, useEffect, useContext } from 'react';
import { ExpertAgent, SystemLog } from '../types';

interface AgentContextType {
  agents: ExpertAgent[];
  activeAgentId: number | null;
  logs: SystemLog[];
  selectAgent: (agentId: number) => Promise<void>;
  fetchLogs: () => Promise<void>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agents, setAgents] = useState<ExpertAgent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<number | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  // 1. Fetch Expert Agents from backend SQLite
  useEffect(() => {
    fetch('http://localhost:8000/api/agents/')
      .then(res => res.json())
      .then(data => setAgents(data))
      .catch(err => console.error("Error loading agents: ", err));
  }, []);

  // 2. Fetch logs
  const fetchLogs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/logs/');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error("Error loading logs: ", e);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Poll logs every 2 seconds to keep bottom window updated
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  // 3. Post select update to backend and refresh local state
  const selectAgent = async (agentId: number) => {
    setActiveAgentId(agentId);
    try {
      await fetch(`http://localhost:8000/api/agents/${agentId}/select`, {
        method: 'POST'
      });
      // Fetch fresh logs immediately to show selection in bottom window
      await fetchLogs();
    } catch (e) {
      console.error("Error selecting agent: ", e);
    }
  };

  return (
    <AgentContext.Provider value={{ agents, activeAgentId, logs, selectAgent, fetchLogs }}>
      {children}
    </AgentContext.Provider>
  );
};

export const useAgents = () => {
  const context = useContext(AgentContext);
  if (!context) throw new Error('useAgents must be used within AgentProvider');
  return context;
};
```

### Step 7.2: Create Banner & Sidebar Components
Create `src/components/Banner.tsx`:
**Type this code into `src/components/Banner.tsx`:**
```typescript
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const Banner: React.FC = () => {
  const { session, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [dateTime, setDateTime] = useState(new Date());

  // Keep clock running live in banner
  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  return (
    <header className="banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: 'var(--active-highlight)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>C</div>
        <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '0.5px' }}>
          CDAGS AI Framework
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          User: <strong>{session?.username}</strong>
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
          {formatDate(dateTime)}
        </span>
        <button onClick={toggleTheme} className="theme-toggle" title="Toggle Theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button 
          onClick={logout}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--active-highlight)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
};
```

Create `src/components/Sidebar.tsx`:
**Type this code into `src/components/Sidebar.tsx`:**
```typescript
import React from 'react';
import { useAgents } from '../context/AgentContext';

export const Sidebar: React.FC = () => {
  const { agents, activeAgentId, selectAgent } = useAgents();

  return (
    <aside className="sidebar">
      <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '16px', letterSpacing: '1px' }}>
        AI Expert Applications
      </h3>
      <ul className="sidebar-list">
        {agents.map((agent) => (
          <li
            key={agent.id}
            onClick={() => selectAgent(agent.id)}
            className={`sidebar-item ${activeAgentId === agent.id ? 'active' : ''}`}
          >
            {agent.name}
          </li>
        ))}
      </ul>
    </aside>
  );
};
```

---

## Chapter 8: Task 3: Styling the Expert Agent Tiles

Let's build the central grids and stylized card components displaying our Expert Agents.

### Step 8.1: Create Agent Tile Component
Create `src/components/AgentTile.tsx`. Note how the tile reads the specific background color configuration assigned during db seed and sets dynamic custom border glow properties.

**Type this code into `src/components/AgentTile.tsx`:**
```typescript
import React from 'react';
import { ExpertAgent } from '../types';

interface AgentTileProps {
  agent: ExpertAgent;
  isActive: boolean;
  onClick: () => void;
}

export const AgentTile: React.FC<AgentTileProps> = ({ agent, isActive, onClick }) => {
  // Use tile-specific theme colors for the border
  const borderStyle: React.CSSProperties = {
    border: `var(--border-width-thick) solid ${agent.color_theme}`,
    boxShadow: isActive ? `0 0 16px ${agent.color_theme}` : 'none',
    opacity: isActive ? 1 : 0.85,
    transform: isActive ? 'scale(1.02)' : 'none'
  };

  return (
    <div 
      className="agent-tile" 
      style={borderStyle} 
      onClick={onClick}
    >
      <span className="agent-tile-title" style={{ color: 'var(--text-primary)' }}>
        {agent.name}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
        {agent.code_name.toUpperCase()}
      </span>
    </div>
  );
};
```

### Step 8.2: Create Agent Grid Component
Create `src/components/AgentGrid.tsx` to display all tiles.

**Type this code into `src/components/AgentGrid.tsx`:**
```typescript
import React from 'react';
import { useAgents } from '../context/AgentContext';
import { AgentTile } from './AgentTile';

export const AgentGrid: React.FC = () => {
  const { agents, activeAgentId, selectAgent } = useAgents();

  return (
    <div className="agent-grid">
      {agents.map((agent) => (
        <AgentTile
          key={agent.id}
          agent={agent}
          isActive={activeAgentId === agent.id}
          onClick={() => selectAgent(agent.id)}
        />
      ))}
    </div>
  );
};
```

---

## Chapter 9: Task 4: Implementing the System Log Panel

We will implement the bottom console and write automatic autoscrolling handlers.

### Step 9.1: Create Log Panel Component
Create `src/components/LogPanel.tsx`:

**Type this code into `src/components/LogPanel.tsx`:**
```typescript
import React, { useEffect, useRef } from 'react';
import { useAgents } from '../context/AgentContext';

export const LogPanel: React.FC = () => {
  const { logs } = useAgents();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll window to display newest updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    } catch {
      return "00:00:00";
    }
  };

  return (
    <div className="log-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '6px', marginBottom: '8px' }}>
        <span style={{ fontWeight: 600, color: 'var(--log-time)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
          Console Monitor Window
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          Polling active (2s interval)
        </span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {logs.map((log) => (
          <div key={log.id} style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: 'var(--log-time)' }}>[{formatTime(log.timestamp)}]</span>
            <span style={{ color: log.level === 'SUCCESS' ? 'var(--log-info)' : 'var(--log-text)' }}>
              <strong>{log.source}:</strong> {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
```

### Step 9.2: Create Footer Component
Create `src/components/Footer.tsx`:
```typescript
import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      Powered by CDAGS © 2026
    </footer>
  );
};
```

---

## Chapter 10: Running & Verifying the Application

Let's link the components inside the main entry views and spin up the complete application stack.

### Step 10.1: Assemble App Layout
Replace the code in `src/App.tsx` to handle authentication mapping, providers, and layout rendering.

**Type this code into `src/App.tsx`:**
```typescript
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AgentProvider } from './context/AgentContext';
import { LoginForm } from './components/LoginForm';
import { Banner } from './components/Banner';
import { Sidebar } from './components/Sidebar';
import { AgentGrid } from './components/AgentGrid';
import { LogPanel } from './components/LogPanel';
import { Footer } from './components/Footer';
import './styles/global.css';

const DashboardShell: React.FC = () => {
  return (
    <AgentProvider>
      <div className="app-container">
        <Banner />
        <Sidebar />
        <main className="main-content">
          <h2 style={{ marginBottom: '24px', fontWeight: 600 }}>Active Agent Applications Grid</h2>
          <AgentGrid />
        </main>
        <LogPanel />
        <Footer />
      </div>
    </AgentProvider>
  );
};

const AuthCheckGate: React.FC = () => {
  const { session } = useAuth();
  // Return login page if not authenticated, else load main framework dashboard
  return session ? <DashboardShell /> : <LoginForm />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthCheckGate />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
```

Update `src/main.tsx` to bootstrap the React code:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

Ensure `frontend/index.html` matches:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CDAGS AI Framework</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Step 10.2: Start and Test
Now, let's start our servers!

1. **Start Backend (Terminal 1):**
   ```bash
   cd backend
   source ../.venv/bin/activate
   uvicorn app.main:app --reload --port 8000
   ```
2. **Start Frontend (Terminal 2):**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Learn and Verify:**
   * Open your browser to `http://localhost:6173`.
   * Observe the redirects to the Login Page.
   * Type in `admin` as the username and `admin` as the password. Click Log In.
   * Verify the layouts: Banner, Left Sidebar listing, Agent Grid showing 8 tiles, bottom console monitor, footer.
   * Click **OT Plant Data Manager**. Check if its sidebar highlight changes color and a new select log message renders in the console log window at the bottom.
   * Toggle the light/dark mode icon on the top right. Confirm styling transitions.
