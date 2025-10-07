from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Interpreter Schemas
class InterpreterBase(BaseModel):
    record_id: Optional[str] = Field(None, validation_alias='recordId', serialization_alias='recordId')
    last_name: Optional[str] = Field(None, validation_alias='lastName', serialization_alias='lastName')
    employee_id: Optional[str] = Field(None, validation_alias='employeeId', serialization_alias='employeeId')
    cloudbreak_id: Optional[str] = Field(None, validation_alias='cloudbreakId', serialization_alias='cloudbreakId')
    languagelink_id: Optional[str] = Field(None, validation_alias='languagelinkId', serialization_alias='languagelinkId')
    propio_id: Optional[str] = Field(None, validation_alias='propioId', serialization_alias='propioId')
    contact_name: str = Field(..., validation_alias='contactName', serialization_alias='contactName')
    email: Optional[str] = None
    language: Optional[str] = None  # Legacy field, kept for backward compatibility
    languages: Optional[List[str]] = None  # New field for multiple languages
    country: Optional[str] = None
    payment_frequency: Optional[str] = Field(None, validation_alias='paymentFrequency', serialization_alias='paymentFrequency')
    service_location: Optional[str] = Field(None, validation_alias='serviceLocation', serialization_alias='serviceLocation')
    onboarding_status: Optional[str] = Field(None, validation_alias='onboardingStatus', serialization_alias='onboardingStatus')
    rate_per_minute: Optional[str] = Field(None, validation_alias='ratePerMinute', serialization_alias='ratePerMinute')
    rate_per_hour: Optional[str] = Field(None, validation_alias='ratePerHour', serialization_alias='ratePerHour')

    class Config:
        populate_by_name = True

class InterpreterCreate(InterpreterBase):
    contact_name: str = Field(..., validation_alias='contactName', serialization_alias='contactName')

class InterpreterUpdate(InterpreterBase):
    contact_name: Optional[str] = Field(None, validation_alias='contactName', serialization_alias='contactName')

class InterpreterResponse(InterpreterBase):
    id: str
    created_at: datetime = Field(..., serialization_alias='createdAt')
    updated_at: datetime = Field(..., serialization_alias='updatedAt')

    class Config:
        from_attributes = True
        populate_by_name = True

# Client Schemas
class ClientBase(BaseModel):
    name: str
    id_field: str = Field(..., serialization_alias='idField')
    accounts: Optional[str] = None
    email: Optional[str] = None
    currency: str = "USD"
    address: Optional[str] = None
    column_template: Optional[str] = Field(None, serialization_alias='columnTemplate')

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    id_field: Optional[str] = Field(None, serialization_alias='idField')
    accounts: Optional[str] = None
    email: Optional[str] = None
    currency: Optional[str] = None
    address: Optional[str] = None
    column_template: Optional[str] = Field(None, serialization_alias='columnTemplate')

class ClientResponse(ClientBase):
    id: str
    created_at: datetime = Field(..., serialization_alias='createdAt')
    updated_at: datetime = Field(..., serialization_alias='updatedAt')

    class Config:
        from_attributes = True
        populate_by_name = True

# Client Rate Schemas
class ClientRateBase(BaseModel):
    client_id: str = Field(..., validation_alias='clientId', serialization_alias='clientId')
    language: str
    service_location: Optional[str] = Field(None, validation_alias='serviceLocation', serialization_alias='serviceLocation')
    rate_per_minute: Optional[float] = Field(None, validation_alias='ratePerMinute', serialization_alias='ratePerMinute')
    rate_per_hour: Optional[float] = Field(None, validation_alias='ratePerHour', serialization_alias='ratePerHour')
    rate_type: str = Field(default="minute", validation_alias='rateType', serialization_alias='rateType')

class ClientRateCreate(ClientRateBase):
    pass

