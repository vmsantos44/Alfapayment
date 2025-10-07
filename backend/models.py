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
    language = Column(String, nullable=True)  # Legacy field, kept for backward compatibility
    country = Column(String, nullable=True)
    payment_frequency = Column(String, nullable=True)
    service_location = Column(String, nullable=True)
    onboarding_status = Column(String, nullable=True)
    rate_per_minute = Column(String, nullable=True)
    rate_per_hour = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    payments = relationship("Payment", back_populates="interpreter")
    languages = relationship("InterpreterLanguage", back_populates="interpreter", cascade="all, delete-orphan")

class InterpreterLanguage(Base):
    __tablename__ = "interpreter_languages"

    id = Column(String, primary_key=True, index=True)
    interpreter_id = Column(String, ForeignKey("interpreters.id"), nullable=False)
    language = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    interpreter = relationship("Interpreter", back_populates="languages")

class Client(Base):
    __tablename__ = "clients"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    id_field = Column(String, nullable=False)
    accounts = Column(String, nullable=True)
    email = Column(String, nullable=True)
    currency = Column(String, default="USD", nullable=False)
    address = Column(Text, nullable=True)
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

    # Legacy rate fields (kept for backward compatibility)
    rate_per_minute = Column(Float, nullable=True)
    rate_per_hour = Column(Float, nullable=True)
    rate_type = Column(String, default="minute")  # "minute" or "hour"

    # Extended fields for Zoho Books integration
    service_type = Column(String, nullable=True, index=True)  # "OPI", "VRI", "On-site", etc.
    rate_currency = Column(String, default="USD")
    rate_amount = Column(Float, nullable=True)  # Sale/revenue rate
    purchase_currency = Column(String, default="USD")
    purchase_amount = Column(Float, nullable=True)  # Cost/purchase rate
    unit_type = Column(String, default="per_minute")  # "per_minute", "per_hour", "per_word", etc.
    effective_date = Column(DateTime, nullable=True)
    status = Column(String, default="Active")  # "Active", "Inactive", "Pending"

    # Margin calculations
    margin_abs = Column(Float, nullable=True)  # Absolute margin (rate_amount - purchase_amount)
    margin_pct = Column(Float, nullable=True)  # Percentage margin

    # Sync metadata
    source = Column(String, nullable=True)  # "manual", "Zoho Books", "import"
    external_item_id = Column(String, nullable=True, index=True)  # Zoho Books Item ID
    external_account = Column(String, nullable=True)  # Associated account/vendor name
    last_synced_at = Column(DateTime, nullable=True)
    created_from = Column(String, default="manual")  # "manual", "import", "sync"
    notes = Column(Text, nullable=True)

    # Zoho Books Chart of Accounts integration
    expense_account_id = Column(String, nullable=True, index=True)  # Zoho Books account ID
    expense_account_name = Column(String, nullable=True)  # Account name for display

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

class SyncStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"
    partial = "partial"

class SyncOperation(Base):
    __tablename__ = "sync_operations"

    id = Column(String, primary_key=True, index=True)
    trigger_type = Column(String, nullable=False)  # "manual" or "scheduled"
    status = Column(Enum(SyncStatus), default=SyncStatus.running)

    # Sync statistics
    total_fetched = Column(Float, default=0)
    total_created = Column(Float, default=0)
    total_updated = Column(Float, default=0)
    total_skipped = Column(Float, default=0)
    total_errors = Column(Float, default=0)
    total_synced_to_zoho = Column(Float, default=0)  # Successfully marked as "Synced"

    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, nullable=True)

    # Error tracking
    error_message = Column(Text, nullable=True)
    error_details = Column(Text, nullable=True)  # JSON

    created_at = Column(DateTime, default=datetime.utcnow)

class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(String, primary_key=True, index=True)
    sync_operation_id = Column(String, ForeignKey("sync_operations.id"), nullable=False)

    level = Column(String, nullable=False)  # "INFO", "WARNING", "ERROR"
    message = Column(Text, nullable=False)
    record_id = Column(String, nullable=True)  # Zoho record ID
    interpreter_id = Column(String, nullable=True)  # Local interpreter ID
    details = Column(Text, nullable=True)  # JSON with additional data

    created_at = Column(DateTime, default=datetime.utcnow)
