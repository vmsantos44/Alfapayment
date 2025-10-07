"""
Script to clean up test/mock data from the database
"""

import sys
sys.path.insert(0, '.')

from database import get_db
from models import Interpreter

def delete_test_interpreters():
    """Delete all interpreters with @example.com emails"""
    db = next(get_db())

    try:
        # Find all test interpreters
        test_interpreters = db.query(Interpreter).filter(
            Interpreter.email.like('%@example.com')
        ).all()

        print(f"Found {len(test_interpreters)} test interpreters with @example.com emails")

        if len(test_interpreters) == 0:
            print("No test data to delete.")
            return

        # Confirm deletion
        response = input(f"\nDelete {len(test_interpreters)} test interpreters? (yes/no): ")

        if response.lower() in ['yes', 'y']:
            # Delete all test interpreters
            for interp in test_interpreters:
                db.delete(interp)

            db.commit()
            print(f"✅ Successfully deleted {len(test_interpreters)} test interpreters")
        else:
            print("❌ Deletion cancelled")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {str(e)}")
    finally:
        db.close()

def delete_all_interpreters():
    """Delete ALL interpreters (use with caution!)"""
    db = next(get_db())

    try:
        all_interpreters = db.query(Interpreter).all()

        print(f"Found {len(all_interpreters)} total interpreters")

        if len(all_interpreters) == 0:
            print("No interpreters to delete.")
            return

        # Confirm deletion
        response = input(f"\n⚠️  WARNING: Delete ALL {len(all_interpreters)} interpreters? (type 'DELETE ALL' to confirm): ")

        if response == 'DELETE ALL':
            # Delete all interpreters
            for interp in all_interpreters:
                db.delete(interp)

            db.commit()
            print(f"✅ Successfully deleted {len(all_interpreters)} interpreters")
        else:
            print("❌ Deletion cancelled")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Alfa Payment Database Cleanup")
    print("=" * 60)
    print("\nOptions:")
    print("1. Delete test data only (@example.com emails)")
    print("2. Delete ALL interpreters")
    print("3. Cancel")

    choice = input("\nEnter your choice (1-3): ")

    if choice == "1":
        delete_test_interpreters()
    elif choice == "2":
        delete_all_interpreters()
    else:
        print("Cancelled")
