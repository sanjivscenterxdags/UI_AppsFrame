"""
   
   June 10, 2026

   Seed the database with initial data.
   This script can be run to populate the database with default agents and logs for testing 
   and development purposes. It creates a set of sample Expert AI Agents with 
   various capabilities and logs some initial system events 
    
"""

import json
import sys

from passlib.context import CryptContext

from app.database import SessionLocal, Base, engine
from app.models.agent import ExpertAgent, SubAgent
from app.models.log import SystemLog
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_database():
    # Create database tables if they don't exist or recreate them for a fresh start. 
    # In production, use migrations instead of dropping tables.

    # Drop existing tables for a clean slate; use with caution in production 
    Base.metadata.drop_all(bind=engine)  
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Create a default admin user for authentication testing
        admin = User(
            username="admin",
            email="admin@localhost",
            hashed_password=pwd_context.hash("admin"),
            role="admin")
                    
        db.add(admin)  
        
        #2. Define common business color palatte  
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
        
        #3 Define Expert Agent List 
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

        # Insert Expert Agents 
        for i, name in enumerate(agent_names): 
           code_name = name.lower().replace(" ", "_").replace("&", "and") 
           agent = ExpertAgent(
              name = name, 
              code_name=code_name, 
              description=f"Domain expert for handling {name.replace(' Manager', '')}", 
              color_theme=colors[i],
              is_active=True 
           ) 
            
           db.add(agent)     
            
        # Log initial system events for auditing and analytics
        log_entry = SystemLog(
            level="INFO",
            source="SYSTEM",
            message="Database seeded with initial Expert Agents.",
            metadata_json=json.dumps({"agents_added": len(agent_names)})
        )
        db.add(log_entry)
        db.commit()

        print("Database seeded successfully with initial Expert Agents.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
