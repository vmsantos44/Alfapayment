import os
import threading
import requests
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class ZohoBooksClient:
    """Client for interacting with Zoho Books API"""

    # Data center endpoints
    BOOKS_ENDPOINTS = {
        "US": "https://www.zohoapis.com",
        "EU": "https://www.zohoapis.eu",
        "IN": "https://www.zohoapis.in",
        "AU": "https://www.zohoapis.com.au",
        "JP": "https://www.zohoapis.jp",
        "CN": "https://www.zohoapis.com.cn"
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
        self.organization_id = os.getenv("ZOHO_BOOKS_ORGANIZATION_ID")

        self.api_base = self.BOOKS_ENDPOINTS.get(self.region)
        self.auth_base = self.AUTH_ENDPOINTS.get(self.region)

        self.access_token = None
        self.token_expiry = None
        self._token_lock = threading.Lock()

        # Validate required credentials
        if not all([self.client_id, self.client_secret, self.refresh_token]):
            print("WARNING: Zoho Books credentials not fully configured")
        if not self.organization_id:
            print("WARNING: ZOHO_BOOKS_ORGANIZATION_ID not set. Get it from: https://books.zoho.com/app#/settings/organization")

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

    def _make_request(self, method: str, endpoint: str, organization_id: Optional[str] = None, **kwargs) -> Dict:
        """Make an authenticated request to Zoho Books API"""
        access_token = self._get_access_token()

        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Zoho-oauthtoken {access_token}"

        # Add organization_id to params if not already present
        # Priority: explicit parameter > existing params > default from env
        params = kwargs.get("params", {})
        if "organization_id" not in params:
            org_id = organization_id or self.organization_id
            if org_id:
                params["organization_id"] = org_id
                kwargs["params"] = params

        url = f"{self.api_base}{endpoint}"
        response = requests.request(method, url, headers=headers, **kwargs)
        response.raise_for_status()

        return response.json()

    # ============ ORGANIZATION ============

    def get_organizations(self) -> List[Dict]:
        """
        Get all organizations the user has access to
        This helps discover the organization_id needed for other API calls

        Returns:
            List of organization dictionaries with organization_id
        """
        access_token = self._get_access_token()

        headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}
        url = f"{self.api_base}/books/v3/organizations"

        response = requests.get(url, headers=headers)
        response.raise_for_status()

        data = response.json()
        return data.get("organizations", [])

    # ============ CHART OF ACCOUNTS ============

    def get_chart_of_accounts(self, account_type: Optional[str] = None) -> List[Dict]:
        """
        Get chart of accounts

        Args:
            account_type: Filter by account type (e.g., 'expense', 'income', 'asset')

        Returns:
            List of account dictionaries
        """
        endpoint = "/books/v3/chartofaccounts"
        params = {}

        if account_type:
            params["filter_by"] = f"AccountType.{account_type}"

        response = self._make_request("GET", endpoint, params=params)
        return response.get("chartofaccounts", [])

    def get_expense_accounts(self, search: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
        """
        Get all expense accounts for bill line items

        Args:
            search: Optional search term to filter accounts by name
            limit: Optional limit on number of results (for lazy loading)

        Returns:
            List of expense account dictionaries
        """
        all_accounts = self.get_chart_of_accounts()
        # Filter for expense-type accounts
        expense_types = [
            "expense", "manufacturing_expense", "impairment_expense",
            "depreciation_expense", "employee_benefit_expense", "lease_expense",
            "finance_expense", "tax_expense", "cost_of_goods_sold", "other_expense"
        ]
        expense_accounts = [
            acc for acc in all_accounts
            if acc.get("account_type", "").lower() in expense_types
        ]

        # Apply search filter if provided
        if search:
            search_lower = search.lower()
            expense_accounts = [
                acc for acc in expense_accounts
                if search_lower in acc.get("account_name", "").lower()
            ]

        # Apply limit if provided
        if limit:
            expense_accounts = expense_accounts[:limit]

        return expense_accounts

    # ============ CONTACTS (VENDORS) ============

    def get_contacts(self, contact_type: str = "vendor") -> List[Dict]:
        """
        Get all contacts of a specific type

        Args:
            contact_type: Type of contact ('vendor' or 'customer')

        Returns:
            List of contact dictionaries
        """
        endpoint = "/books/v3/contacts"
        params = {"contact_type": contact_type}

        response = self._make_request("GET", endpoint, params=params)
        return response.get("contacts", [])

    def get_contact_by_email(self, email: str) -> Optional[Dict]:
        """
        Search for a contact by email

        Args:
            email: Email address to search for

        Returns:
            Contact dictionary if found, None otherwise
        """
        endpoint = "/books/v3/contacts"
        params = {"email": email}

        try:
            response = self._make_request("GET", endpoint, params=params)
            contacts = response.get("contacts", [])
            return contacts[0] if contacts else None
        except:
            return None

    def create_vendor_contact(
        self,
        contact_name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        company_name: Optional[str] = None,
        payment_terms: int = 30,
        **kwargs
    ) -> Dict:
        """
        Create a new vendor contact

        Args:
            contact_name: Display name for the vendor
            email: Vendor email
            phone: Vendor phone
            company_name: Company name
            payment_terms: Payment terms in days (default 30)
            **kwargs: Additional fields (billing_address, currency_id, notes, etc.)

        Returns:
            Created contact dictionary
        """
        endpoint = "/books/v3/contacts"

        data = {
            "contact_name": contact_name,
            "contact_type": "vendor",
            "payment_terms": payment_terms,
            "payment_terms_label": f"Net {payment_terms}"
        }

        if company_name:
            data["company_name"] = company_name

        # Add contact person if email or phone provided
        if email or phone:
            contact_person = {}
            if email:
                contact_person["email"] = email
            if phone:
                contact_person["phone"] = phone
            data["contact_persons"] = [contact_person]

        # Merge additional kwargs
        data.update(kwargs)

        payload = {"JSONString": data}
        response = self._make_request("POST", endpoint, json=payload)
        return response.get("contact", {})

    def update_vendor_contact(self, contact_id: str, data: Dict) -> Dict:
        """
        Update an existing vendor contact

        Args:
            contact_id: Contact ID to update
            data: Dictionary with fields to update

        Returns:
            Updated contact dictionary
        """
        endpoint = f"/books/v3/contacts/{contact_id}"

        payload = {"JSONString": data}
        response = self._make_request("PUT", endpoint, json=payload)
        return response.get("contact", {})

    def get_or_create_vendor(
        self,
        contact_name: str,
        email: Optional[str] = None,
        **kwargs
    ) -> Dict:
        """
        Get existing vendor by email or create new one

        Args:
            contact_name: Vendor name
            email: Vendor email (used for lookup)
            **kwargs: Additional fields for vendor creation

        Returns:
            Vendor contact dictionary
        """
        # Try to find existing vendor by email
        if email:
            existing = self.get_contact_by_email(email)
            if existing:
                return existing

        # Create new vendor
        return self.create_vendor_contact(
            contact_name=contact_name,
            email=email,
            **kwargs
        )

    # ============ BILLS ============

    def create_bill(
        self,
        vendor_id: str,
        line_items: List[Dict],
        bill_number: Optional[str] = None,
        date: Optional[str] = None,
        due_date: Optional[str] = None,
        payment_terms: int = 30,
        notes: Optional[str] = None,
        reference_number: Optional[str] = None,
        **kwargs
    ) -> Dict:
        """
        Create a bill for a vendor

        Args:
            vendor_id: Vendor contact ID
            line_items: List of line item dictionaries with:
                - name: Item/service name
                - account_id: Chart of accounts ID
                - quantity: Quantity
                - rate: Price per unit
                - description (optional): Item description
                - unit (optional): Unit of measurement
            bill_number: Unique bill number (auto-generated if not provided)
            date: Bill date (YYYY-MM-DD, defaults to today)
            due_date: Due date (YYYY-MM-DD)
            payment_terms: Payment terms in days
            notes: Notes for the bill
            reference_number: External reference (e.g., employee ID)
            **kwargs: Additional fields

        Returns:
            Created bill dictionary
        """
        endpoint = "/books/v3/bills"

        # Default date to today if not provided
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")

        # Calculate due date if not provided
        if not due_date and payment_terms:
            due_date_obj = datetime.now() + timedelta(days=payment_terms)
            due_date = due_date_obj.strftime("%Y-%m-%d")

        data = {
            "vendor_id": vendor_id,
            "date": date,
            "payment_terms": payment_terms,
            "line_items": line_items
        }

        if bill_number:
            data["bill_number"] = bill_number
        if due_date:
            data["due_date"] = due_date
        if notes:
            data["notes"] = notes
        if reference_number:
            data["reference_number"] = reference_number

        # Merge additional kwargs
        data.update(kwargs)

        payload = {"JSONString": data}
        response = self._make_request("POST", endpoint, json=payload)
        return response.get("bill", {})

    def get_bills(
        self,
        vendor_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict]:
        """
        Get bills with optional filters

        Args:
            vendor_id: Filter by vendor ID
            status: Filter by status (draft, open, paid, void, overdue)

        Returns:
            List of bill dictionaries
        """
        endpoint = "/books/v3/bills"
        params = {}

        if vendor_id:
            params["vendor_id"] = vendor_id
        if status:
            params["status"] = status

        response = self._make_request("GET", endpoint, params=params)
        return response.get("bills", [])

    def get_bill(self, bill_id: str) -> Dict:
        """Get a specific bill by ID"""
        endpoint = f"/books/v3/bills/{bill_id}"
        response = self._make_request("GET", endpoint)
        return response.get("bill", {})

    def update_bill(self, bill_id: str, data: Dict) -> Dict:
        """
        Update an existing bill

        Args:
            bill_id: Bill ID to update
            data: Dictionary with fields to update

        Returns:
            Updated bill dictionary
        """
        endpoint = f"/books/v3/bills/{bill_id}"

        payload = {"JSONString": data}
        response = self._make_request("PUT", endpoint, json=payload)
        return response.get("bill", {})

    def delete_bill(self, bill_id: str) -> Dict:
        """Delete a bill"""
        endpoint = f"/books/v3/bills/{bill_id}"
        return self._make_request("DELETE", endpoint)

    # ============ ITEMS ============

    def get_items(
        self,
        item_type: Optional[str] = None,
        status: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Get all items with optional filters

        Args:
            item_type: Filter by type (sales, purchases, sales_and_purchases, inventory)
            status: Filter by status (active, inactive)
            organization_id: Zoho Books organization ID (uses env default if not provided)

        Returns:
            List of item dictionaries
        """
        endpoint = "/books/v3/items"
        params = {}

        if item_type:
            params["filter_by"] = f"ItemType.{item_type}"
        if status:
            # Zoho expects capitalized status: Active, Inactive
            status_capitalized = status.capitalize() if status else None
            if status_capitalized:
                params["filter_by"] = f"Status.{status_capitalized}"

        response = self._make_request("GET", endpoint, organization_id=organization_id, params=params)
        return response.get("items", [])

    def get_item(self, item_id: str) -> Dict:
        """Get a specific item by ID"""
        endpoint = f"/books/v3/items/{item_id}"
        response = self._make_request("GET", endpoint)
        return response.get("item", {})

    def create_item(
        self,
        name: str,
        rate: float,
        description: Optional[str] = None,
        account_id: Optional[str] = None,
        tax_id: Optional[str] = None,
        item_type: str = "sales_and_purchases",
        product_type: str = "service",
        unit: Optional[str] = None,
        sku: Optional[str] = None,
        **kwargs
    ) -> Dict:
        """
        Create a new item

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
            **kwargs: Additional fields

        Returns:
            Created item dictionary
        """
        endpoint = "/books/v3/items"

        data = {
            "name": name,
            "rate": rate,
            "item_type": item_type,
            "product_type": product_type
        }

        if description:
            data["description"] = description
        if account_id:
            data["account_id"] = account_id
        if tax_id:
            data["tax_id"] = tax_id
        if unit:
            data["unit"] = unit
        if sku:
            data["sku"] = sku

        # Merge additional kwargs
        data.update(kwargs)

        payload = {"JSONString": data}
        response = self._make_request("POST", endpoint, json=payload)
        return response.get("item", {})

    def update_item(self, item_id: str, data: Dict) -> Dict:
        """
        Update an existing item

        Args:
            item_id: Item ID to update
            data: Dictionary with fields to update

        Returns:
            Updated item dictionary
        """
        endpoint = f"/books/v3/items/{item_id}"

        payload = {"JSONString": data}
        response = self._make_request("PUT", endpoint, json=payload)
        return response.get("item", {})

    def delete_item(self, item_id: str) -> Dict:
        """Delete an item"""
        endpoint = f"/books/v3/items/{item_id}"
        return self._make_request("DELETE", endpoint)

    def mark_item_as_active(self, item_id: str) -> Dict:
        """Mark an item as active"""
        endpoint = f"/books/v3/items/{item_id}/active"
        return self._make_request("POST", endpoint)

    def mark_item_as_inactive(self, item_id: str) -> Dict:
        """Mark an item as inactive"""
        endpoint = f"/books/v3/items/{item_id}/inactive"
        return self._make_request("POST", endpoint)

    def search_items(self, search_text: str) -> List[Dict]:
        """
        Search items by name or description

        Args:
            search_text: Text to search for

        Returns:
            List of matching items
        """
        endpoint = "/books/v3/items"
        params = {"search_text": search_text}

        response = self._make_request("GET", endpoint, params=params)
        return response.get("items", [])

    def get_or_create_item(
        self,
        name: str,
        rate: float,
        **kwargs
    ) -> Dict:
        """
        Get existing item by name or create new one

        Args:
            name: Item name
            rate: Item rate
            **kwargs: Additional fields for item creation

        Returns:
            Item dictionary
        """
        # Try to find existing item by name
        existing_items = self.search_items(name)
        exact_match = next((item for item in existing_items if item.get("name") == name), None)

        if exact_match:
            return exact_match

        # Create new item
        return self.create_item(name=name, rate=rate, **kwargs)

    # ============ HELPER METHODS ============

    def create_bill_from_payment(
        self,
        interpreter_data: Dict,
        payment_data: Dict,
        default_account_id: str,
        auto_generate_bill_number: bool = True
    ) -> Dict:
        """
        Create a bill for an interpreter payment

        Args:
            interpreter_data: Interpreter dictionary with contact info
            payment_data: Payment dictionary with amount, hours, etc.
            default_account_id: Default expense account ID for line items
            auto_generate_bill_number: Whether to auto-generate bill number

        Returns:
            Created bill dictionary
        """
        # Get or create vendor contact
        vendor = self.get_or_create_vendor(
            contact_name=interpreter_data.get("contact_name", "Unknown Interpreter"),
            email=interpreter_data.get("email"),
            phone=interpreter_data.get("phone"),
            company_name=interpreter_data.get("company_name")
        )

        # Build line items
        line_items = [{
            "name": f"Interpreter Services - {payment_data.get('language', 'Unknown')}",
            "description": f"Period: {payment_data.get('period', 'N/A')} | Client: {payment_data.get('client_name', 'N/A')}",
            "account_id": default_account_id,
            "quantity": payment_data.get("total_hours", 0) or 1,
            "rate": payment_data.get("rate_per_hour", 0) or payment_data.get("total_amount", 0),
            "unit": "hours"
        }]

        # Generate bill number if needed
        bill_number = None
        if not auto_generate_bill_number:
            employee_id = interpreter_data.get("employee_id", "")
            period = payment_data.get("period", "")
            bill_number = f"BILL-{employee_id}-{period}".replace(" ", "-")

        # Create the bill
        return self.create_bill(
            vendor_id=vendor["contact_id"],
            line_items=line_items,
            bill_number=bill_number,
            reference_number=interpreter_data.get("employee_id"),
            notes=f"Payment for interpreter services\nEmployee ID: {interpreter_data.get('employee_id', 'N/A')}"
        )


# Singleton instance
zoho_books_client = ZohoBooksClient()
