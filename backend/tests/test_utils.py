"""
Unit tests for utility functions
"""

import pytest
from utils import (
    map_zoho_contact_to_interpreter,
    validate_import_data,
    has_changes,
    get_changed_fields
)


class TestUtils:
    """Test suite for utility functions"""

    def test_map_zoho_contact_basic_fields(self):
        """Test mapping basic Zoho contact fields"""
        zoho_record = {
            "id": "zoho123",
            "Full_Name": "John Doe",
            "Email": "john@example.com",
            "Language": "Spanish",
            "Employee_ID": "EMP001"
        }

        result = map_zoho_contact_to_interpreter(zoho_record)

        assert result["record_id"] == "zoho123"
        assert result["contact_name"] == "John Doe"
        assert result["email"] == "john@example.com"
        assert result["language"] == "Spanish"
        assert result["employee_id"] == "EMP001"

    def test_map_zoho_contact_with_rates(self):
        """Test mapping Zoho contact with rate fields"""
        zoho_record = {
            "id": "zoho123",
            "Full_Name": "Jane Smith",
            "Email": "jane@example.com",
            "Agreed_Rate": "0.75"
        }

        result = map_zoho_contact_to_interpreter(zoho_record)

        # Both rate_per_minute and rate_per_hour use the same Agreed_Rate value
        assert result["rate_per_minute"] == "0.75"
        assert result["rate_per_hour"] == "0.75"

    def test_map_zoho_contact_with_client_ids(self):
        """Test mapping Zoho contact with various client IDs"""
        zoho_record = {
            "id": "zoho123",
            "Contact_Name": "Test User",
            "Cloudbreak_ID": "CB123",
            "LanguageLink_ID": "LL456",
            "Propio_ID": "PR789"
        }

        result = map_zoho_contact_to_interpreter(zoho_record)

        assert result["cloudbreak_id"] == "CB123"
        assert result["languagelink_id"] == "LL456"
        assert result["propio_id"] == "PR789"

    def test_map_zoho_contact_missing_fields(self):
        """Test mapping Zoho contact with missing optional fields"""
        zoho_record = {
            "id": "zoho123",
            "Contact_Name": "Minimal User"
        }

        result = map_zoho_contact_to_interpreter(zoho_record)

        assert result["record_id"] == "zoho123"
        assert result["contact_name"] == "Minimal User"
        assert result["email"] is None
        assert result["language"] is None

    def test_validate_import_data_valid(self):
        """Test validation of valid import data"""
        valid_data = [
            {
                "contact_name": "John Doe",
                "email": "john@example.com",
                "language": "Spanish"
            },
            {
                "contact_name": "Jane Smith",
                "email": "jane@example.com",
                "language": "French"
            }
        ]

        result = validate_import_data(valid_data)
        assert result["valid"] is True
        assert len(result["errors"]) == 0

    def test_validate_import_data_missing_required_fields(self):
        """Test validation with missing required fields"""
        invalid_data = [
            {
                "email": "john@example.com",
                "language": "Spanish"
                # Missing contact_name
            }
        ]

        result = validate_import_data(invalid_data)
        assert result["valid"] is False
        assert len(result["errors"]) > 0
        assert "contact_name" in result["errors"][0].lower()

    def test_has_changes_no_changes(self):
        """Test has_changes when there are no changes"""
        class MockInterpreter:
            contact_name = "John Doe"
            email = "john@example.com"
            language = "Spanish"

        existing = MockInterpreter()
        new_data = {
            "contact_name": "John Doe",
            "email": "john@example.com",
            "language": "Spanish"
        }

        assert has_changes(existing, new_data) is False

    def test_has_changes_with_changes(self):
        """Test has_changes when there are changes"""
        class MockInterpreter:
            contact_name = "John Doe"
            email = "john@example.com"
            language = "Spanish"

        existing = MockInterpreter()
        new_data = {
            "contact_name": "John Doe",
            "email": "newemail@example.com",  # Changed
            "language": "Spanish"
        }

        assert has_changes(existing, new_data) is True

    def test_get_changed_fields(self):
        """Test getting only changed fields"""
        class MockInterpreter:
            contact_name = "John Doe"
            email = "john@example.com"
            language = "Spanish"
            rate_per_minute = "0.50"

        existing = MockInterpreter()
        new_data = {
            "contact_name": "John Doe",  # Same
            "email": "newemail@example.com",  # Changed
            "language": "French",  # Changed
            "rate_per_minute": "0.50"  # Same
        }

        changed = get_changed_fields(existing, new_data)

        assert len(changed) == 2
        assert "email" in changed
        assert "language" in changed
        assert changed["email"] == "newemail@example.com"
        assert changed["language"] == "French"
        assert "contact_name" not in changed
        assert "rate_per_minute" not in changed

    def test_has_changes_handles_none_values(self):
        """Test has_changes correctly handles None values"""
        class MockInterpreter:
            contact_name = "John Doe"
            email = None
            language = "Spanish"

        existing = MockInterpreter()
        new_data = {
            "contact_name": "John Doe",
            "email": None,
            "language": "Spanish"
        }

        assert has_changes(existing, new_data) is False

    def test_get_changed_fields_from_none_to_value(self):
        """Test detecting change from None to actual value"""
        class MockInterpreter:
            contact_name = "John Doe"
            email = None

        existing = MockInterpreter()
        new_data = {
            "contact_name": "John Doe",
            "email": "new@example.com"
        }

        changed = get_changed_fields(existing, new_data)

        assert "email" in changed
        assert changed["email"] == "new@example.com"

    def test_map_zoho_contact_name_field(self):
        """Test mapping with Full_Name field"""
        record = {
            "id": "zoho1",
            "Full_Name": "John Doe"
        }
        result = map_zoho_contact_to_interpreter(record)
        assert result["contact_name"] == "John Doe"

    def test_map_zoho_contact_default_name(self):
        """Test default contact name when Full_Name is missing"""
        record = {
            "id": "zoho2"
        }
        result = map_zoho_contact_to_interpreter(record)
        assert result["contact_name"] == "Unknown"
