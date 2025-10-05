from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io
import json
from datetime import datetime, timedelta
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment

from database import engine, get_db
from models import Base, Interpreter, Client, ClientRate, Payment, PaymentBatch
import schemas

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Alfa Payment API", version="2.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== HEALTH & INFO ====================

@app.get("/")
async def root():
    return {
        "message": "Alfa Payment API with Database",
        "version": "2.0.0",
        "status": "running",
        "database": "connected"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# ==================== INTERPRETERS ====================

@app.post("/api/interpreters", response_model=schemas.InterpreterResponse)
def create_interpreter(interpreter: schemas.InterpreterCreate, db: Session = Depends(get_db)):
    """Create a new interpreter"""
    db_interpreter = Interpreter(
        id=str(int(datetime.utcnow().timestamp() * 1000)),
        **interpreter.model_dump()
    )
    db.add(db_interpreter)
    db.commit()
    db.refresh(db_interpreter)
    return db_interpreter

@app.get("/api/interpreters", response_model=List[schemas.InterpreterResponse])
def get_interpreters(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    """Get all interpreters"""
    interpreters = db.query(Interpreter).offset(skip).limit(limit).all()
    return interpreters

@app.get("/api/interpreters/{interpreter_id}", response_model=schemas.InterpreterResponse)
def get_interpreter(interpreter_id: str, db: Session = Depends(get_db)):
    """Get a specific interpreter"""
    interpreter = db.query(Interpreter).filter(Interpreter.id == interpreter_id).first()
    if not interpreter:
        raise HTTPException(status_code=404, detail="Interpreter not found")
    return interpreter

@app.put("/api/interpreters/{interpreter_id}", response_model=schemas.InterpreterResponse)
def update_interpreter(
    interpreter_id: str,
    interpreter_update: schemas.InterpreterUpdate,
    db: Session = Depends(get_db)
):
    """Update an interpreter"""
    db_interpreter = db.query(Interpreter).filter(Interpreter.id == interpreter_id).first()
    if not db_interpreter:
        raise HTTPException(status_code=404, detail="Interpreter not found")

    update_data = interpreter_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_interpreter, key, value)

    db.commit()
    db.refresh(db_interpreter)
    return db_interpreter

@app.delete("/api/interpreters/{interpreter_id}")
def delete_interpreter(interpreter_id: str, db: Session = Depends(get_db)):
    """Delete an interpreter"""
    db_interpreter = db.query(Interpreter).filter(Interpreter.id == interpreter_id).first()
    if not db_interpreter:
        raise HTTPException(status_code=404, detail="Interpreter not found")

    db.delete(db_interpreter)
    db.commit()
    return {"message": "Interpreter deleted successfully"}

@app.post("/api/interpreters/bulk")
def create_interpreters_bulk(interpreters: List[schemas.InterpreterCreate], db: Session = Depends(get_db)):
    """Bulk create interpreters (for CSV import) - skips duplicates based on email or employee_id"""
    created = []
    skipped = []
    updated = []

    for idx, interpreter in enumerate(interpreters):
        # Check for duplicates by email or employee_id
        existing = None

        if interpreter.email:
            existing = db.query(Interpreter).filter(Interpreter.email == interpreter.email).first()

        if not existing and interpreter.employee_id:
            existing = db.query(Interpreter).filter(Interpreter.employee_id == interpreter.employee_id).first()

        if existing:
            # Update existing interpreter with new data
            for key, value in interpreter.model_dump().items():
                if value:  # Only update if new value is not empty
                    setattr(existing, key, value)
            updated.append(existing)
        else:
            # Create new interpreter
            db_interpreter = Interpreter(
                id=str(int(datetime.utcnow().timestamp() * 1000) + idx),
                **interpreter.model_dump()
            )
            db.add(db_interpreter)
            created.append(db_interpreter)

    db.commit()

    # Refresh all created and updated interpreters
    for interp in created + updated:
        db.refresh(interp)

    return {
        "created": [schemas.InterpreterResponse.model_validate(i) for i in created],
        "updated": [schemas.InterpreterResponse.model_validate(i) for i in updated],
        "skipped": skipped,
        "summary": {
            "total": len(interpreters),
            "created": len(created),
            "updated": len(updated),
            "skipped": len(skipped)
        }
    }

# ==================== CLIENTS ====================

@app.post("/api/clients", response_model=schemas.ClientResponse)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)):
    """Create a new client"""
    db_client = Client(
        id=str(int(datetime.utcnow().timestamp() * 1000)),
        **client.model_dump()
    )
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

