#!/usr/bin/env python3
"""
Search for Zoho One Subscription in Chart of Accounts
"""
from zoho_books_client import zoho_books_client
import json

def search_account(search_term="Zoho One"):
    """Search for an account by name"""
    print(f'Fetching all accounts from Zoho Books...')

    try:
        all_accounts = zoho_books_client.get_chart_of_accounts()
        print(f'✓ Retrieved {len(all_accounts)} accounts')

        # Search for accounts containing the search term
        matching_accounts = [
            acc for acc in all_accounts
            if search_term.lower() in acc.get('account_name', '').lower()
        ]

        if matching_accounts:
            print(f'\n✅ Found {len(matching_accounts)} matching account(s) for "{search_term}":\n')
            for acc in matching_accounts:
                print(json.dumps(acc, indent=2))
                print('-' * 80)
        else:
            print(f'\n❌ No accounts found with "{search_term}" in the name.')
            print(f'\n💡 Showing first 20 expense accounts as reference:')
            expense_accounts = [acc for acc in all_accounts if 'expense' in acc.get('account_type', '').lower()][:20]
            for acc in expense_accounts:
                print(f"  - {acc.get('account_name')} (Type: {acc.get('account_type')}, ID: {acc.get('account_id')})")

    except Exception as e:
        print(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    search_account("Zoho One")
