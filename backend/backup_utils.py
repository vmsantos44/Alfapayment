"""
Backup and restore utilities for safe data operations
"""

import json
import os
from datetime import datetime
from typing import Dict, List
from sqlalchemy.orm import Session
import logging

from models import Interpreter

logger = logging.getLogger(__name__)

BACKUP_DIR = "backups"


def ensure_backup_dir():
    """Ensure backup directory exists"""
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        logger.info(f"Created backup directory: {BACKUP_DIR}")


def create_interpreter_backup(db: Session) -> Dict:
    """
    Create a complete backup of all interpreter records

    Args:
        db: Database session

    Returns:
        Dictionary with backup metadata and file path
    """
    ensure_backup_dir()

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"interpreter_backup_{timestamp}.json"
    filepath = os.path.join(BACKUP_DIR, filename)

    # Fetch all interpreters
    interpreters = db.query(Interpreter).all()

    # Convert to serializable format
    backup_data = {
        "backup_timestamp": timestamp,
        "backup_datetime": datetime.utcnow().isoformat(),
        "total_records": len(interpreters),
        "records": []
    }

    for interp in interpreters:
        record = {
            "id": interp.id,
            "record_id": interp.record_id,
            "last_name": interp.last_name,
            "employee_id": interp.employee_id,
            "cloudbreak_id": interp.cloudbreak_id,
            "languagelink_id": interp.languagelink_id,
            "propio_id": interp.propio_id,
            "contact_name": interp.contact_name,
            "email": interp.email,
            "language": interp.language,
            "payment_frequency": interp.payment_frequency,
            "service_location": interp.service_location,
            "onboarding_status": interp.onboarding_status,
            "rate_per_minute": interp.rate_per_minute,
            "rate_per_hour": interp.rate_per_hour,
            "created_at": interp.created_at.isoformat() if interp.created_at else None,
            "updated_at": interp.updated_at.isoformat() if interp.updated_at else None
        }
        backup_data["records"].append(record)

    # Write to file
    with open(filepath, 'w') as f:
        json.dump(backup_data, f, indent=2)

    logger.info(f"Created backup: {filepath} with {len(interpreters)} records")

    return {
        "success": True,
        "filepath": filepath,
        "filename": filename,
        "timestamp": timestamp,
        "total_records": len(interpreters),
        "file_size_bytes": os.path.getsize(filepath)
    }


def list_backups() -> List[Dict]:
    """
    List all available backups

    Returns:
        List of backup metadata dictionaries
    """
    ensure_backup_dir()

    backups = []
    for filename in os.listdir(BACKUP_DIR):
        if filename.startswith("interpreter_backup_") and filename.endswith(".json"):
            filepath = os.path.join(BACKUP_DIR, filename)
            file_stats = os.stat(filepath)

            # Try to read backup metadata
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    total_records = data.get("total_records", 0)
            except:
                total_records = 0

            backups.append({
                "filename": filename,
                "filepath": filepath,
                "created_at": datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                "size_bytes": file_stats.st_size,
                "total_records": total_records
            })

    # Sort by creation time (newest first)
    backups.sort(key=lambda x: x["created_at"], reverse=True)

    return backups


def restore_from_backup(db: Session, filename: str) -> Dict:
    """
    Restore interpreters from a backup file

    Args:
        db: Database session
        filename: Backup filename

    Returns:
        Dictionary with restoration results
    """
    filepath = os.path.join(BACKUP_DIR, filename)

    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Backup file not found: {filename}")

    # Load backup data
    with open(filepath, 'r') as f:
        backup_data = json.load(f)

    records = backup_data.get("records", [])
    restored = 0
    skipped = 0
    errors = []

    for record in records:
        try:
            # Check if interpreter already exists
            existing = db.query(Interpreter).filter(Interpreter.id == record["id"]).first()

            if existing:
                skipped += 1
                continue

            # Create new interpreter
            new_interp = Interpreter(
                id=record["id"],
                record_id=record.get("record_id"),
                last_name=record.get("last_name"),
                employee_id=record.get("employee_id"),
                cloudbreak_id=record.get("cloudbreak_id"),
                languagelink_id=record.get("languagelink_id"),
                propio_id=record.get("propio_id"),
                contact_name=record.get("contact_name"),
                email=record.get("email"),
                language=record.get("language"),
                payment_frequency=record.get("payment_frequency"),
                service_location=record.get("service_location"),
                onboarding_status=record.get("onboarding_status"),
                rate_per_minute=record.get("rate_per_minute"),
                rate_per_hour=record.get("rate_per_hour")
            )

            db.add(new_interp)
            restored += 1

        except Exception as e:
            errors.append({
                "record_id": record.get("id"),
                "error": str(e)
            })

    db.commit()

    logger.info(f"Restored {restored} records from backup: {filename}")

    return {
        "success": True,
        "backup_file": filename,
        "total_in_backup": len(records),
        "restored": restored,
        "skipped": skipped,
        "errors": len(errors),
        "error_details": errors
    }


def clear_all_interpreters(db: Session) -> Dict:
    """
    DANGEROUS: Clear all interpreter records from database

    Args:
        db: Database session

    Returns:
        Dictionary with deletion results
    """
    # Count records before deletion
    count_before = db.query(Interpreter).count()

    # Delete all records
    db.query(Interpreter).delete()
    db.commit()

    count_after = db.query(Interpreter).count()

    logger.warning(f"Cleared {count_before} interpreter records from database")

    return {
        "success": True,
        "deleted_count": count_before,
        "remaining_count": count_after
    }
