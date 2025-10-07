"""
Sync Engine for Zoho CRM to Payment App synchronization
"""

import time
import json
from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from models import SyncOperation, SyncLog, SyncStatus
from zoho_client import zoho_client
from rate_limiter import zoho_rate_limiter
from utils import (
    map_zoho_contact_to_interpreter,
    process_interpreter_import,
    has_changes,
    get_changed_fields
)


class SyncLogger:
    """Helper class for logging sync operations"""

    def __init__(self, sync_operation: SyncOperation, db: Session):
        self.sync_operation = sync_operation
        self.db = db

    def log(self, level: str, message: str, record_id: Optional[str] = None,
            interpreter_id: Optional[str] = None, details: Optional[Dict] = None):
        """Add a log entry"""
        log_entry = SyncLog(
            id=f"{int(datetime.utcnow().timestamp() * 1000)}_{id(message)}",
            sync_operation_id=self.sync_operation.id,
            level=level,
            message=message,
            record_id=record_id,
            interpreter_id=interpreter_id,
            details=json.dumps(details) if details else None
        )
        self.db.add(log_entry)
        self.db.commit()

    def info(self, message: str, **kwargs):
        self.log("INFO", message, **kwargs)

    def warning(self, message: str, **kwargs):
        self.log("WARNING", message, **kwargs)

    def error(self, message: str, **kwargs):
        self.log("ERROR", message, **kwargs)


