from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Interpreter Schemas
class InterpreterBase(BaseModel):
    record_id: Optional[str] = Field(None, serialization_alias='recordId')
    last_name: Optional[str] = Field(None, serialization_alias='lastName')
    employee_id: Optional[str] = Field(None, serialization_alias='employeeId')
    cloudbreak_id: Optional[str] = Field(None, serialization_alias='cloudbreakId')
    languagelink_id: Optional[str] = Field(None, serialization_alias='languagelinkId')
    propio_id: Optional[str] = Field(None, serialization_alias='propioId')
    contact_name: str = Field(..., serialization_alias='contactName')
    email: Optional[str] = None
    language: Optional[str] = None
    payment_frequency: Optional[str] = Field(None, serialization_alias='paymentFrequency')
    service_location: Optional[str] = Field(None, serialization_alias='serviceLocation')
    rate_per_minute: Optional[str] = Field(None, serialization_alias='ratePerMinute')
    rate_per_hour: Optional[str] = Field(None, serialization_alias='ratePerHour')

class InterpreterCreate(InterpreterBase):
    contact_name: str = Field(..., serialization_alias='contactName')

class InterpreterUpdate(InterpreterBase):
    contact_name: Optional[str] = Field(None, serialization_alias='contactName')

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
    column_template: Optional[str] = Field(None, serialization_alias='columnTemplate')

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    id_field: Optional[str] = Field(None, serialization_alias='idField')
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