class ClientRateUpdate(BaseModel):
    language: Optional[str] = None
    service_location: Optional[str] = Field(None, validation_alias='serviceLocation', serialization_alias='serviceLocation')
    rate_per_minute: Optional[float] = Field(None, validation_alias='ratePerMinute', serialization_alias='ratePerMinute')
    rate_per_hour: Optional[float] = Field(None, validation_alias='ratePerHour', serialization_alias='ratePerHour')
    rate_type: Optional[str] = Field(None, validation_alias='rateType', serialization_alias='rateType')

    class Config:
        populate_by_name = True

class ClientRateResponse(ClientRateBase):
    id: str
    created_at: datetime = Field(..., serialization_alias='createdAt')
    updated_at: datetime = Field(..., serialization_alias='updatedAt')

    class Config:
        from_attributes = True
        populate_by_name = True

# Payment Schemas
class PaymentBase(BaseModel):
    client_id: str
    interpreter_id: Optional[str] = None
    client_interpreter_id: str
    interpreter_name: str
    internal_interpreter_name: str
    language_pair: Optional[str] = None
    period: str
    client_rate: float
    minutes: float = 0
    hours: float = 0
    client_charge: float
    interpreter_payment: float
    profit: float
    profit_margin: float
    status: str = "pending"
    match_status: str = "unmatched"
    adjustment: float = 0
    notes: Optional[str] = None

class PaymentCreate(PaymentBase):
    pass

class PaymentUpdate(BaseModel):
    status: Optional[str] = None
    adjustment: Optional[float] = None
    notes: Optional[str] = None

class PaymentResponse(PaymentBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Batch Import Schema
class BatchImportRequest(BaseModel):
    client_id: str
    filename: str
    period: str
    payments: List[PaymentCreate]

# Statistics Schema
class PaymentStats(BaseModel):
    total_revenue: float
    total_payments: float
    total_profit: float
    profit_margin: float
    total_records: int
    matched_count: int
    unmatched_count: int
    no_rate_count: int
    approved_count: int
    pending_count: int
    rejected_count: int

# Sync Operation Schemas
class SyncOperationResponse(BaseModel):
    id: str
    trigger_type: str = Field(..., serialization_alias='triggerType')
    status: str
    total_fetched: float = Field(..., serialization_alias='totalFetched')
    total_created: float = Field(..., serialization_alias='totalCreated')
    total_updated: float = Field(..., serialization_alias='totalUpdated')
    total_skipped: float = Field(..., serialization_alias='totalSkipped')
    total_errors: float = Field(..., serialization_alias='totalErrors')
    total_synced_to_zoho: float = Field(..., serialization_alias='totalSyncedToZoho')
    started_at: datetime = Field(..., serialization_alias='startedAt')
    completed_at: Optional[datetime] = Field(None, serialization_alias='completedAt')
    duration_seconds: Optional[float] = Field(None, serialization_alias='durationSeconds')
    error_message: Optional[str] = Field(None, serialization_alias='errorMessage')
    created_at: datetime = Field(..., serialization_alias='createdAt')

    class Config:
        from_attributes = True
        populate_by_name = True

class SyncLogResponse(BaseModel):
    id: str
    sync_operation_id: str = Field(..., serialization_alias='syncOperationId')
    level: str
    message: str
    record_id: Optional[str] = Field(None, serialization_alias='recordId')
    interpreter_id: Optional[str] = Field(None, serialization_alias='interpreterId')
    details: Optional[str] = None
    created_at: datetime = Field(..., serialization_alias='createdAt')

    class Config:
        from_attributes = True
        populate_by_name = True

class SyncStatsResponse(BaseModel):
    last_sync: Optional[SyncOperationResponse] = Field(None, serialization_alias='lastSync')
    total_operations: int = Field(..., serialization_alias='totalOperations')
    is_syncing: bool = Field(..., serialization_alias='isSyncing')

    class Config:
        populate_by_name = True

class ForceSyncRequest(BaseModel):
    module: str = "Contacts"  # "Contacts" or "Leads"

class TestSyncRequest(BaseModel):
    module: str = "Contacts"  # "Contacts" or "Leads"
    record_id: Optional[str] = Field(None, validation_alias='recordId', serialization_alias='recordId')
    email: Optional[str] = None