def run_sync(
    module: str,
    trigger_type: str,
    db: Session,
    use_fully_onboarded: bool = True
) -> SyncOperation:
    """
    Execute synchronization from Zoho CRM to Payment App

    Args:
        module: Zoho module name ("Contacts" or "Leads")
        trigger_type: "manual" or "scheduled"
        db: Database session
        use_fully_onboarded: If True, only sync records where LL_Onboarding_Status = "Fully Onboarded"
                            This ensures only completed onboarding records are synced

    Returns:
        SyncOperation record with results
    """
    start_time = time.time()

    # Create sync operation record
    sync_op = SyncOperation(
        id=f"sync_{int(datetime.utcnow().timestamp() * 1000)}",
        trigger_type=trigger_type,
        status=SyncStatus.running
    )
    db.add(sync_op)
    db.commit()
    db.refresh(sync_op)

    logger = SyncLogger(sync_op, db)

    try:
        logger.info(f"Starting sync from Zoho {module} module")

        # Apply rate limiting
        zoho_rate_limiter.wait_if_needed()

        # Fetch records with "Pending Sync" status
        logger.info("Fetching records with 'Pending Sync' status")

        # Build criteria to filter records
        criteria_parts = ["(Sync_to_Payment_App:equals:Pending Sync)"]

        # Add Candidate Onboarding Status filter if requested
        # Only sync contacts where LL_Onboarding_Status = "Fully Onboarded"
        if use_fully_onboarded:
            criteria_parts.append("(LL_Onboarding_Status:equals:Fully Onboarded)")
            logger.info("Filtering for fully onboarded records only (LL_Onboarding_Status = 'Fully Onboarded')")

        # Combine criteria with AND
        criteria = "and".join(criteria_parts) if len(criteria_parts) > 1 else criteria_parts[0]

        candidates = zoho_client.get_all_records(
            module_name=module,
            criteria=criteria
        )

        sync_op.total_fetched = len(candidates)
        db.commit()

        logger.info(f"Fetched {len(candidates)} records from Zoho", details={
            "module": module,
            "criteria": criteria,
            "count": len(candidates)
        })

        if not candidates:
            sync_op.status = SyncStatus.completed
            sync_op.completed_at = datetime.utcnow()
            sync_op.duration_seconds = time.time() - start_time
            db.commit()
            logger.info("No records found with 'Pending Sync' status. Sync completed.")
            return sync_op

        # Process and import records
        logger.info(f"Processing {len(candidates)} records")

        result = process_interpreter_import(candidates, db, update_existing=True)

        sync_op.total_created = len(result["created"])
        sync_op.total_updated = len(result["updated"])
        sync_op.total_skipped = len(result["skipped"])
        sync_op.total_errors = len(result["errors"])
        db.commit()

        # Log detailed results
        for interpreter in result["created"]:
            logger.info(f"Created new interpreter: {interpreter.contact_name}",
                       interpreter_id=interpreter.id,
                       record_id=interpreter.record_id)

        for interpreter in result["updated"]:
            logger.info(f"Updated interpreter: {interpreter.contact_name}",
                       interpreter_id=interpreter.id,
                       record_id=interpreter.record_id)

        for skip in result["skipped"]:
            logger.warning(f"Skipped record: {skip.get('email')} - {skip.get('reason')}",
                          details=skip)

        for error in result["errors"]:
            logger.error(f"Error processing record: {error.get('record_id')} - {error.get('error')}",
                        record_id=error.get('record_id'),
                        details=error)

        # Update Zoho records to mark as "Synced"
        logger.info("Updating Zoho records to mark as 'Synced'")

        successfully_synced = []
        sync_errors = []

        # Collect all successfully processed records
        processed_record_ids = []
        for interpreter in result["created"] + result["updated"]:
            if interpreter.record_id:
                processed_record_ids.append(interpreter.record_id)

        # Update records in batches of 100 (Zoho's limit)
        batch_size = 100
        for i in range(0, len(processed_record_ids), batch_size):
            batch_ids = processed_record_ids[i:i+batch_size]

            # Apply rate limiting
            zoho_rate_limiter.wait_if_needed()

            try:
                # Prepare update payload
                update_data = []
                for record_id in batch_ids:
                    update_data.append({
                        "id": record_id,
                        "Sync_to_Payment_App": "Synced"
                    })

                # Bulk update
                response = zoho_client.bulk_update_records(module, update_data)

                # Check results
                data = response.get("data", [])
                for item in data:
                    if item.get("code") == "SUCCESS":
                        successfully_synced.append(item.get("details", {}).get("id"))
                    else:
                        sync_errors.append({
                            "id": item.get("details", {}).get("id"),
                            "error": item.get("message")
                        })
                        logger.error(f"Failed to update Zoho record to 'Synced'",
                                   record_id=item.get("details", {}).get("id"),
                                   details={"error": item.get("message")})

            except Exception as e:
                logger.error(f"Error updating batch to Zoho: {str(e)}",
                           details={"batch_ids": batch_ids, "error": str(e)})
                for record_id in batch_ids:
                    sync_errors.append({
                        "id": record_id,
                        "error": str(e)
                    })

        sync_op.total_synced_to_zoho = len(successfully_synced)
        db.commit()

        logger.info(f"Successfully marked {len(successfully_synced)} records as 'Synced' in Zoho")
        if sync_errors:
            logger.warning(f"Failed to update {len(sync_errors)} records in Zoho", details={
                "errors": sync_errors
            })

        # Mark sync as completed or partial
        if sync_errors or result["errors"]:
            sync_op.status = SyncStatus.partial
        else:
            sync_op.status = SyncStatus.completed

        sync_op.completed_at = datetime.utcnow()
        sync_op.duration_seconds = time.time() - start_time
        db.commit()

        logger.info(f"Sync completed with status: {sync_op.status.value}", details={
            "fetched": sync_op.total_fetched,
            "created": sync_op.total_created,
            "updated": sync_op.total_updated,
            "skipped": sync_op.total_skipped,
            "errors": sync_op.total_errors,
            "synced_to_zoho": sync_op.total_synced_to_zoho,
            "duration": sync_op.duration_seconds
        })

        return sync_op

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()

        sync_op.status = SyncStatus.failed
        sync_op.error_message = str(e)
        sync_op.error_details = error_details
        sync_op.completed_at = datetime.utcnow()
        sync_op.duration_seconds = time.time() - start_time
        db.commit()

        logger.error(f"Sync failed with exception: {str(e)}", details={
            "error": str(e),
            "traceback": error_details
        })

        return sync_op


