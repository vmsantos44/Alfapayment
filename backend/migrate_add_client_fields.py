#!/usr/bin/env python3
"""
Migration script to add email, currency, and address fields to clients table
Date: 2025-10-07
"""

import sqlite3
import sys
from pathlib import Path

def run_migration(db_path: str):
    """Add new columns to clients table"""

    print(f"Running migration on: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check current schema
        cursor.execute("PRAGMA table_info(clients)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"Current columns: {columns}")

        # Add email column if not exists
        if 'email' not in columns:
            print("Adding 'email' column...")
            cursor.execute("ALTER TABLE clients ADD COLUMN email TEXT")
            print("✓ Added 'email' column")
        else:
            print("'email' column already exists")

        # Add currency column if not exists
        if 'currency' not in columns:
            print("Adding 'currency' column...")
            cursor.execute("ALTER TABLE clients ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'")
            print("✓ Added 'currency' column with default 'USD'")
        else:
            print("'currency' column already exists")

        # Add address column if not exists
        if 'address' not in columns:
            print("Adding 'address' column...")
            cursor.execute("ALTER TABLE clients ADD COLUMN address TEXT")
            print("✓ Added 'address' column")
        else:
            print("'address' column already exists")

        # Commit changes
        conn.commit()

        # Verify new schema
        cursor.execute("PRAGMA table_info(clients)")
        new_columns = [row[1] for row in cursor.fetchall()]
        print(f"\nNew schema: {new_columns}")

        # Show client count
        cursor.execute("SELECT COUNT(*) FROM clients")
        count = cursor.fetchone()[0]
        print(f"\nTotal clients: {count}")

        print("\n✅ Migration completed successfully!")
        return True

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()

if __name__ == "__main__":
    db_path = Path(__file__).parent / "alfa_payment.db"

    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        sys.exit(1)

    success = run_migration(str(db_path))
    sys.exit(0 if success else 1)
