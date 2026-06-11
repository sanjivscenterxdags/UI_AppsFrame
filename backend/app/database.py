"""
June 08, 2026
Database connection and session management for the application.
Uses SQLAlchemy for ORM and connection pooling.

documentation:
    - Loads environment variables to determine the database connection URL.
    - Creates a SQLAlchemy engine with connection pooling.
    - Defines a sessionmaker factory for creating database sessions.
    - Provides a dependency function `get_db` for FastAPI routes to access the database session.
    - Supports both development (SQLite) and production (PostgreSQL) environments based on the ENV variable.

Usage:
    - In development, set ENV=development and provide a local SQLite DATABASE_URL in the .env file.
    - In production, set ENV=production and provide a DATABASE_URL for the production database in the environment variables.
"""

import os
from typing import Generator

from dotenv import load_dotenv

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, Session, sessionmaker


# Step 0: Load environment variables from .env file
load_dotenv()

# Step 1: Read and validate the environment state
current_env = os.getenv("ENV", "development")  # Default to 'development' if ENV is not set

if current_env not in ("development", "production"):
    raise ValueError(f"Unknown ENV value: '{current_env}'. Expected 'development' or 'production'.")

DATABASE_URL = os.getenv("DATABASE_URL")

if current_env == "development":
    print(f"DATABASE_URL set in this env is: {DATABASE_URL}")

# Step 1A: Quick check to ensure DATABASE_URL is set
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set. Please check your environment variables.")


# Step 2: Create the SQLAlchemy engine
# 'check_same_thread=False' is needed for SQLite to allow multiple threads to access the database.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

# Step 3: Create sessionmaker factory
SessionLocal = sessionmaker(autocommit=False,
                            autoflush=False,
                            bind=engine)

# Step 4: Create the Base class for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency generator that yields a database session and ensures it is closed after use.
    Use with FastAPI's Depends() in route definitions.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# end of database.py
