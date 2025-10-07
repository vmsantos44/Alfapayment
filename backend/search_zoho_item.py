#!/usr/bin/env python3
"""
Search for Zoho Books Items and show their expense account associations
"""
from zoho_books_client import zoho_books_client
import json

def search_item(search_term="Spanish"):
    """Search for items in Zoho Books and show their expense account info"""
    print(f'Searching for items with "{search_term}" in Zoho Books...\n')

    try:
        # Search for items
        items = zoho_books_client.search_items(search_term)
        print(f'✅ Found {len(items)} item(s)\n')

        if items:
            for idx, item in enumerate(items[:5], 1):  # Show first 5 results
                print(f"{'='*80}")
                print(f"ITEM #{idx}: {item.get('name')}")
                print(f"{'='*80}")
                print(f"Item ID:          {item.get('item_id')}")
                print(f"Description:      {item.get('description', 'N/A')}")
                print(f"Rate:             ${item.get('rate', 0)}")
                print(f"Purchase Rate:    ${item.get('purchase_rate', 0)}")
                print(f"Unit:             {item.get('unit', 'N/A')}")
                print(f"Status:           {item.get('status', 'N/A')}")
                print(f"Item Type:        {item.get('item_type', 'N/A')}")
                print(f"\n📊 EXPENSE ACCOUNT ASSOCIATION:")
                print(f"  Account ID:     {item.get('account_id', 'N/A')}")
                print(f"  Account Name:   {item.get('account_name', 'N/A')}")

                # Show full item data
                print(f"\n🔍 Full Item Data:")
                print(json.dumps(item, indent=2))
                print(f"\n")
        else:
            print(f'❌ No items found with "{search_term}"')
            print('\n💡 Try searching for: Spanish, French, English, Arabic, etc.')

    except Exception as e:
        print(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import sys
    search_term = sys.argv[1] if len(sys.argv) > 1 else "Spanish"
    search_item(search_term)
