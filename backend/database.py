from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
import os
from dotenv import load_dotenv

load_dotenv()

# Get database URL from environment variable
# For Supabase: postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./alfa_payment.db")

# Create engine
# For SQLite (local development)
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
# For PostgreSQL (Supabase/Production)
else:
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
        pool_pre_ping=True
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
