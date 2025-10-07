"""
Background task handlers for long-running operations
"""

from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from collections import OrderedDict
import threading
import logging

from database import get_db
from zoho_client import zoho_client
from utils import process_interpreter_import
from rate_limiter import zoho_rate_limiter

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store import job status in memory (in production, use Redis or database)
# Using OrderedDict to maintain insertion order for efficient cleanup
import_jobs: OrderedDict = OrderedDict()
import_jobs_lock = threading.Lock()

# Configuration for job retention
MAX_JOBS_RETENTION = 100  # Maximum number of jobs to keep in memory
JOB_TTL_HOURS = 24  # Jobs older than this are deleted


def cleanup_old_jobs():
    """
    Remove old completed/failed jobs to prevent memory leak.
    Keeps only the most recent MAX_JOBS_RETENTION jobs and removes jobs older than JOB_TTL_HOURS.
    """
    with import_jobs_lock:
        if len(import_jobs) <= MAX_JOBS_RETENTION:
            return

        # Calculate cutoff time
        cutoff_time = datetime.utcnow() - timedelta(hours=JOB_TTL_HOURS)

        # Remove old jobs (iterate over copy to avoid modification during iteration)
        jobs_to_remove = []
        for job_id, job_data in list(import_jobs.items()):
            job_timestamp = job_data.get("timestamp")
            job_status = job_data.get("status")

            # Remove if job is old and completed/failed
            if job_timestamp and job_status in ["completed", "failed"]:
                if job_timestamp < cutoff_time:
                    jobs_to_remove.append(job_id)

        for job_id in jobs_to_remove:
            del import_jobs[job_id]
            logger.info(f"Cleaned up old job: {job_id}")

        # If still over limit, remove oldest completed/failed jobs
        if len(import_jobs) > MAX_JOBS_RETENTION:
            jobs_by_status = [(k, v) for k, v in import_jobs.items()
                             if v.get("status") in ["completed", "failed"]]

            excess_count = len(import_jobs) - MAX_JOBS_RETENTION
            for i in range(min(excess_count, len(jobs_by_status))):
                job_id = jobs_by_status[i][0]
                del import_jobs[job_id]
                logger.info(f"Cleaned up excess job: {job_id}")


def get_job_status(job_id: str) -> Optional[Dict]:
    """
    Thread-safe getter for job status with automatic cleanup.

    Args:
        job_id: Job identifier

    Returns:
        Job status dictionary or None if not found
    """
    cleanup_old_jobs()

    with import_jobs_lock:
        return import_jobs.get(job_id)


def set_job_status(job_id: str, status_data: Dict):
    """
    Thread-safe setter for job status.

    Args:
        job_id: Job identifier
        status_data: Status information dictionary
    """
    with import_jobs_lock:
        # Add timestamp if not present
        if "timestamp" not in status_data:
            status_data["timestamp"] = datetime.utcnow()

        import_jobs[job_id] = status_data


def background_import_zoho_candidates(
    job_id: str,
    max_records: Optional[int],
    update_existing: bool,
    onboarding_status: str,
    language: Optional[str],
    service_location: Optional[str]
):
    """
    Background task to import candidates from Zoho CRM

    Args:
        job_id: Unique identifier for this import job
        max_records: Maximum number of records to import
        update_existing: Whether to update existing interpreters
        onboarding_status: Filter by LL_Onboarding_Status
        language: Optional filter by Language field
        service_location: Optional filter by Service_Location field
    """
    # Update job status
    set_job_status(job_id, {
        "status": "in_progress",
        "progress": 0,
        "message": "Fetching candidates from Zoho CRM...",
        "results": None,
        "error": None
    })

    try:
        # Apply rate limiting
        zoho_rate_limiter.wait_if_needed()

        # Build criteria string for Zoho API filtering
        criteria_parts = []

        if onboarding_status:
            criteria_parts.append(f"(LL_Onboarding_Status:equals:{onboarding_status})")

        if language:
            criteria_parts.append(f"(Language:equals:{language})")

        if service_location:
            criteria_parts.append(f"(Service_Location:equals:{service_location})")

        criteria = "and".join(criteria_parts) if criteria_parts else None

        # Fetch filtered candidates from Zoho Contacts module
        logger.info(f"Job {job_id}: Fetching candidates with criteria: {criteria}")
        candidates = zoho_client.get_all_records(
            module_name="Contacts",
            criteria=criteria,
            max_records=max_records
        )

        if not candidates:
            set_job_status(job_id, {
                "status": "completed",
                "progress": 100,
                "message": "No candidates found in Zoho CRM",
                "results": {"total": 0, "created": 0, "updated": 0, "skipped": 0, "errors": 0},
                "error": None
            })
            return

        # Update progress
        current_status = get_job_status(job_id) or {}
        current_status["progress"] = 30
        current_status["message"] = f"Processing {len(candidates)} candidates..."
        set_job_status(job_id, current_status)

        # Get database session
        db = next(get_db())

        try:
            # Process imports using helper function
            logger.info(f"Job {job_id}: Processing {len(candidates)} candidates")
            result = process_interpreter_import(candidates, db, update_existing)

            # Update progress
            current_status = get_job_status(job_id) or {}
            current_status["progress"] = 80
            current_status["message"] = "Saving to database..."
            set_job_status(job_id, current_status)

            # Commit all changes
            db.commit()

            # Refresh created and updated interpreters
            for interp in result["created"] + result["updated"]:
                db.refresh(interp)

            # Update job status to completed
            set_job_status(job_id, {
                "status": "completed",
                "progress": 100,
                "message": f"Successfully imported {len(result['created'])} and updated {len(result['updated'])} interpreters",
                "results": {
                    "total": len(candidates),
                    "created": len(result["created"]),
                    "updated": len(result["updated"]),
                    "skipped": len(result["skipped"]),
                    "errors": len(result["errors"])
                },
                "error": None
            })

            logger.info(f"Job {job_id}: Completed successfully")

        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Job {job_id}: Failed with error: {str(e)}")
        set_job_status(job_id, {
            "status": "failed",
            "progress": 0,
            "message": f"Import failed: {str(e)}",
            "results": None,
            "error": str(e)
        })
