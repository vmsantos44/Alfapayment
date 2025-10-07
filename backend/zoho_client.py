import os
import threading
import requests
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class ZohoCRMClient:
    """Client for interacting with Zoho CRM API"""

    # Data center endpoints
    DC_ENDPOINTS = {
        "US": "https://www.zohoapis.com",
        "EU": "https://www.zohoapis.eu",
        "IN": "https://www.zohoapis.in",
        "AU": "https://www.zohoapis.com.au",
        "JP": "https://www.zohoapis.jp",
        "CN": "https://www.zohoapis.com.cn"
    }

    SHEET_ENDPOINTS = {
        "US": "https://sheet.zoho.com",
        "EU": "https://sheet.zoho.eu",
        "IN": "https://sheet.zoho.in",
        "AU": "https://sheet.zoho.com.au",
        "JP": "https://sheet.zoho.jp",
        "CN": "https://sheet.zoho.com.cn"
    }

    AUTH_ENDPOINTS = {
        "US": "https://accounts.zoho.com",
        "EU": "https://accounts.zoho.eu",
        "IN": "https://accounts.zoho.in",
        "AU": "https://accounts.zoho.com.au",
        "JP": "https://accounts.zoho.jp",
        "CN": "https://accounts.zoho.com.cn"
    }

    def __init__(self):
        self.client_id = os.getenv("ZOHO_CLIENT_ID")
        self.client_secret = os.getenv("ZOHO_CLIENT_SECRET")
        self.refresh_token = os.getenv("ZOHO_REFRESH_TOKEN")
        self.region = os.getenv("ZOHO_REGION", "US")
        self.module_name = os.getenv("ZOHO_CRM_MODULE", "CRM_Candidates_Consolidated")
        self.sheet_id = os.getenv("ZOHO_SHEET_ID", "tdar2201260c19806490a9eac0aa6e771d83e")

        self.api_base = self.DC_ENDPOINTS.get(self.region)
        self.sheet_base = self.SHEET_ENDPOINTS.get(self.region)
        self.auth_base = self.AUTH_ENDPOINTS.get(self.region)

        self.access_token = None
        self.token_expiry = None
        self._token_lock = threading.Lock()

    def _is_token_valid(self) -> bool:
        """Check if current access token is still valid"""
        if not self.access_token or not self.token_expiry:
            return False
        # Add 5 minute buffer before expiry
        return datetime.now() < (self.token_expiry - timedelta(minutes=5))

    def _get_access_token(self) -> str:
        """Get a new access token using refresh token (thread-safe)"""
        # First check without lock (fast path)
        if self._is_token_valid():
            return self.access_token

        # Need to refresh - acquire lock
        with self._token_lock:
            # Double-check after acquiring lock (another thread may have refreshed)
            if self._is_token_valid():
                return self.access_token

            url = f"{self.auth_base}/oauth/v2/token"
            params = {
                "refresh_token": self.refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token"
            }

            try:
                response = requests.post(url, params=params)
                response.raise_for_status()

                data = response.json()

                if "access_token" not in data:
                    raise Exception(f"No access_token in response: {data}")

                self.access_token = data["access_token"]
                # Access tokens are valid for 1 hour
                self.token_expiry = datetime.now() + timedelta(seconds=data.get("expires_in", 3600))

                return self.access_token
            except requests.exceptions.HTTPError as e:
                error_msg = f"HTTP error during token refresh: {e.response.text if hasattr(e, 'response') else str(e)}"
                raise Exception(error_msg)
            except Exception as e:
                raise Exception(f"Token refresh failed: {str(e)}")

    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make an authenticated request to Zoho CRM API"""
        access_token = self._get_access_token()

        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Zoho-oauthtoken {access_token}"

        url = f"{self.api_base}{endpoint}"
        response = requests.request(method, url, headers=headers, **kwargs)
        response.raise_for_status()

        return response.json()

    def get_records(
        self,
        module_name: Optional[str] = None,
        fields: Optional[str] = None,
        page: int = 1,
        per_page: int = 200,
        criteria: Optional[str] = None
    ) -> Dict:
        """
        Get records from a Zoho CRM module

        Args:
            module_name: Name of the module (defaults to CRM_Candidates_Consolidated)
            fields: Comma-separated field names to retrieve
            page: Page number (starts at 1)
            per_page: Number of records per page (max 200)
            criteria: COQL criteria for filtering (e.g., "(Status:equals:Active)")

        Returns:
            Dictionary containing records and metadata
        """
        module = module_name or self.module_name
        endpoint = f"/crm/v2/{module}"

        params = {
            "page": page,
            "per_page": min(per_page, 200)  # Max 200 per page
        }

        if fields:
            params["fields"] = fields

        if criteria:
            params["criteria"] = criteria

        return self._make_request("GET", endpoint, params=params)

    def get_all_records(
        self,
        module_name: Optional[str] = None,
        fields: Optional[List[str]] = None,
        criteria: Optional[str] = None,
        max_records: Optional[int] = None
    ) -> List[Dict]:
        """
        Get all records from a module (handles pagination)

        Args:
            module_name: Name of the module
            fields: List of field API names to retrieve
            criteria: COQL criteria for filtering
            max_records: Maximum number of records to retrieve (None for all)

        Returns:
            List of all records
        """
        all_records = []
        page = 1

        while True:
            response = self.get_records(
                module_name=module_name,
                fields=fields,
                page=page,
                criteria=criteria
            )

            records = response.get("data", [])
            if not records:
                break

            all_records.extend(records)

            # Check if we've reached max_records
            if max_records and len(all_records) >= max_records:
                all_records = all_records[:max_records]
                break

            # Check if there are more pages
            info = response.get("info", {})
            if not info.get("more_records", False):
                break

            page += 1

        return all_records

    def get_modules(self) -> List[Dict]:
        """Get all available modules"""
        endpoint = "/crm/v2/settings/modules"
        response = self._make_request("GET", endpoint)
        return response.get("modules", [])

    def get_module_fields(self, module_name: Optional[str] = None) -> List[Dict]:
        """Get field metadata for a module"""
        module = module_name or self.module_name
        endpoint = f"/crm/v2/settings/fields"
        params = {"module": module}

        response = self._make_request("GET", endpoint, params=params)
        return response.get("fields", [])

    def search_records(
        self,
        module_name: Optional[str] = None,
        criteria: str = None,
        email: str = None,
        phone: str = None,
        word: str = None,
        per_page: int = 200
    ) -> List[Dict]:
        """
        Search for records using various criteria

        Args:
            module_name: Name of the module
            criteria: Search criteria (e.g., "(Contact_Name:equals:John)")
            email: Search by email
            phone: Search by phone
            word: Search by keyword
            per_page: Number of results per page (max 200)

        Returns:
            List of matching records
        """
        module = module_name or self.module_name
        endpoint = f"/crm/v8/{module}/search"

        params = {
            "per_page": min(per_page, 200)
        }

        if criteria:
            params["criteria"] = criteria
        if email:
            params["email"] = email
        if phone:
            params["phone"] = phone
        if word:
            params["word"] = word

        try:
            response = self._make_request("GET", endpoint, params=params)
            return response.get("data", [])
        except Exception as e:
            # If search fails, return empty list instead of crashing
            print(f"Search failed with criteria: {criteria}, error: {e}")
            return []

    def update_record(
        self,
        module_name: str,
        record_id: str,
        data: Dict
    ) -> Dict:
        """
        Update a single record in Zoho CRM

        Args:
            module_name: Name of the module (e.g., "Contacts", "Leads")
            record_id: ID of the record to update
            data: Dictionary with field names and values to update

        Returns:
            Response from Zoho API
        """
        endpoint = f"/crm/v2/{module_name}/{record_id}"

        payload = {
            "data": [data]
        }

        return self._make_request("PUT", endpoint, json=payload)

    def bulk_update_records(
        self,
        module_name: str,
        records: List[Dict]
    ) -> Dict:
        """
        Bulk update multiple records in Zoho CRM

        Args:
            module_name: Name of the module
            records: List of dictionaries, each with 'id' and fields to update

        Returns:
            Response from Zoho API with update results
        """
        endpoint = f"/crm/v2/{module_name}"

        payload = {
            "data": records
        }

        return self._make_request("PUT", endpoint, json=payload)

    def get_sheet_data(self, sheet_id: Optional[str] = None, worksheet_id: int = 1) -> List[Dict]:
        """
        Get all data from a Zoho Sheet as CSV then parse to JSON

        Args:
            sheet_id: Sheet resource ID (defaults to configured ZOHO_SHEET_ID)
            worksheet_id: Worksheet/tab ID (default 1)

        Returns:
            List of dictionaries (one per row, with column headers as keys)
        """
        sheet = sheet_id or self.sheet_id
        access_token = self._get_access_token()

        # Use the Sheet export API to get CSV data
        url = f"{self.sheet_base}/api/v2/{sheet}/worksheets/{worksheet_id}/export"

        headers = {
            "Authorization": f"Zoho-oauthtoken {access_token}"
        }

        params = {
            "format": "csv"
        }

        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()

            # Parse CSV to list of dicts
            import csv
            import io

            csv_data = response.text
            reader = csv.DictReader(io.StringIO(csv_data))
            records = list(reader)

            return records

        except Exception as e:
            print(f"Failed to fetch sheet data: {e}")
            return []


# Singleton instance
zoho_client = ZohoCRMClient()
