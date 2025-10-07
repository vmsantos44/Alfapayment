from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
import pandas as pd
import io
import json
from datetime import datetime, timedelta
from calendar import monthrange
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
import time

from database import engine, get_db
from models import Base, Interpreter, InterpreterLanguage, Client, ClientRate, Payment, PaymentBatch, SyncOperation, SyncLog, SyncStatus
import schemas
from zoho_client import zoho_client
from zoho_books_client import zoho_books_client
from utils import (
    map_zoho_contact_to_interpreter,
    process_interpreter_import,
    validate_import_data
)
from import_propio_report import parse_propio_report, process_propio_import
from rate_limiter import zoho_rate_limiter
from background_tasks import background_import_zoho_candidates, get_job_status
from sync_engine import run_sync
import uuid
import threading

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Alfa Payment API", version="2.0.0")

# CORS configuration - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://.*",  # Allow all HTTP origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    print(f"🚨 VALIDATION ERROR on {request.url.path}")
    print(f"   Body: {body.decode()}")
    print(f"   Errors: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
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

# ==================== HELPER FUNCTIONS ====================

def sync_interpreter_languages(db: Session, interpreter_id: str, languages: List[str]):
    """
    Sync interpreter languages in the junction table.
    Adds new languages, keeps existing ones, removes missing ones.
    """
    if not languages:
        # Clear all languages if empty list provided
        db.query(InterpreterLanguage).filter(InterpreterLanguage.interpreter_id == interpreter_id).delete()
        return

    # Get existing languages
    existing = db.query(InterpreterLanguage).filter(InterpreterLanguage.interpreter_id == interpreter_id).all()
    existing_languages = {lang.language for lang in existing}
    new_languages = set(languages)

    # Remove languages not in new list
    to_remove = existing_languages - new_languages
    if to_remove:
        db.query(InterpreterLanguage).filter(
            InterpreterLanguage.interpreter_id == interpreter_id,
            InterpreterLanguage.language.in_(to_remove)
        ).delete(synchronize_session=False)

    # Add new languages
    to_add = new_languages - existing_languages
    for lang in to_add:
        db.add(InterpreterLanguage(
            id=str(int(datetime.utcnow().timestamp() * 1000000)),  # Microsecond precision for uniqueness
            interpreter_id=interpreter_id,
            language=lang
        ))

def get_interpreter_languages(db: Session, interpreter_id: str) -> List[str]:
    """Get list of languages for an interpreter"""
    language_records = db.query(InterpreterLanguage).filter(
        InterpreterLanguage.interpreter_id == interpreter_id
    ).all()
    return [lang.language for lang in language_records]

def interpreter_to_response(interpreter: Interpreter, db: Session) -> dict:
    """Convert interpreter model to response dict with languages"""
    # Build response dict without the languages relationship
    interpreter_dict = {
        'id': interpreter.id,
        'recordId': interpreter.record_id,
        'lastName': interpreter.last_name,
        'employeeId': interpreter.employee_id,
        'cloudbreakId': interpreter.cloudbreak_id,
        'languagelinkId': interpreter.languagelink_id,
        'propioId': interpreter.propio_id,
        'contactName': interpreter.contact_name,
        'email': interpreter.email,
        'language': interpreter.language,
        'country': interpreter.country,
        'paymentFrequency': interpreter.payment_frequency,
        'serviceLocation': interpreter.service_location,
        'onboardingStatus': interpreter.onboarding_status,
        'ratePerMinute': interpreter.rate_per_minute,
        'ratePerHour': interpreter.rate_per_hour,
        'createdAt': interpreter.created_at,
        'updatedAt': interpreter.updated_at,
        'languages': get_interpreter_languages(db, interpreter.id)
    }
    return interpreter_dict

# ==================== INTERPRETERS ====================

@app.post("/api/interpreters")
def create_interpreter(interpreter: schemas.InterpreterCreate, db: Session = Depends(get_db)):
    """Create a new interpreter"""
    interpreter_data = interpreter.model_dump(exclude={'languages'})

    db_interpreter = Interpreter(
        id=str(int(datetime.utcnow().timestamp() * 1000)),
        **interpreter_data
    )
    db.add(db_interpreter)
    db.flush()  # Flush to get the ID before adding languages

    # Handle languages
    if interpreter.languages:
        sync_interpreter_languages(db, db_interpreter.id, interpreter.languages)

    db.commit()
    db.refresh(db_interpreter)
    return interpreter_to_response(db_interpreter, db)

@app.get("/api/interpreters")
def get_interpreters(
    skip: int = 0,
    limit: int = 10000,  # Increased to handle large datasets
    search: Optional[str] = None,
    language: Optional[str] = None,
    service_location: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get interpreters with pagination and filtering"""
    query = db.query(Interpreter)

    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Interpreter.contact_name.ilike(search_filter)) |
            (Interpreter.email.ilike(search_filter)) |
            (Interpreter.employee_id.ilike(search_filter))
        )

    if language:
        query = query.filter(Interpreter.language.ilike(f"%{language}%"))

    if service_location:
        query = query.filter(Interpreter.service_location.ilike(f"%{service_location}%"))

    # Get total count before pagination
    total = query.count()

    # Apply pagination
    interpreters = query.offset(skip).limit(limit).all()

    return {
        "data": [interpreter_to_response(i, db) for i in interpreters],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@app.get("/api/interpreters/{interpreter_id}")
def get_interpreter(interpreter_id: str, db: Session = Depends(get_db)):
    """Get a specific interpreter"""
    interpreter = db.query(Interpreter).filter(Interpreter.id == interpreter_id).first()
    if not interpreter:
        raise HTTPException(status_code=404, detail="Interpreter not found")
    return interpreter_to_response(interpreter, db)

@app.put("/api/interpreters/{interpreter_id}")
def update_interpreter(
    interpreter_id: str,
    interpreter_update: schemas.InterpreterUpdate,
    db: Session = Depends(get_db)
):
    """Update an interpreter"""
    db_interpreter = db.query(Interpreter).filter(Interpreter.id == interpreter_id).first()
    if not db_interpreter:
        raise HTTPException(status_code=404, detail="Interpreter not found")

    update_data = interpreter_update.model_dump(exclude_unset=True, exclude={'languages'})

    for key, value in update_data.items():
        setattr(db_interpreter, key, value)

    # Handle languages if provided
    if 'languages' in interpreter_update.model_dump(exclude_unset=True):
        languages = interpreter_update.languages or []
        sync_interpreter_languages(db, db_interpreter.id, languages)

    db.commit()
    db.refresh(db_interpreter)
    return interpreter_to_response(db_interpreter, db)

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
            interpreter_data = interpreter.model_dump(exclude={'languages'})
            for key, value in interpreter_data.items():
                if value:  # Only update if new value is not empty
                    setattr(existing, key, value)

            # Handle languages
            if interpreter.languages:
                sync_interpreter_languages(db, existing.id, interpreter.languages)

            updated.append(existing)
        else:
            # Create new interpreter
            interpreter_data = interpreter.model_dump(exclude={'languages'})
            db_interpreter = Interpreter(
                id=str(int(datetime.utcnow().timestamp() * 1000) + idx),
                **interpreter_data
            )
            db.add(db_interpreter)
            db.flush()  # Flush to get ID before adding languages

            # Handle languages
            if interpreter.languages:
                sync_interpreter_languages(db, db_interpreter.id, interpreter.languages)

            created.append(db_interpreter)

    db.commit()

    # Refresh all created and updated interpreters
    for interp in created + updated:
        db.refresh(interp)

    return {
        "created": [interpreter_to_response(i, db) for i in created],
        "updated": [interpreter_to_response(i, db) for i in updated],
        "skipped": skipped,
        "summary": {
            "total": len(interpreters),
            "created": len(created),
            "updated": len(updated),
            "skipped": len(skipped)
        }
    }

@app.post("/api/interpreters/sync-zoho-sheet")
def sync_interpreters_from_zoho_sheet(db: Session = Depends(get_db)):
    """Fetch interpreters from Zoho Sheet CSV and sync with database (smart merge)"""
    try:
        # Zoho Sheet CSV URL (hardcoded for now, can be made configurable)
        csv_url = "https://sheet.zohopublic.com/sheet/publishedsheet/e197db1bc6a59a6b48d9385437726694e8beee76bee3685492b0904530946581?type=grid&download=csv"

        # Fetch data from Zoho Sheet
        from utils import fetch_zoho_interpreter_csv, process_interpreter_import

        candidates = fetch_zoho_interpreter_csv(csv_url)

        if not candidates:
            return {
                "success": True,
                "message": "No data found in Zoho Sheet",
                "summary": {
                    "created": 0,
                    "updated": 0,
                    "skipped": 0,
                    "errors": 0,
                    "total": 0
                },
                "created": [],
                "updated": [],
                "skipped": [],
                "errors": []
            }

        # Process import with smart merge
        result = process_interpreter_import(candidates, db, update_existing=True)

        # Commit all changes
        db.commit()

        # Refresh all created and updated interpreters
        for interp in result["created"] + result["updated"]:
            db.refresh(interp)

        # Build detailed change report
        updated_details = []
        for interp in result["updated"]:
            updated_details.append({
                "id": interp.id,
                "name": interp.contact_name,
                "email": interp.email,
                "recordId": interp.record_id
            })

        created_details = []
        for interp in result["created"]:
            created_details.append({
                "id": interp.id,
                "name": interp.contact_name,
                "email": interp.email,
                "recordId": interp.record_id
            })

        return {
            "success": True,
            "message": f"✓ Sync complete: {len(result['created'])} added, {len(result['updated'])} updated, {len(result['skipped'])} unchanged",
            "summary": {
                "created": len(result["created"]),
                "updated": len(result["updated"]),
                "skipped": len(result["skipped"]),
                "errors": len(result["errors"]),
                "total": len(candidates)
            },
            "created": created_details,
            "updated": updated_details,
            "skipped": result["skipped"],
            "errors": result["errors"]
        }

    except Exception as e:
        import traceback
        error_detail = str(e)
        traceback_str = traceback.format_exc()
        print(f"Error syncing from Zoho Sheet: {error_detail}")
        print(f"Traceback: {traceback_str}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync from Zoho Sheet: {error_detail}"
        )

# ==================== ZOHO CRM INTEGRATION ====================

@app.get("/api/zoho/modules")
def get_zoho_modules():
    """Get all available Zoho CRM modules"""
    try:
        modules = zoho_client.get_modules()
        return {
            "success": True,
            "modules": modules,
            "total": len(modules)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Zoho API error: {str(e)}")

@app.get("/api/zoho/fields")
def get_zoho_fields(module_name: Optional[str] = None):
    """Get available fields from Zoho CRM module"""
    try:
        fields = zoho_client.get_module_fields(module_name)
        return {
            "success": True,
            "module": module_name or zoho_client.module_name,
            "fields": fields,
            "total": len(fields)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Zoho API error: {str(e)}")

@app.get("/api/zoho/sheet-test")
def test_zoho_sheet():
    """Test Zoho Sheet API access"""
    try:
        data = zoho_client.get_sheet_data()
        return {
            "success": True,
            "row_count": len(data),
            "sample_rows": data[:3] if data else [],
            "columns": list(data[0].keys()) if data and len(data) > 0 else []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sheet API error: {str(e)}")

@app.get("/api/zoho/filter-options")
def get_zoho_filter_options(module: Optional[str] = "Contacts"):
    """
    Get filter options by extracting unique values from actual Zoho data

    Args:
        module: Zoho CRM module (default: "Contacts", options: "Contacts", "Leads")
    """
    try:
        # Validate module
        if module not in ["Contacts", "Leads"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid module: {module}. Must be 'Contacts' or 'Leads'"
            )

        # Apply rate limiting
        zoho_rate_limiter.wait_if_needed()

        # Fetch sample records to extract common filter values
        # (Fetching all 4000+ would be too slow just for dropdowns)
        records = zoho_client.get_all_records(
            module_name=module,
            max_records=1000  # Fetch enough to get most common values
        )

        if not records:
            return {
                "success": True,
                "filterOptions": {
                    "onboardingStatuses": [],
                    "languages": [],
                    "serviceLocations": []
                },
                "message": f"No records found in {module} module"
            }

        # Extract unique values from records
        onboarding_statuses = set()
        languages = set()
        service_locations = set()

        for record in records:
            if record.get("LL_Onboarding_Status"):
                onboarding_statuses.add(record["LL_Onboarding_Status"])
            if record.get("Language"):
                languages.add(record["Language"])
            if record.get("Service_Location"):
                service_locations.add(record["Service_Location"])

        filter_options = {
            "onboardingStatuses": sorted(list(onboarding_statuses)),
            "languages": sorted(list(languages)),
            "serviceLocations": sorted(list(service_locations))
        }

        return {
            "success": True,
            "filterOptions": filter_options,
            "module": module,
            "sampleSize": len(records)
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error fetching filter options: {error_details}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch filter options from Zoho {module}: {str(e)}"
        )

@app.get("/api/zoho/candidates")
def get_zoho_candidates(
    page: int = 1,
    limit: int = 50,
    module: Optional[str] = "Contacts",
    onboarding_status: Optional[str] = "Fully Onboarded",
    language: Optional[str] = None,
    service_location: Optional[str] = None,
    criteria: Optional[str] = None
):
    """
    Preview contacts/leads from Zoho CRM with server-side filtering

    Args:
        page: Page number
        limit: Records per page (max 200)
        module: Zoho CRM module (default: "Contacts", options: "Contacts", "Leads")
        onboarding_status: Filter by LL_Onboarding_Status (default: "Fully Onboarded", use empty string to disable)
        language: Optional filter by Language field
        service_location: Optional filter by Service_Location field
        criteria: Custom COQL criteria (overrides other filters if provided)
    """
    try:
        # Validate module
        if module not in ["Contacts", "Leads"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid module: {module}. Must be 'Contacts' or 'Leads'"
            )

        # Validate pagination parameters
        if page < 1:
            raise HTTPException(status_code=400, detail="Page must be >= 1")
        if limit < 1 or limit > 200:
            raise HTTPException(status_code=400, detail="Limit must be between 1 and 200")

        # Apply rate limiting
        zoho_rate_limiter.wait_if_needed()

        # Normalize filter values (handle "undefined" strings from frontend)
        if onboarding_status in ["undefined", "null", ""]:
            onboarding_status = None
        if language in ["undefined", "null", ""]:
            language = None
        if service_location in ["undefined", "null", ""]:
            service_location = None

        # Note: Zoho v2 and v8 APIs don't reliably filter on custom fields server-side
        # We need to fetch ALL records and filter client-side to ensure complete results

        # When filtering, fetch all records; otherwise just fetch what's needed
        fetch_limit = None if (onboarding_status or language or service_location) else limit

        all_records = zoho_client.get_all_records(
            module_name=module or "Contacts",
            max_records=fetch_limit
        )

        # Apply filters client-side (same logic as background_tasks.py async import)
        filtered_records = []
        for record in all_records:
            # Check onboarding status
            if onboarding_status:
                record_status = record.get("LL_Onboarding_Status")
                if record_status != onboarding_status:
                    continue

            # Check language
            if language:
                record_language = record.get("Language")
                if record_language != language:
                    continue

            # Check service location
            if service_location:
                record_location = record.get("Service_Location")
                if record_location != service_location:
                    continue

            filtered_records.append(record)

            # Stop once we have enough results
            if len(filtered_records) >= limit:
                break

        # Apply pagination to filtered results
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_records = filtered_records[start_idx:end_idx]

        return {
            "success": True,
            "data": paginated_records,
            "info": {
                "page": page,
                "per_page": limit,
                "count": len(paginated_records),
                "total": len(filtered_records),
                "total_fetched": len(all_records),
                "more_records": end_idx < len(filtered_records)
            },
            "module": module or "Contacts",
            "filters": {
                "onboarding_status": onboarding_status,
                "language": language,
                "service_location": service_location,
                "criteria": criteria
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error fetching Zoho candidates: {error_details}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch candidates from Zoho {module}: {str(e)}"
        )

@app.post("/api/zoho/import-candidates")
def import_zoho_candidates(
    max_records: Optional[int] = None,
    update_existing: bool = True,
    onboarding_status: str = "Fully Onboarded",
    language: Optional[str] = None,
    service_location: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Import candidates from Zoho CRM Contacts to interpreters table
    Only imports contacts with specific onboarding status (default: "Fully Onboarded")

    Args:
        max_records: Maximum number of records to import (None for all, max 1000)
        update_existing: Whether to update existing interpreters
        onboarding_status: Filter by LL_Onboarding_Status (default: "Fully Onboarded")
        language: Optional filter by Language field
        service_location: Optional filter by Service_Location field
    """
    try:
        # Validate input
        validation_error = validate_import_data({
            "max_records": max_records,
            "language": language,
            "service_location": service_location
        })
        if validation_error:
            raise HTTPException(status_code=400, detail=validation_error)

        # Apply rate limiting
        zoho_rate_limiter.wait_if_needed()

        # Build criteria string for Zoho API filtering
        criteria_parts = []

        # Always filter by onboarding status
        if onboarding_status:
            criteria_parts.append(f"(LL_Onboarding_Status:equals:{onboarding_status})")

        # Optional language filter
        if language:
            criteria_parts.append(f"(Language:equals:{language})")

        # Optional service location filter
        if service_location:
            criteria_parts.append(f"(Service_Location:equals:{service_location})")

        # Combine criteria with AND
        criteria = "and".join(criteria_parts) if criteria_parts else None

        # Fetch filtered candidates from Zoho Contacts module
        candidates = zoho_client.get_all_records(
            module_name="Contacts",
            criteria=criteria,
            max_records=max_records
        )

        if not candidates:
            return {
                "success": True,
                "message": "No candidates found in Zoho CRM",
                "summary": {"total": 0, "created": 0, "updated": 0, "skipped": 0, "errors": 0}
            }

        # Process imports using helper function
        result = process_interpreter_import(candidates, db, update_existing)

        # Commit all changes
        db.commit()

        # Refresh created and updated interpreters
        for interp in result["created"] + result["updated"]:
            db.refresh(interp)

        return {
            "success": True,
            "message": f"Successfully imported {len(result['created'])} and updated {len(result['updated'])} interpreters from Zoho CRM",
            "data": {
                "created": [schemas.InterpreterResponse.model_validate(i) for i in result["created"]],
                "updated": [schemas.InterpreterResponse.model_validate(i) for i in result["updated"]],
                "skipped": result["skipped"],
                "errors": result["errors"]
            },
            "summary": {
                "total": len(candidates),
                "created": len(result["created"]),
                "updated": len(result["updated"]),
                "skipped": len(result["skipped"]),
                "errors": len(result["errors"])
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@app.post("/api/zoho/import-candidates-async")
def import_zoho_candidates_async(
    background_tasks: BackgroundTasks,
    max_records: Optional[int] = None,
    update_existing: bool = True,
    onboarding_status: str = "Fully Onboarded",
    language: Optional[str] = None,
    service_location: Optional[str] = None
):
    """
    Start async background import of candidates from Zoho CRM
    Use this for large imports (>100 records) to avoid timeout

    Args:
        max_records: Maximum number of records to import (None for all, max 1000)
        update_existing: Whether to update existing interpreters
        onboarding_status: Filter by LL_Onboarding_Status
        language: Optional filter by Language field
        service_location: Optional filter by Service_Location field

    Returns:
        Job ID to check import status
    """
    try:
        # Validate input
        validation_error = validate_import_data({
            "max_records": max_records,
            "language": language,
            "service_location": service_location
        })
        if validation_error:
            raise HTTPException(status_code=400, detail=validation_error)

        # Generate unique job ID
        job_id = str(uuid.uuid4())

        # Start background task
        background_tasks.add_task(
            background_import_zoho_candidates,
            job_id,
            max_records,
            update_existing,
            onboarding_status,
            language,
            service_location
        )

        return {
            "success": True,
            "job_id": job_id,
            "message": "Import started in background. Use /api/zoho/import-status/{job_id} to check progress."
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start import: {str(e)}")


@app.get("/api/zoho/import-status/{job_id}")
def get_import_status(job_id: str):
    """
    Get status of background import job

    Args:
        job_id: Job ID returned from async import endpoint

    Returns:
        Job status including progress, results, and errors
    """
    job_status = get_job_status(job_id)
    if not job_status:
        raise HTTPException(status_code=404, detail="Job not found")

    return job_status


@app.post("/api/zoho/import-selected")
def import_selected_candidates(
    request: dict,
    db: Session = Depends(get_db)
):
    """
    Import only selected candidates from Zoho CRM by their IDs

    Args:
        request: Dictionary with candidate_ids list and optional module parameter
    """
    try:
        candidate_ids = request.get("candidate_ids", [])
        module = request.get("module", "Contacts")

        # Validate module
        if module not in ["Contacts", "Leads"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid module: {module}. Must be 'Contacts' or 'Leads'"
            )

        if not candidate_ids:
            return {
                "success": True,
                "message": "No candidates selected for import",
                "summary": {"total": 0, "created": 0, "updated": 0, "skipped": 0, "errors": 0}
            }

        # Validate candidate IDs
        if not isinstance(candidate_ids, list):
            raise HTTPException(
                status_code=400,
                detail="candidate_ids must be a list"
            )

        # Validate number of IDs
        if len(candidate_ids) > 200:
            raise HTTPException(
                status_code=400,
                detail="Cannot import more than 200 candidates at once. Please select fewer candidates."
            )

        # Apply rate limiting
        zoho_rate_limiter.wait_if_needed()

        # Fetch all selected candidates from Zoho
        candidates = []
        fetch_errors = []

        for candidate_id in candidate_ids:
            try:
                # Apply rate limiting for each request
                zoho_rate_limiter.wait_if_needed()

                # Fetch individual candidate record
                response = zoho_client.get_records(
                    module_name=module,
                    page=1,
                    per_page=1,
                    criteria=f"(id:equals:{candidate_id})"
                )
                records = response.get("data", [])
                if records:
                    candidates.append(records[0])
                else:
                    fetch_errors.append({
                        "id": candidate_id,
                        "error": "Record not found in Zoho"
                    })
            except Exception as e:
                print(f"Error fetching candidate {candidate_id}: {e}")
                fetch_errors.append({
                    "id": candidate_id,
                    "error": str(e)
                })
                continue

        if not candidates:
            return {
                "success": False,
                "message": f"No candidates found in Zoho {module}",
                "summary": {"total": 0, "created": 0, "updated": 0, "skipped": 0, "errors": len(fetch_errors)},
                "fetch_errors": fetch_errors
            }

        # Process imports using helper function (always update existing for selected imports)
        result = process_interpreter_import(candidates, db, update_existing=True)

        # Commit all changes
        db.commit()

        # Refresh created and updated interpreters
        for interp in result["created"] + result["updated"]:
            db.refresh(interp)

        return {
            "success": True,
            "message": f"Successfully imported {len(result['created'])} new and updated {len(result['updated'])} existing interpreters from Zoho {module}",
            "data": {
                "created": [schemas.InterpreterResponse.model_validate(i) for i in result["created"]],
                "updated": [schemas.InterpreterResponse.model_validate(i) for i in result["updated"]],
                "skipped": result["skipped"],
                "errors": result["errors"],
                "fetch_errors": fetch_errors
            },
            "summary": {
                "requested": len(candidate_ids),
                "fetched": len(candidates),
                "created": len(result["created"]),
                "updated": len(result["updated"]),
                "skipped": len(result["skipped"]),
                "errors": len(result["errors"]),
                "fetch_errors": len(fetch_errors)
            },
            "module": module
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error importing selected candidates: {error_details}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Import from Zoho {module} failed: {str(e)}"
        )

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

@app.post("/api/payments/import-propio-report")
async def import_propio_report(
    file: UploadFile = File(...),
    period: str = None,
    db: Session = Depends(get_db)
):
    """
    Import Propio Excel report and create payment records

    Expects Excel file with columns:
    - Agent (format: "Name - PropioID")
    - Payable Minutes
    - Utilization %
    - Total Portal Hours
    - Calls
    - N/A's
    - Rejects
    """
    try:
        # Read file content
        content = await file.read()

        # Auto-detect period from filename if not provided
        if not period:
            # Try to extract from filename (e.g., "Propio report_September 2025.xlsx")
            filename = file.filename
            if 'september' in filename.lower():
                period = "September 2025"
            elif 'october' in filename.lower():
                period = "October 2025"
            else:
                # Default to current month
                period = datetime.now().strftime("%B %Y")

        # Parse the report
        parsed_data = parse_propio_report(content)

        if not parsed_data:
            raise HTTPException(
                status_code=400,
                detail="No valid data found in report. Check file format."
            )

        # Process the import
        result = process_propio_import(parsed_data, period, db)

        # Commit the transaction
        db.commit()

        # Build response message
        message = f"✓ Propio Report Import Complete!\n\n"
        message += f"Period: {period}\n"
        message += f"• {result['created']} payment records created\n"

        if result['unmatched']:
            message += f"• {len(result['unmatched'])} interpreters not found in database\n"
        if result['no_interpreter_rate']:
            message += f"• {len(result['no_interpreter_rate'])} interpreters missing rates\n"
        if result['no_client_rate']:
            message += f"• {len(result['no_client_rate'])} languages missing client rates\n"
        if result['errors']:
            message += f"• {len(result['errors'])} errors occurred\n"

        # Calculate totals
        total_interpreter_payment = sum(m['interpreter_payment'] for m in result['matched'])
        total_client_charge = sum(m['client_charge'] for m in result['matched'])
        total_profit = sum(m['profit'] for m in result['matched'])

        message += f"\nFinancials:\n"
        message += f"• Total Interpreter Payment: ${total_interpreter_payment:,.2f}\n"
        message += f"• Total Client Charge: ${total_client_charge:,.2f}\n"
        message += f"• Total Profit: ${total_profit:,.2f}"

        return {
            "success": True,
            "message": message,
            "summary": {
                "period": period,
                "created": result['created'],
                "total_processed": result['total_processed'],
                "total_interpreter_payment": round(total_interpreter_payment, 2),
                "total_client_charge": round(total_client_charge, 2),
                "total_profit": round(total_profit, 2)
            },
            "details": {
                "matched": result['matched'],
                "unmatched": result['unmatched'],
                "no_interpreter_rate": result['no_interpreter_rate'],
                "no_client_rate": result['no_client_rate'],
                "errors": result['errors']
            }
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to import Propio report: {str(e)}"
        )

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
    bill_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export payments in Zoho Books import format (Excel)"""

    # Query payments with filters (with eager loading to avoid N+1 queries)
    query = db.query(Payment).options(
        selectinload(Payment.client),
        selectinload(Payment.interpreter)
    ).join(Client)

    if client_id:
        # Handle case where client_id might be a client name instead of ID
        # Try to find client by name first (case-insensitive)
        client_by_name = db.query(Client).filter(Client.name.ilike(client_id)).first()
        if client_by_name:
            query = query.filter(Payment.client_id == client_by_name.id)
        else:
            # Otherwise use as-is (might be an actual ID)
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

    # Date range filter (note: Payment.period is a string like "September 2025")
    # For now, we'll skip date range filtering as it doesn't work well with string periods
    # The frontend should filter by period instead if needed
    # if start_date or end_date:
    #     if start_date:
    #         query = query.filter(Payment.period >= start_date)
    #     if end_date:
    #         query = query.filter(Payment.period <= end_date)

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

    # Format Purchase Order date range from start_date to end_date
    # Format: "1 - 30 September 2025" (same month) or "1 January - 5 October 2025" (different months)
    purchase_order_date = ""
    if start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")

            # Check if same month and year
            if start_dt.month == end_dt.month and start_dt.year == end_dt.year:
                # Format: "1 - 30 September 2025"
                purchase_order_date = f"{start_dt.day} - {end_dt.day} {end_dt.strftime('%B %Y')}"
            else:
                # Format: "1 January - 5 October 2025"
                purchase_order_date = f"{start_dt.day} {start_dt.strftime('%B')} - {end_dt.day} {end_dt.strftime('%B %Y')}"
        except:
            purchase_order_date = ""
    elif start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            purchase_order_date = f"{start_dt.day} {start_dt.strftime('%B %Y')}"
        except:
            purchase_order_date = ""
    elif end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            purchase_order_date = f"{end_dt.day} {end_dt.strftime('%B %Y')}"
        except:
            purchase_order_date = ""

    # Write payment data
    for payment in payments:
        # Use preloaded relationships (eager loaded above to avoid N+1 queries)
        interpreter = payment.interpreter
        client = payment.client

        # Get the expense account from the matching ClientRate
        expense_account = ""
        if payment.language_pair:
            client_rate = db.query(ClientRate).filter(
                ClientRate.client_id == payment.client_id,
                ClientRate.language == payment.language_pair
            ).first()
            if client_rate and client_rate.expense_account_name:
                expense_account = client_rate.expense_account_name

        # Calculate dates
        # Use provided bill_date if available, otherwise default to today
        if bill_date:
            try:
                # Parse the bill_date from YYYY-MM-DD format
                bill_date_obj = datetime.strptime(bill_date, "%Y-%m-%d")
                formatted_bill_date = bill_date_obj.strftime("%m/%d/%Y")
                due_date_obj = bill_date_obj + timedelta(days=6)
                formatted_due_date = due_date_obj.strftime("%m/%d/%Y")
            except:
                # Fallback to today if parsing fails
                formatted_bill_date = datetime.now().strftime("%m/%d/%Y")
                formatted_due_date = (datetime.now() + timedelta(days=6)).strftime("%m/%d/%Y")
        else:
            formatted_bill_date = datetime.now().strftime("%m/%d/%Y")
            formatted_due_date = (datetime.now() + timedelta(days=6)).strftime("%m/%d/%Y")

        # Create description
        description = f"Interpretation Services {client.name if client else payment.client_id}"
        if payment.language_pair:
            description += f" - {payment.language_pair}"

        # Format Bill Number: EmployeeID-30Sep25 (using the selected bill_date)
        employee_id = interpreter.employee_id if interpreter and interpreter.employee_id else "UNKNOWN"

        # Format bill_date for the bill number (format: "30Sep25")
        try:
            if bill_date:
                # Use the provided bill_date
                bill_date_for_number = datetime.strptime(bill_date, "%Y-%m-%d")
            else:
                # Fallback to today if no bill_date provided
                bill_date_for_number = datetime.now()

            formatted_bill_date_short = bill_date_for_number.strftime("%d%b%y")
        except:
            # Fallback to today if parsing fails
            formatted_bill_date_short = datetime.now().strftime("%d%b%y")

        bill_number = f"{employee_id}-{formatted_bill_date_short}"

        row = [
            formatted_bill_date,  # Bill Date
            bill_number,  # Bill Number (EmployeeID-30Sep25)
            purchase_order_date,  # PurchaseOrder (date range from filters)
            "Open",  # Bill Status
            interpreter.contact_name if interpreter else payment.internal_interpreter_name,  # Vendor Name
            formatted_due_date,  # Due Date
            "USD",  # Currency Code
            1,  # Exchange Rate
            expense_account,  # Account (from ClientRate's expense_account_name)
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

# ==================== SYNC OPERATIONS ====================

# Global variable to track ongoing sync operations
_sync_lock = threading.Lock()
_is_syncing = False

@app.post("/api/sync/force", response_model=schemas.SyncOperationResponse)
def force_sync(
    request: schemas.ForceSyncRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Manually trigger a sync operation

    Args:
        request: ForceSyncRequest with module parameter
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        SyncOperation record that is running in background
    """
    global _is_syncing

    # Check if sync is already running
    if _is_syncing:
        raise HTTPException(
            status_code=409,
            detail="A sync operation is already in progress. Please wait for it to complete."
        )

    # Validate module
    if request.module not in ["Contacts", "Leads"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid module: {request.module}. Must be 'Contacts' or 'Leads'"
        )

    # Check if last sync was too recent (Zoho search index delay)
    last_sync = db.query(SyncOperation).order_by(SyncOperation.created_at.desc()).first()
    if last_sync and last_sync.completed_at:
        from datetime import timedelta
        time_since_last = datetime.utcnow() - last_sync.completed_at
        min_interval = timedelta(minutes=5)  # Minimum 5 minutes between syncs

        if time_since_last < min_interval:
            remaining = (min_interval - time_since_last).total_seconds() / 60
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining:.1f} more minutes. Zoho's search index needs time to refresh after bulk updates."
            )

    try:
        # Mark sync as in progress
        with _sync_lock:
            _is_syncing = True

        # Run sync in background
        def run_background_sync():
            global _is_syncing
            try:
                # Create a new database session for the background task
                from database import SessionLocal
                bg_db = SessionLocal()
                try:
                    run_sync(request.module, "manual", bg_db)
                finally:
                    bg_db.close()
            finally:
                # Mark sync as complete
                with _sync_lock:
                    _is_syncing = False

        background_tasks.add_task(run_background_sync)

        # Create initial sync operation record to return
        sync_op = SyncOperation(
            id=f"sync_{int(datetime.utcnow().timestamp() * 1000)}",
            trigger_type="manual",
            status=SyncStatus.running
        )
        db.add(sync_op)
        db.commit()
        db.refresh(sync_op)

        return sync_op

    except Exception as e:
        with _sync_lock:
            _is_syncing = False
        raise HTTPException(status_code=500, detail=f"Failed to start sync: {str(e)}")

@app.get("/api/sync/status", response_model=schemas.SyncStatsResponse)
def get_sync_status(db: Session = Depends(get_db)):
    """
    Get current sync status and statistics

    Returns:
        SyncStatsResponse with last sync operation and current status
    """
    # Get last sync operation
    last_sync = db.query(SyncOperation).order_by(SyncOperation.created_at.desc()).first()

    # Get total operations count
    total_operations = db.query(SyncOperation).count()

    return {
        "last_sync": last_sync,
        "total_operations": total_operations,
        "is_syncing": _is_syncing
    }

@app.get("/api/sync/history", response_model=List[schemas.SyncOperationResponse])
def get_sync_history(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get sync operation history

    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return

    Returns:
        List of sync operations
    """
    operations = db.query(SyncOperation).order_by(
        SyncOperation.created_at.desc()
    ).offset(skip).limit(limit).all()

    return operations

@app.get("/api/sync/{sync_id}/logs", response_model=List[schemas.SyncLogResponse])
def get_sync_logs(
    sync_id: str,
    skip: int = 0,
    limit: int = 100,
    level: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get logs for a specific sync operation

    Args:
        sync_id: Sync operation ID
        skip: Number of records to skip
        limit: Maximum number of records to return
        level: Filter by log level (INFO, WARNING, ERROR)

    Returns:
        List of sync logs
    """
    query = db.query(SyncLog).filter(SyncLog.sync_operation_id == sync_id)

    if level:
        query = query.filter(SyncLog.level == level.upper())

    logs = query.order_by(SyncLog.created_at.asc()).offset(skip).limit(limit).all()

    return logs

@app.post("/api/sync/test")
def test_sync_record(
    request: schemas.TestSyncRequest,
    db: Session = Depends(get_db)
):
    """
    Test synchronization with a single record

    Args:
        request: TestSyncRequest with module and either record_id or email

    Returns:
        Test results with detailed information
    """
    from sync_engine import test_sync_single_record

    result = test_sync_single_record(
        module=request.module,
        record_id=request.record_id,
        email=request.email,
        db=db
    )

    return result


# ==================== DATABASE REFRESH & BACKUP ====================

@app.post("/api/backup/create")
def create_backup(db: Session = Depends(get_db)):
    """
    Create a complete backup of all interpreter records

    Returns:
        Backup metadata including file path and record count
    """
    from backup_utils import create_interpreter_backup

    try:
        result = create_interpreter_backup(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")


@app.get("/api/backup/list")
def list_backups():
    """
    List all available backups

    Returns:
        List of backup files with metadata
    """
    from backup_utils import list_backups

    try:
        backups = list_backups()
        return {"backups": backups, "total": len(backups)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list backups: {str(e)}")


@app.post("/api/backup/restore/{filename}")
def restore_backup(filename: str, db: Session = Depends(get_db)):
    """
    Restore interpreters from a backup file

    Args:
        filename: Name of the backup file to restore

    Returns:
        Restoration results
    """
    from backup_utils import restore_from_backup

    try:
        result = restore_from_backup(db, filename)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Backup file not found: {filename}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restoration failed: {str(e)}")


@app.delete("/api/interpreters/clear")
def clear_interpreters(
    confirm: bool = False,
    db: Session = Depends(get_db)
):
    """
    DANGEROUS: Clear all interpreter records from database

    Args:
        confirm: Must be true to execute deletion

    Returns:
        Deletion results
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Deletion not confirmed. Set confirm=true to proceed. This action is irreversible."
        )

    from backup_utils import clear_all_interpreters

    try:
        result = clear_all_interpreters(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clear operation failed: {str(e)}")


@app.post("/api/database/refresh")
def refresh_database(
    create_backup_first: bool = True,
    clear_before_sync: bool = True,
    use_fully_onboarded: bool = True,
    db: Session = Depends(get_db)
):
    """
    Complete database refresh workflow:
    1. Create backup of existing data
    2. Clear old data (optional)
    3. Sync fresh data from Zoho CRM with Fully_Onboarded filter
    4. Update CRM sync status
    5. Return comprehensive statistics

    Args:
        create_backup_first: Create backup before any operations (recommended)
        clear_before_sync: Clear existing data before sync (recommended for clean slate)
        use_fully_onboarded: Only sync fully onboarded records (recommended)

    Returns:
        Complete workflow results with statistics
    """
    from backup_utils import create_interpreter_backup, clear_all_interpreters
    import time

    workflow_start = time.time()
    results = {
        "workflow_started_at": datetime.utcnow().isoformat(),
        "steps": []
    }

    try:
        # Step 1: Backup
        if create_backup_first:
            try:
                backup_result = create_interpreter_backup(db)
                results["steps"].append({
                    "step": "backup",
                    "status": "success",
                    "data": backup_result
                })
            except Exception as e:
                results["steps"].append({
                    "step": "backup",
                    "status": "failed",
                    "error": str(e)
                })
                raise HTTPException(
                    status_code=500,
                    detail=f"Backup failed - aborting refresh: {str(e)}"
                )

        # Step 2: Clear existing data
        if clear_before_sync:
            try:
                clear_result = clear_all_interpreters(db)
                results["steps"].append({
                    "step": "clear",
                    "status": "success",
                    "data": clear_result
                })
            except Exception as e:
                results["steps"].append({
                    "step": "clear",
                    "status": "failed",
                    "error": str(e)
                })
                raise HTTPException(
                    status_code=500,
                    detail=f"Clear operation failed: {str(e)}"
                )

        # Step 3: Sync from Zoho CRM
        try:
            sync_result = run_sync(
                module="Contacts",
                trigger_type="refresh",
                db=db,
                use_fully_onboarded=use_fully_onboarded
            )

            # Convert sync operation to dictionary
            sync_data = {
                "id": sync_result.id,
                "status": sync_result.status.value,
                "total_fetched": sync_result.total_fetched,
                "total_created": sync_result.total_created,
                "total_updated": sync_result.total_updated,
                "total_skipped": sync_result.total_skipped,
                "total_errors": sync_result.total_errors,
                "total_synced_to_zoho": sync_result.total_synced_to_zoho,
                "duration_seconds": sync_result.duration_seconds,
                "error_message": sync_result.error_message
            }

            results["steps"].append({
                "step": "sync",
                "status": "success" if sync_result.status.value == "completed" else "partial",
                "data": sync_data
            })

        except Exception as e:
            results["steps"].append({
                "step": "sync",
                "status": "failed",
                "error": str(e)
            })
            raise HTTPException(
                status_code=500,
                detail=f"Sync operation failed: {str(e)}"
            )

        # Step 4: Generate final statistics
        final_count = db.query(Interpreter).count()
        workflow_duration = time.time() - workflow_start

        results["summary"] = {
            "total_duration_seconds": round(workflow_duration, 2),
            "final_interpreter_count": final_count,
            "workflow_status": "completed",
            "backup_created": create_backup_first,
            "data_cleared": clear_before_sync,
            "fully_onboarded_filter_used": use_fully_onboarded
        }

        results["workflow_completed_at"] = datetime.utcnow().isoformat()

        return results

    except HTTPException:
        raise
    except Exception as e:
        results["workflow_status"] = "failed"
        results["workflow_error"] = str(e)
        results["workflow_completed_at"] = datetime.utcnow().isoformat()
        raise HTTPException(status_code=500, detail=f"Refresh workflow failed: {str(e)}")


# ==================== ZOHO BOOKS ====================

@app.get("/api/zoho-books/organizations")
def get_zoho_books_organizations(db: Session = Depends(get_db)):
    """Get all Zoho Books organizations for discovering organization_id"""
    try:
        orgs = zoho_books_client.get_organizations()
        return {
            "organizations": orgs,
            "total": len(orgs)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch organizations: {str(e)}")


@app.get("/api/zoho-books/chart-of-accounts")
def get_chart_of_accounts(
    account_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get chart of accounts from Zoho Books

    Args:
        account_type: Filter by account type (e.g., 'expense', 'income', 'asset')
    """
    try:
        accounts = zoho_books_client.get_chart_of_accounts(account_type=account_type)
        return {
            "accounts": accounts,
            "total": len(accounts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch chart of accounts: {str(e)}")


@app.get("/api/zoho-books/expense-accounts")
def get_expense_accounts(
    search: Optional[str] = None,
    limit: Optional[int] = 50,
    db: Session = Depends(get_db)
):
    """
    Get expense accounts suitable for bill line items

    Args:
        search: Optional search term to filter accounts by name
        limit: Maximum number of results to return (default: 50)
    """
    try:
        accounts = zoho_books_client.get_expense_accounts(search=search, limit=limit)
        return {
            "accounts": accounts,
            "total": len(accounts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch expense accounts: {str(e)}")


@app.get("/api/zoho-books/vendors")
def get_vendors(db: Session = Depends(get_db)):
    """Get all vendor contacts from Zoho Books"""
    try:
        vendors = zoho_books_client.get_contacts(contact_type="vendor")
        return {
            "vendors": vendors,
            "total": len(vendors)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch vendors: {str(e)}")


@app.post("/api/zoho-books/vendors")
def create_vendor(
    contact_name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    company_name: Optional[str] = None,
    payment_terms: int = 30,
    db: Session = Depends(get_db)
):
    """Create a new vendor contact in Zoho Books"""
    try:
        vendor = zoho_books_client.create_vendor_contact(
            contact_name=contact_name,
            email=email,
            phone=phone,
            company_name=company_name,
            payment_terms=payment_terms
        )
        return vendor
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create vendor: {str(e)}")


@app.get("/api/zoho-books/bills")
def get_bills(
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get bills from Zoho Books

    Args:
        vendor_id: Filter by vendor ID
        status: Filter by status (draft, open, paid, void, overdue)
    """
    try:
        bills = zoho_books_client.get_bills(vendor_id=vendor_id, status=status)
        return {
            "bills": bills,
            "total": len(bills)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch bills: {str(e)}")


@app.get("/api/zoho-books/bills/{bill_id}")
def get_bill(bill_id: str, db: Session = Depends(get_db)):
    """Get a specific bill by ID"""
    try:
        bill = zoho_books_client.get_bill(bill_id)
        return bill
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Bill not found: {str(e)}")


@app.post("/api/zoho-books/bills")
def create_bill(
    vendor_id: str,
    line_items: List[dict],
    bill_number: Optional[str] = None,
    date: Optional[str] = None,
    due_date: Optional[str] = None,
    payment_terms: int = 30,
    notes: Optional[str] = None,
    reference_number: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Create a bill in Zoho Books

    Args:
        vendor_id: Vendor contact ID
        line_items: List of line items with account_id, name, quantity, rate, etc.
        bill_number: Optional bill number (auto-generated if not provided)
        date: Bill date (YYYY-MM-DD)
        due_date: Due date (YYYY-MM-DD)
        payment_terms: Payment terms in days
        notes: Notes for the bill
        reference_number: External reference (e.g., employee ID)
    """
    try:
        bill = zoho_books_client.create_bill(
            vendor_id=vendor_id,
            line_items=line_items,
            bill_number=bill_number,
            date=date,
            due_date=due_date,
            payment_terms=payment_terms,
            notes=notes,
            reference_number=reference_number
        )
        return bill
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create bill: {str(e)}")


@app.post("/api/zoho-books/bills/from-payment/{payment_id}")
def create_bill_from_payment(
    payment_id: str,
    account_id: str,
    auto_generate_bill_number: bool = True,
    db: Session = Depends(get_db)
):
    """
    Create a bill in Zoho Books from an existing payment record

    Args:
        payment_id: Payment ID from the database
        account_id: Chart of accounts ID for the bill line item
        auto_generate_bill_number: Whether to auto-generate bill number
    """
    try:
        # Get payment from database
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        # Get interpreter from database
        interpreter = db.query(Interpreter).filter(Interpreter.id == payment.interpreter_id).first()
        if not interpreter:
            raise HTTPException(status_code=404, detail="Interpreter not found")

        # Convert to dictionaries for the helper method
        interpreter_data = {
            "contact_name": interpreter.contact_name,
            "email": interpreter.email,
            "employee_id": interpreter.employee_id,
            "company_name": interpreter.contact_name
        }

        payment_data = {
            "language": interpreter.language,
            "period": payment.period,
            "client_name": payment.client_name,
            "total_hours": payment.total_hours,
            "rate_per_hour": payment.rate_per_hour,
            "total_amount": payment.total_amount
        }

        # Create bill using helper method
        bill = zoho_books_client.create_bill_from_payment(
            interpreter_data=interpreter_data,
            payment_data=payment_data,
            default_account_id=account_id,
            auto_generate_bill_number=auto_generate_bill_number
        )

        return bill
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create bill from payment: {str(e)}")


@app.post("/api/zoho-books/bills/bulk-from-payments")
def create_bills_from_payments(
    payment_ids: List[str],
    account_id: str,
    auto_generate_bill_number: bool = True,
    db: Session = Depends(get_db)
):
    """
    Create multiple bills in Zoho Books from payment records

    Args:
        payment_ids: List of payment IDs
        account_id: Chart of accounts ID for the bill line items
        auto_generate_bill_number: Whether to auto-generate bill numbers
    """
    results = {
        "total": len(payment_ids),
        "successful": 0,
        "failed": 0,
        "bills": [],
        "errors": []
    }

    for payment_id in payment_ids:
        try:
            bill = create_bill_from_payment(
                payment_id=payment_id,
                account_id=account_id,
                auto_generate_bill_number=auto_generate_bill_number,
                db=db
            )
            results["successful"] += 1
            results["bills"].append({
                "payment_id": payment_id,
                "bill_id": bill.get("bill_id"),
                "bill_number": bill.get("bill_number"),
                "status": "success"
            })
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "payment_id": payment_id,
                "error": str(e)
            })

    return results


# ==================== ZOHO BOOKS ITEMS ====================

@app.get("/api/zoho-books/items")
def get_zoho_books_items(
    item_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get all items from Zoho Books

    Args:
        item_type: Filter by type (sales, purchases, sales_and_purchases, inventory)
        status: Filter by status (active, inactive)
        search: Search by name or description
    """
    try:
        if search:
            items = zoho_books_client.search_items(search)
        else:
            items = zoho_books_client.get_items(item_type=item_type, status=status)
        return {"items": items}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch items: {str(e)}"
        )


# IMPORTANT: More specific routes must come before parameterized routes
@app.get("/api/zoho-books/items/fetch-for-sync")
def fetch_items_for_sync_route(
    organization_id: Optional[str] = None,
    status: Optional[str] = "active",
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Fetch items from Zoho Books and map them to client rate format for import.
    Returns items with metadata for selecting which ones to import.

    Args:
        organization_id: Zoho Books organization ID (uses env default if not provided)
        status: Filter by status (active, inactive)
        search: Search by name or description
    """
    try:
        # Fetch items from Zoho Books
        if search:
            items = zoho_books_client.search_items(search)
        else:
            items = zoho_books_client.get_items(status=status, organization_id=organization_id)

        # Get all existing client_rates with external_item_id to check for duplicates
        existing_rates = db.query(ClientRate).filter(
            ClientRate.external_item_id.isnot(None)
        ).all()
        existing_item_ids = {rate.external_item_id for rate in existing_rates}

        # Get all clients for dropdown mapping
        clients = db.query(Client).all()

        # Map items to a format suitable for the UI
        mapped_items = []
        for item in items:
            # Try to extract client, service type, and language from item name/description
            # Format examples: "Spanish - OPI - Language Link", "French VRI", etc.
            item_name = item.get('name', '')
            item_desc = item.get('description', '')

            # Basic parsing (can be enhanced later)
            mapped_item = {
                'item_id': item.get('item_id'),
                'item_name': item_name,
                'description': item_desc,
                'rate': item.get('rate', 0),
                'purchase_rate': item.get('purchase_rate', 0),
                'unit': item.get('unit', 'per_minute'),
                'status': item.get('status', 'active'),
                'account_id': item.get('account_id', ''),
                'account_name': item.get('account_name', ''),
                'sku': item.get('sku', ''),
                'item_type': item.get('item_type', ''),

                # Flags
                'already_imported': item.get('item_id') in existing_item_ids,

                # Suggested mapping (to be refined by user in UI)
                'suggested_client_id': None,  # User will select
                'suggested_language': '',     # User will enter
                'suggested_service_type': '',  # User will select
                'suggested_service_location': '',  # User will select
                # Use purchase_account if account_id is empty (for purchase-only items)
                'suggested_expense_account_id': item.get('account_id') or item.get('purchase_account_id', ''),
                'suggested_expense_account_name': item.get('account_name') or item.get('purchase_account_name', ''),
            }

            mapped_items.append(mapped_item)

        return {
            'items': mapped_items,
            'clients': [{'id': c.id, 'name': c.name} for c in clients],
            'total': len(mapped_items),
            'already_imported_count': sum(1 for item in mapped_items if item['already_imported'])
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch items for sync: {str(e)}"
        )


@app.get("/api/zoho-books/items/{item_id}")
def get_zoho_books_item(item_id: str, db: Session = Depends(get_db)):
    """Get a specific item by ID"""
    try:
        item = zoho_books_client.get_item(item_id)
        return {"item": item}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch item: {str(e)}"
        )


@app.post("/api/zoho-books/items")
def create_zoho_books_item(
    name: str,
    rate: float,
    description: Optional[str] = None,
    account_id: Optional[str] = None,
    tax_id: Optional[str] = None,
    item_type: str = "sales_and_purchases",
    product_type: str = "service",
    unit: Optional[str] = None,
    sku: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Create a new item in Zoho Books

    Args:
        name: Item name (max 100 characters)
        rate: Price/rate of the item
        description: Item description
        account_id: Associated income/expense account ID
        tax_id: Tax ID to apply
        item_type: Type (sales, purchases, sales_and_purchases, inventory)
        product_type: Product type (goods, service, digital_service)
        unit: Unit of measurement (e.g., hours, pieces)
        sku: Stock keeping unit
    """
    try:
        item = zoho_books_client.create_item(
            name=name,
            rate=rate,
            description=description,
            account_id=account_id,
            tax_id=tax_id,
            item_type=item_type,
            product_type=product_type,
            unit=unit,
            sku=sku
        )
        return {"item": item}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create item: {str(e)}"
        )


@app.put("/api/zoho-books/items/{item_id}")
def update_zoho_books_item(
    item_id: str,
    data: dict,
    db: Session = Depends(get_db)
):
    """Update an existing item in Zoho Books"""
    try:
        item = zoho_books_client.update_item(item_id, data)
        return {"item": item}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update item: {str(e)}"
        )


@app.delete("/api/zoho-books/items/{item_id}")
def delete_zoho_books_item(item_id: str, db: Session = Depends(get_db)):
    """Delete an item from Zoho Books"""
    try:
        result = zoho_books_client.delete_item(item_id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete item: {str(e)}"
        )


@app.post("/api/zoho-books/items/{item_id}/active")
def mark_item_active(item_id: str, db: Session = Depends(get_db)):
    """Mark an item as active"""
    try:
        result = zoho_books_client.mark_item_as_active(item_id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to mark item as active: {str(e)}"
        )


@app.post("/api/zoho-books/items/{item_id}/inactive")
def mark_item_inactive(item_id: str, db: Session = Depends(get_db)):
    """Mark an item as inactive"""
    try:
        result = zoho_books_client.mark_item_as_inactive(item_id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to mark item as inactive: {str(e)}"
        )


# ==================== ZOHO BOOKS ORGANIZATIONS ====================

@app.get("/api/zoho-books/organizations")
def get_zoho_books_organizations(db: Session = Depends(get_db)):
    """Get all Zoho Books organizations the user has access to"""
    try:
        organizations = zoho_books_client.get_organizations()
        return {"organizations": organizations}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch organizations: {str(e)}"
        )


# ==================== ZOHO BOOKS ITEMS SYNC ====================

class ItemSyncRequest(BaseModel):
    item_id: str
    client_id: str
    language: str
    service_type: str
    service_location: Optional[str] = None
    rate_amount: float
    purchase_amount: Optional[float] = None
    unit_type: str = "per_minute"
    notes: Optional[str] = None
    expense_account_id: Optional[str] = None
    expense_account_name: Optional[str] = None


@app.post("/api/zoho-books/items/sync-to-rates")
def sync_items_to_rates(
    items: List[ItemSyncRequest],
    db: Session = Depends(get_db)
):
    """
    Sync selected Zoho Books items to client_rates table.
    Creates or updates client rates based on item data.
    """
    print(f"🔍 DEBUG: Received {len(items)} items for sync")
    for idx, item in enumerate(items):
        print(f"  Item {idx}: client_id={item.client_id}, language={item.language}, service_type={item.service_type}, rate_amount={item.rate_amount}")

    try:
        results = {
            'successful': 0,
            'failed': 0,
            'updated': 0,
            'created': 0,
            'errors': []
        }

        for item_data in items:
            try:
                # Check if this item is already synced
                existing_rate = db.query(ClientRate).filter(
                    ClientRate.external_item_id == item_data.item_id
                ).first()

                # Calculate margins
                margin_abs = None
                margin_pct = None
                if item_data.purchase_amount is not None and item_data.rate_amount:
                    margin_abs = item_data.rate_amount - item_data.purchase_amount
                    if item_data.purchase_amount > 0:
                        margin_pct = (margin_abs / item_data.purchase_amount) * 100

                # Prepare rate data
                rate_data = {
                    'client_id': item_data.client_id,
                    'language': item_data.language,
                    'service_type': item_data.service_type,
                    'service_location': item_data.service_location,
                    'rate_currency': 'USD',
                    'rate_amount': item_data.rate_amount,
                    'purchase_currency': 'USD',
                    'purchase_amount': item_data.purchase_amount,
                    'unit_type': item_data.unit_type,
                    'effective_date': datetime.utcnow(),
                    'status': 'Active',
                    'margin_abs': margin_abs,
                    'margin_pct': margin_pct,
                    'source': 'Zoho Books',
                    'external_item_id': item_data.item_id,
                    'last_synced_at': datetime.utcnow(),
                    'created_from': 'import',
                    'notes': item_data.notes,
                    'expense_account_id': item_data.expense_account_id,
                    'expense_account_name': item_data.expense_account_name,
                    'updated_at': datetime.utcnow()
                }

                # Also set legacy fields for backward compatibility
                if item_data.unit_type == 'per_minute':
                    rate_data['rate_per_minute'] = item_data.rate_amount
                    rate_data['rate_type'] = 'minute'
                elif item_data.unit_type == 'per_hour':
                    rate_data['rate_per_hour'] = item_data.rate_amount
                    rate_data['rate_type'] = 'hour'

                if existing_rate:
                    # Update existing rate
                    for key, value in rate_data.items():
                        setattr(existing_rate, key, value)
                    results['updated'] += 1
                else:
                    # Create new rate
                    new_rate = ClientRate(
                        id=str(uuid.uuid4()),
                        **rate_data
                    )
                    db.add(new_rate)
                    results['created'] += 1

                results['successful'] += 1

            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'item_id': item_data.item_id,
                    'error': str(e)
                })

        db.commit()

        return results

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync items: {str(e)}"
        )


# ==================== INITIALIZATION ====================

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