def test_sync_single_record(
    module: str,
    record_id: Optional[str],
    email: Optional[str],
    db: Session
) -> Dict:
    """
    Test synchronization with a single record

    Args:
        module: Zoho module name ("Contacts" or "Leads")
        record_id: Record ID to fetch (optional)
        email: Email address to search for (optional)
        db: Database session

    Returns:
        Dictionary with test results
    """
    start_time = time.time()
    result = {
        "success": False,
        "record_fetched": None,
        "action_taken": None,
        "interpreter_id": None,
        "changes_detected": [],
        "zoho_updated": False,
        "error": None,
        "duration_seconds": 0
    }

    try:
        # Validate that at least one identifier is provided
        if not record_id and not email:
            result["error"] = "Either record_id or email must be provided"
            return result

        # Apply rate limiting
        zoho_rate_limiter.wait_if_needed()

        # Fetch the record
        record = None

        if record_id:
            # Fetch by ID
            try:
                response = zoho_client.get_records(module_name=module, page=1, per_page=1)
                records = response.get("data", [])
                # Find the specific record by ID
                for r in records:
                    if r.get("id") == record_id:
                        record = r
                        break

                # If not found in first page, try direct search
                if not record:
                    # Try to get all records and filter (for test mode this is acceptable)
                    all_records = zoho_client.get_all_records(module_name=module, max_records=1000)
                    for r in all_records:
                        if r.get("id") == record_id:
                            record = r
                            break

            except Exception as e:
                result["error"] = f"Failed to fetch record by ID: {str(e)}"
                return result

        elif email:
            # Search by email
            try:
                zoho_rate_limiter.wait_if_needed()
                records = zoho_client.search_records(module_name=module, email=email)
                if records:
                    record = records[0]
            except Exception as e:
                result["error"] = f"Failed to search by email: {str(e)}"
                return result

        if not record:
            result["error"] = f"No record found with {'ID: ' + record_id if record_id else 'email: ' + email}"
            return result

        result["record_fetched"] = {
            "id": record.get("id"),
            "email": record.get("Email"),
            "contact_name": record.get("Contact_Name") or record.get("Full_Name"),
            "sync_status": record.get("Sync_to_Payment_App")
        }

        # Map to interpreter format
        from utils import map_zoho_contact_to_interpreter
        interpreter_data = map_zoho_contact_to_interpreter(record)

        # Check if interpreter already exists
        from models import Interpreter
        existing = None

        if interpreter_data.get("email"):
            existing = db.query(Interpreter).filter(Interpreter.email == interpreter_data["email"]).first()

        if not existing and interpreter_data.get("employee_id"):
            existing = db.query(Interpreter).filter(Interpreter.employee_id == interpreter_data["employee_id"]).first()

        if existing:
            # Check for changes
            from utils import has_changes, get_changed_fields
            if has_changes(existing, interpreter_data):
                changed_fields = get_changed_fields(existing, interpreter_data)
                result["changes_detected"] = list(changed_fields.keys())

                # Update the record
                for key, value in changed_fields.items():
                    setattr(existing, key, value)

                existing.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(existing)

                result["action_taken"] = "updated"
                result["interpreter_id"] = existing.id
            else:
                result["action_taken"] = "skipped_no_changes"
                result["interpreter_id"] = existing.id
        else:
            # Create new interpreter
            new_interpreter = Interpreter(
                id=f"int_{int(datetime.utcnow().timestamp() * 1000)}",
                **interpreter_data
            )
            db.add(new_interpreter)
            db.commit()
            db.refresh(new_interpreter)

            result["action_taken"] = "created"
            result["interpreter_id"] = new_interpreter.id

        # Update Zoho record to "Synced"
        if result["action_taken"] in ["created", "updated"]:
            try:
                zoho_rate_limiter.wait_if_needed()
                zoho_client.update_record(
                    module_name=module,
                    record_id=record.get("id"),
                    data={"Sync_to_Payment_App": "Synced"}
                )
                result["zoho_updated"] = True
            except Exception as e:
                result["error"] = f"Database updated but failed to update Zoho: {str(e)}"

        result["success"] = True
        result["duration_seconds"] = time.time() - start_time

        return result

    except Exception as e:
        import traceback
        result["error"] = f"Test sync failed: {str(e)}"
        result["error_details"] = traceback.format_exc()
        result["duration_seconds"] = time.time() - start_time
        return result