@app.get("/api/clients", response_model=List[schemas.ClientResponse])
def get_clients(db: Session = Depends(get_db)):
    """Get all clients"""
    clients = db.query(Client).all()
    return clients

@app.get("/api/clients/{client_id}", response_model=schemas.ClientResponse)
def get_client(client_id: str, db: Session = Depends(get_db)):
    """Get a specific client"""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@app.put("/api/clients/{client_id}", response_model=schemas.ClientResponse)
def update_client(
    client_id: str,
    client_update: schemas.ClientUpdate,
    db: Session = Depends(get_db)
):
    """Update a client"""
    db_client = db.query(Client).filter(Client.id == client_id).first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = client_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_client, key, value)

    db.commit()
    db.refresh(db_client)
    return db_client

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: str, db: Session = Depends(get_db)):
    """Delete a client"""
    db_client = db.query(Client).filter(Client.id == client_id).first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")

    db.delete(db_client)
    db.commit()
    return {"message": "Client deleted successfully"}

# ==================== CLIENT RATES ====================

@app.post("/api/client-rates", response_model=schemas.ClientRateResponse)
def create_client_rate(rate: schemas.ClientRateCreate, db: Session = Depends(get_db)):
    """Create a new client rate"""
    # Verify client exists
    client = db.query(Client).filter(Client.id == rate.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    db_rate = ClientRate(
        id=str(int(datetime.utcnow().timestamp() * 1000)),
        **rate.model_dump()
    )
    db.add(db_rate)
    db.commit()
    db.refresh(db_rate)
    return db_rate

@app.get("/api/client-rates", response_model=List[schemas.ClientRateResponse])
def get_client_rates(client_id: str = None, db: Session = Depends(get_db)):
    """Get all client rates, optionally filtered by client_id"""
    query = db.query(ClientRate)
    if client_id:
        query = query.filter(ClientRate.client_id == client_id)
    rates = query.all()
    return rates

@app.get("/api/client-rates/{rate_id}", response_model=schemas.ClientRateResponse)
def get_client_rate(rate_id: str, db: Session = Depends(get_db)):
    """Get a specific client rate"""
    rate = db.query(ClientRate).filter(ClientRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Client rate not found")
    return rate

@app.put("/api/client-rates/{rate_id}", response_model=schemas.ClientRateResponse)
def update_client_rate(
    rate_id: str,
    rate_update: schemas.ClientRateUpdate,
    db: Session = Depends(get_db)
):
    """Update a client rate"""
    db_rate = db.query(ClientRate).filter(ClientRate.id == rate_id).first()
    if not db_rate:
        raise HTTPException(status_code=404, detail="Client rate not found")

    update_data = rate_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_rate, key, value)

    db.commit()
    db.refresh(db_rate)
    return db_rate

@app.delete("/api/client-rates/{rate_id}")
def delete_client_rate(rate_id: str, db: Session = Depends(get_db)):
    """Delete a client rate"""
    db_rate = db.query(ClientRate).filter(ClientRate.id == rate_id).first()
    if not db_rate:
        raise HTTPException(status_code=404, detail="Client rate not found")

    db.delete(db_rate)
    db.commit()
    return {"message": "Client rate deleted successfully"}

# ==================== PAYMENTS ====================

@app.post("/api/payments", response_model=schemas.PaymentResponse)
def create_payment(payment: schemas.PaymentCreate, db: Session = Depends(get_db)):
    """Create a new payment record"""
    db_payment = Payment(
        id=str(int(datetime.utcnow().timestamp() * 1000)),
        **payment.model_dump()
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment

@app.post("/api/payments/bulk", response_model=List[schemas.PaymentResponse])
def create_payments_bulk(payments: List[schemas.PaymentCreate], db: Session = Depends(get_db)):
    """Bulk create payment records"""
    db_payments = []
    for idx, payment in enumerate(payments):
        db_payment = Payment(
            id=str(int(datetime.utcnow().timestamp() * 1000) + idx),
            **payment.model_dump()
        )
        db_payments.append(db_payment)

    db.add_all(db_payments)
    db.commit()

    for payment in db_payments:
        db.refresh(payment)

    return db_payments

@app.get("/api/payments", response_model=List[schemas.PaymentResponse])
def get_payments(
    client_id: str = None,
    period: str = None,
    status: str = None,
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    """Get payments with optional filters"""
    query = db.query(Payment)

    if client_id:
        query = query.filter(Payment.client_id == client_id)
    if period:
        query = query.filter(Payment.period == period)
    if status:
        query = query.filter(Payment.status == status)

    payments = query.offset(skip).limit(limit).all()
    return payments

@app.get("/api/payments/{payment_id}", response_model=schemas.PaymentResponse)
def get_payment(payment_id: str, db: Session = Depends(get_db)):
    """Get a specific payment"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@app.put("/api/payments/{payment_id}", response_model=schemas.PaymentResponse)
def update_payment(
    payment_id: str,
    payment_update: schemas.PaymentUpdate,
    db: Session = Depends(get_db)
):
    """Update a payment (for approval/rejection/adjustments)"""
    db_payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    update_data = payment_update.model_dump(exclude_unset=True)

    # Recalculate if adjustment is updated
    if 'adjustment' in update_data:
        original_payment = db_payment.interpreter_payment - db_payment.adjustment
        new_payment = original_payment + update_data['adjustment']
        db_payment.interpreter_payment = new_payment
        db_payment.profit = db_payment.client_charge - new_payment
        if db_payment.client_charge > 0:
            db_payment.profit_margin = (db_payment.profit / db_payment.client_charge) * 100

    for key, value in update_data.items():
        setattr(db_payment, key, value)

    db.commit()
    db.refresh(db_payment)
    return db_payment

@app.delete("/api/payments/{payment_id}")
def delete_payment(payment_id: str, db: Session = Depends(get_db)):
    """Delete a payment"""
    db_payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    db.delete(db_payment)
    db.commit()
    return {"message": "Payment deleted successfully"}

# ==================== STATISTICS ====================

@app.get("/api/payments/stats/summary", response_model=schemas.PaymentStats)
def get_payment_stats(
    client_id: str = None,
    period: str = None,
    db: Session = Depends(get_db)
):
    """Get payment statistics"""
    query = db.query(Payment)

    if client_id:
        query = query.filter(Payment.client_id == client_id)
    if period:
        query = query.filter(Payment.period == period)

    payments = query.all()

    total_revenue = sum(p.client_charge for p in payments)
    total_payments_sum = sum(p.interpreter_payment for p in payments)
    total_profit = sum(p.profit for p in payments)

    return {
        "total_revenue": total_revenue,
        "total_payments": total_payments_sum,
        "total_profit": total_profit,
        "profit_margin": (total_profit / total_revenue * 100) if total_revenue > 0 else 0,
        "total_records": len(payments),
        "matched_count": len([p for p in payments if p.match_status == "matched"]),
        "unmatched_count": len([p for p in payments if p.match_status == "unmatched"]),
        "no_rate_count": len([p for p in payments if p.match_status == "no_interpreter_rate"]),
        "approved_count": len([p for p in payments if p.status == "approved"]),
        "pending_count": len([p for p in payments if p.status == "pending"]),
        "rejected_count": len([p for p in payments if p.status == "rejected"]),
    }

# ==================== CSV OPERATIONS ====================

@app.post("/api/parse-csv")
async def parse_csv(file: UploadFile = File(...)):
    """Parse uploaded CSV file and return structured data"""
    try:
        contents = await file.read()

        # Try to read as CSV
        try:
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        except:
            # Try to read as Excel
            df = pd.read_excel(io.BytesIO(contents))

        # Convert to dict
        data = df.to_dict('records')

        # Get columns for mapping
        columns = list(df.columns)

        return {
            "data": data,
            "columns": columns,
            "rowCount": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")

@app.post("/api/export-payments-csv")
async def export_payments_csv(
    client_id: str = None,
    period: str = None,
    db: Session = Depends(get_db)
):
    """Export payments to CSV format"""
    try:
        query = db.query(Payment)

        if client_id:
            query = query.filter(Payment.client_id == client_id)
        if period:
            query = query.filter(Payment.period == period)

        payments = query.all()

        # Convert to DataFrame
        data = []
        for p in payments:
            data.append({
                "Client": p.client.name if p.client else "",
                "Client Interpreter ID": p.client_interpreter_id,
                "Report Name": p.interpreter_name,
                "Internal Interpreter": p.internal_interpreter_name,
                "Language": p.language_pair,
                "Period": p.period,
                "Minutes": p.minutes,
                "Hours": p.hours,
                "Client Rate": p.client_rate,
                "Client Charge": p.client_charge,
                "Interpreter Payment": p.interpreter_payment,
                "Profit": p.profit,
                "Margin": f"{p.profit_margin:.1f}%",
                "Status": p.status,
                "Match Status": p.match_status,
                "Adjustment": p.adjustment,
                "Notes": p.notes or ""
            })

        df = pd.DataFrame(data)

        # Create CSV
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)

        return {
            "csv": csv_buffer.getvalue(),
            "filename": f"alfa-payments-{period or 'export'}.csv"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting CSV: {str(e)}")

# ==================== INITIALIZATION ====================

@app.get("/api/export-zoho-books")
def export_zoho_books(
    client_id: Optional[str] = None,
    period: Optional[str] = None,
    status: Optional[str] = None,
    match_status: Optional[str] = None,
    language: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export payments in Zoho Books import format (Excel)"""

    # Query payments with filters
    query = db.query(Payment).join(Client)

    if client_id:
        query = query.filter(Payment.client_id == client_id)
    if period:
        query = query.filter(Payment.period == period)
    if status:
        query = query.filter(Payment.status == status)
    if match_status:
        query = query.filter(Payment.match_status == match_status)
    if language:
        query = query.filter(Payment.language_pair == language)
    if search:
        query = query.filter(Payment.internal_interpreter_name.ilike(f'%{search}%'))

    # Date range filter
    if start_date or end_date:
        if start_date:
            query = query.filter(Payment.period >= start_date)
        if end_date:
            query = query.filter(Payment.period <= end_date)

    payments = query.all()

    if not payments:
        raise HTTPException(status_code=404, detail="No payments found matching the specified filters. Please adjust your filters and try again.")

    # Create Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Zoho Books Import"

    # Define all Zoho Books columns (user said to include columns after Terms & Conditions but leave them blank)
    headers = [
        "Bill Date", "Bill Number", "PurchaseOrder", "Bill Status", "Vendor Name",
        "Due Date", "Currency Code", "Exchange Rate", "Account", "Description",
        "Quantity", "Rate", "Total", "Terms & Conditions", "Customer Name",
        "Project Name", "Adjustment", "Item Type", "Purchase Order Number",
        "Is Discount Before Tax", "Entity Discount Amount", "Discount Account",
        "Warehouse Name", "Branch Name", "CIT/Importer Name"
    ]

    # Write headers
    ws.append(headers)

    # Style headers
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal='center')

    # Write payment data
    for payment in payments:
        # Get interpreter
        interpreter = db.query(Interpreter).filter(Interpreter.id == payment.interpreter_id).first()

        # Get client
        client = db.query(Client).filter(Client.id == payment.client_id).first()

        # Calculate dates
        bill_date = datetime.now().strftime("%d/%m/%Y")
        due_date = (datetime.now() + timedelta(days=30)).strftime("%d/%m/%Y")

        # Create description
        description = f"Interpretation Services {client.name if client else payment.client_id}"
        if payment.language_pair:
            description += f" - {payment.language_pair}"

        row = [
            bill_date,  # Bill Date
            f"{client.name if client else payment.client_id}{payment.period}",  # Bill Number
            "",  # PurchaseOrder
            "Open",  # Bill Status
            interpreter.contact_name if interpreter else payment.internal_interpreter_name,  # Vendor Name
            due_date,  # Due Date
            "USD",  # Currency Code
            1,  # Exchange Rate
            "",  # Account
            description,  # Description
            int(payment.minutes) if payment.minutes else 0,  # Quantity (minutes)
            float(payment.client_rate) if payment.client_rate else 0,  # Rate
            float(payment.interpreter_payment) if payment.interpreter_payment else 0,  # Total
            "",  # Terms & Conditions (leave blank as user requested)
            "",  # Customer Name
            "",  # Project Name
            "",  # Adjustment
            "",  # Item Type
            "",  # Purchase Order Number
            "",  # Is Discount Before Tax
            "",  # Entity Discount Amount
            "",  # Discount Account
            "",  # Warehouse Name
            "",  # Branch Name
            ""   # CIT/Importer Name
        ]

        ws.append(row)

    # Save to BytesIO
    excel_file = io.BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # Generate filename
    filename = f"zoho_books_import_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.on_event("startup")
async def startup_event():
    """Initialize default clients on startup if they don't exist"""
    db = next(get_db())

    # Check if clients exist
    existing_clients = db.query(Client).count()

    if existing_clients == 0:
        # Create default clients
        default_clients = [
            Client(id="cloudbreak", name="Cloudbreak", id_field="cloudbreak_id"),
            Client(id="languagelink", name="Languagelink", id_field="languagelink_id"),
            Client(id="propio", name="Propio", id_field="propio_id")
        ]
        db.add_all(default_clients)
        db.commit()
        print("✅ Default clients initialized")

    db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
