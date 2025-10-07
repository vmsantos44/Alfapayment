"""
Utility functions for Alfa Payment System
"""

from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from datetime import datetime
import requests
import csv
import io

from models import Interpreter


def has_changes(existing: Interpreter, new_data: Dict) -> bool:
    """
    Check if there are any changes between existing interpreter and new data

    Args:
        existing: Existing Interpreter model instance
        new_data: Dictionary with new interpreter data

    Returns:
        True if there are changes, False otherwise
    """
    # List of fields to check for changes
    fields_to_check = [
        'contact_name', 'last_name', 'email', 'employee_id',
        'cloudbreak_id', 'languagelink_id', 'propio_id',
        'language', 'country', 'payment_frequency', 'service_location',
        'onboarding_status', 'rate_per_minute', 'rate_per_hour'
    ]

    for field in fields_to_check:
        new_value = new_data.get(field)
        existing_value = getattr(existing, field, None)

        # Normalize None/""/empty values for comparison
        def normalize(val):
            if val is None or val == "" or str(val).lower() == "none":
                return None
            return str(val).strip()

        normalized_new = normalize(new_value)
        normalized_existing = normalize(existing_value)

        # If values differ, there's a change
        if normalized_new != normalized_existing:
            return True

    return False


def get_changed_fields(existing: Interpreter, new_data: Dict) -> Dict[str, Any]:
    """
    Get only the fields that have changed

    Args:
        existing: Existing Interpreter model instance
        new_data: Dictionary with new interpreter data

    Returns:
        Dictionary containing only changed fields
    """
    changed = {}

    fields_to_check = [
        'contact_name', 'last_name', 'email', 'employee_id',
        'cloudbreak_id', 'languagelink_id', 'propio_id',
        'language', 'country', 'payment_frequency', 'service_location',
        'onboarding_status', 'rate_per_minute', 'rate_per_hour', 'record_id'
    ]

    for field in fields_to_check:
        new_value = new_data.get(field)
        existing_value = getattr(existing, field, None)

        # Normalize None/""/empty values for comparison
        def normalize(val):
            if val is None or val == "" or str(val).lower() == "none":
                return None
            return str(val).strip() if val is not None else None

        normalized_new = normalize(new_value)
        normalized_existing = normalize(existing_value)

        # If values differ, include in changed fields (allow clearing with blank values)
        if normalized_new != normalized_existing:
            changed[field] = new_value

    return changed


def map_zoho_contact_to_interpreter(candidate: Dict) -> Dict:
    """
    Map Zoho Contact fields to Interpreter model fields

    Args:
        candidate: Dictionary containing Zoho Contact data

    Returns:
        Dictionary with mapped interpreter data
    """
    # Helper to convert rate to string, avoiding "None" strings
    def clean_rate(value):
        if value is None or value == "" or str(value).lower() == "none":
            return ""
        return str(value)

    return {
        "record_id": candidate.get("id"),
        "contact_name": candidate.get("Full_Name") or "Unknown",
        "last_name": candidate.get("Last_Name"),
        "email": candidate.get("Email"),
        "employee_id": (
            candidate.get("Emplyee_ID") or
            candidate.get("Emp_ID") or
            candidate.get("Employee_ID") or
            candidate.get("Interpreter_ID")
        ),
        "cloudbreak_id": candidate.get("Cloudbreak_ID"),
        "languagelink_id": candidate.get("Languagelink_ID") or candidate.get("LanguageLink_ID"),
        "propio_id": candidate.get("Propio_ID"),
        "language": candidate.get("Language") or candidate.get("Native_Language"),
        "country": candidate.get("Mailing_Country") or candidate.get("Country"),
        "payment_frequency": candidate.get("Payment_Frequency"),
        "service_location": (
            candidate.get("Service_Location") or
            candidate.get("Work_Location") or
            candidate.get("Job_Scheduling") or
            ""
        ),
        "onboarding_status": candidate.get("LL_Onboarding_Status"),
        "rate_per_minute": clean_rate(candidate.get("Agreed_Rate")),
        "rate_per_hour": clean_rate(candidate.get("Rate_Hour"))  # From Rate/Hour column in spreadsheet
    }


