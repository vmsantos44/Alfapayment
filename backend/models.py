from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class PaymentStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class MatchStatus(str, enum.Enum):
    matched = "matched"
    unmatched = "unmatched"
    no_interpreter_rate = "no_interpreter_rate"

class Interpreter(Base):
    __tablename__ = "interpreters"

    id = Column(String, primary_key=True, index=True)
    record_id = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    employee_id = Column(String, nullable=True, index=True)
    cloudbreak_id = Column(String, nullable=True, index=True)
    languagelink_id = Column(String, nullable=True, index=True)
    propio_id = Column(String, nullable=True, index=True)
    contact_name = Column(String, nullable=False)
    email = Column(String, nullable=True, index=True)
    language = Column(String, nullable=True)
    payment_frequency = Column(String, nullable=True)
    service_location = Column(String, nullable=True)
    rate_per_minute = Column(String, nullable=True)
    rate_per_hour = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    payments = relationship("Payment", back_populates="interpreter")

class Client(Base):
    __tablename__ = "clients"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    id_field = Column(String, nullable=False)
    column_template = Column(Text, nullable=True)  # JSON stored as text
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    payments = relationship("Payment", back_populates="client")
    rates = relationship("ClientRate", back_populates="client", cascade="all, delete-orphan")

class ClientRate(Base):
    __tablename__ = "client_rates"

    id = Column(String, primary_key=True, index=True)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    language = Column(String, nullable=False, index=True)
    service_location = Column(String, nullable=True, index=True)  # "On-site", "Remote", "Both"
    rate_per_minute = Column(Float, nullable=True)
    rate_per_hour = Column(Float, nullable=True)
    rate_type = Column(String, default="minute")  # "minute" or "hour"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    client = relationship("Client", back_populates="rates")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, index=True)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    interpreter_id = Column(String, ForeignKey("interpreters.id"), nullable=True)

    client_interpreter_id = Column(String, nullable=False)
    interpreter_name = Column(String, nullable=False)
    internal_interpreter_name = Column(String, nullable=False)
    language_pair = Column(String, nullable=True)
    period = Column(String, nullable=False)

    client_rate = Column(Float, nullable=False)
    minutes = Column(Float, default=0)
    hours = Column(Float, default=0)

    client_charge = Column(Float, nullable=False)
    interpreter_payment = Column(Float, nullable=False)
    profit = Column(Float, nullable=False)
    profit_margin = Column(Float, nullable=False)

    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    match_status = Column(Enum(MatchStatus), default=MatchStatus.unmatched)

    adjustment = Column(Float, default=0)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    client = relationship("Client", back_populates="payments")
    interpreter = relationship("Interpreter", back_populates="payments")

class PaymentBatch(Base):
    __tablename__ = "payment_batches"

    id = Column(String, primary_key=True, index=True)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    filename = Column(String, nullable=False)
    period = Column(String, nullable=False)
    total_records = Column(Float, default=0)
    total_revenue = Column(Float, default=0)
    total_payments = Column(Float, default=0)
    total_profit = Column(Float, default=0)
    status = Column(String, default="processing")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