def process_interpreter_import(
    candidates: List[Dict],
    db: Session,
    update_existing: bool = True
) -> Dict:
    """
    Process import of interpreter candidates from Zoho

    Args:
        candidates: List of candidate dictionaries
        db: Database session
        update_existing: Whether to update existing interpreters

    Returns:
        Dictionary with import results (created, updated, skipped, errors)
    """
    created = []
    updated = []
    skipped = []
    errors = []

    id_counter = 0

    for candidate in candidates:
        try:
            # Map Zoho fields to Interpreter fields
            interpreter_data = map_zoho_contact_to_interpreter(candidate)

            # Remove None values
            interpreter_data = {k: v for k, v in interpreter_data.items() if v is not None}

            # Validate required fields
            if not interpreter_data.get("contact_name"):
                errors.append({
                    "record_id": candidate.get("id"),
                    "error": "Missing required field: contact_name"
                })
                continue

            # Check for existing interpreter by record_id, email, or employee_id
            existing = None

            # First try record_id (most reliable unique identifier)
            if interpreter_data.get("record_id"):
                existing = db.query(Interpreter).filter(
                    Interpreter.record_id == interpreter_data["record_id"]
                ).first()

            # Fallback to email
            if not existing and interpreter_data.get("email"):
                existing = db.query(Interpreter).filter(
                    Interpreter.email == interpreter_data["email"]
                ).first()

            # Fallback to employee_id
            if not existing and interpreter_data.get("employee_id"):
                existing = db.query(Interpreter).filter(
                    Interpreter.employee_id == interpreter_data["employee_id"]
                ).first()

            if existing:
                if update_existing:
                    # Check if there are any changes
                    if has_changes(existing, interpreter_data):
                        # Get only changed fields
                        changed_fields = get_changed_fields(existing, interpreter_data)

                        # Update only changed fields
                        for key, value in changed_fields.items():
                            setattr(existing, key, value)

                        updated.append(existing)
                    else:
                        # No changes detected, skip update
                        skipped.append({
                            "email": interpreter_data.get("email"),
                            "employee_id": interpreter_data.get("employee_id"),
                            "reason": "No changes detected"
                        })
                else:
                    skipped.append({
                        "email": interpreter_data.get("email"),
                        "employee_id": interpreter_data.get("employee_id"),
                        "reason": "Already exists"
                    })
            else:
                # Create new interpreter with unique ID
                new_interpreter = Interpreter(
                    id=f"{int(datetime.utcnow().timestamp() * 1000)}_{id_counter}",
                    **interpreter_data
                )
                db.add(new_interpreter)
                created.append(new_interpreter)
                id_counter += 1

        except Exception as e:
            errors.append({
                "record_id": candidate.get("id"),
                "error": str(e)
            })
            continue

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors
    }


def validate_import_data(data: Dict) -> Optional[str]:
    """
    Validate import request data

    Args:
        data: Dictionary with import parameters

    Returns:
        Error message if validation fails, None otherwise
    """
    # Validate max_records if provided
    max_records = data.get("max_records")
    if max_records is not None:
        if not isinstance(max_records, int) or max_records < 1:
            return "max_records must be a positive integer"
        if max_records > 1000:
            return "max_records cannot exceed 1000"

    # Validate language if provided
    language = data.get("language")
    if language is not None and not isinstance(language, str):
        return "language must be a string"

    # Validate service_location if provided
    service_location = data.get("service_location")
    if service_location is not None and not isinstance(service_location, str):
        return "service_location must be a string"

    return None


def fetch_zoho_interpreter_csv(csv_url: str) -> List[Dict]:
    """
    Fetch and parse interpreter data from Zoho Sheet CSV URL

    Args:
        csv_url: The Zoho Sheet CSV download URL

    Returns:
        List of dictionaries containing interpreter data

    Raises:
        Exception if fetch or parse fails
    """
    try:
        # Fetch CSV from URL
        response = requests.get(csv_url, timeout=30)
        response.raise_for_status()

        # Parse CSV
        csv_content = response.content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_content))

        interpreters = []
        for row in csv_reader:
            # Map Zoho CSV fields to our format (using same keys as Zoho CRM format)
            interpreter_data = {
                "Email": row.get("Email", "").strip(),
                "Full_Name": row.get("Full Name", "").strip(),
                "Mailing_Country": row.get("Mailing Country", "").strip(),
                "id": row.get("Record Id", "").strip(),  # Zoho Record ID
                "Language": row.get("Language", "").strip(),
                "Payment_Frequency": row.get("Payment frequency", "").strip(),
                "Languagelink_ID": row.get("Languagelink ID", "").strip(),
                "Propio_ID": row.get("Propio ID", "").strip(),
                "Service_Location": row.get("Service Location", "").strip(),
                "Agreed_Rate": row.get("Agreed Rate", "").strip(),
                "Rate_Hour": row.get("Rate/Hour", "").strip(),  # Hourly rate from spreadsheet
                "Cloudbreak_ID": row.get("Cloudbreak ID", "").strip(),
            }

            # Only add if we have at least a name or email
            if interpreter_data.get("Full_Name") or interpreter_data.get("Email"):
                interpreters.append(interpreter_data)

        return interpreters

    except requests.RequestException as e:
        raise Exception(f"Failed to fetch CSV from Zoho: {str(e)}")
    except csv.Error as e:
        raise Exception(f"Failed to parse CSV data: {str(e)}")
    except Exception as e:
        raise Exception(f"Unexpected error fetching Zoho data: {str(e)}")
