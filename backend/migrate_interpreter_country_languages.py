#!/usr/bin/env python3
"""
Migration script to add country field and support multiple languages per interpreter
"""
import sqlite3
import sys
import os
from uuid import uuid4

def run_migration(db_path: str):
    """Add country field and create interpreter_languages junction table"""
    print(f"🔄 Starting migration on database: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Step 1: Get current table structure
        cursor.execute("PRAGMA table_info(interpreters)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"✅ Found interpreters table with {len(columns)} columns")

        # Step 2: Add country column if it doesn't exist
        if 'country' not in columns:
            print("📍 Adding 'country' column to interpreters table...")
            cursor.execute("ALTER TABLE interpreters ADD COLUMN country TEXT")
            print("✅ Added country column")
        else:
            print("⏭️  Country column already exists")

        # Step 3: Check if interpreter_languages table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='interpreter_languages'")
        table_exists = cursor.fetchone() is not None

        if not table_exists:
            print("📚 Creating interpreter_languages junction table...")
            cursor.execute("""
                CREATE TABLE interpreter_languages (
                    id TEXT PRIMARY KEY,
                    interpreter_id TEXT NOT NULL,
                    language TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (interpreter_id) REFERENCES interpreters(id) ON DELETE CASCADE,
                    UNIQUE(interpreter_id, language)
                )
            """)
            cursor.execute("CREATE INDEX idx_interpreter_languages_interpreter ON interpreter_languages(interpreter_id)")
            cursor.execute("CREATE INDEX idx_interpreter_languages_language ON interpreter_languages(language)")
            print("✅ Created interpreter_languages table with indexes")
        else:
            print("⏭️  interpreter_languages table already exists")

        # Step 4: Migrate existing language data to junction table
        print("🔄 Migrating existing language data to junction table...")
        cursor.execute("SELECT id, language FROM interpreters WHERE language IS NOT NULL AND language != ''")
        interpreters_with_language = cursor.fetchall()

        migrated_count = 0
        for interpreter_id, language in interpreters_with_language:
            # Check if already migrated
            cursor.execute(
                "SELECT COUNT(*) FROM interpreter_languages WHERE interpreter_id = ? AND language = ?",
                (interpreter_id, language)
            )
            exists = cursor.fetchone()[0] > 0

            if not exists:
                language_id = str(uuid4())
                cursor.execute(
                    "INSERT INTO interpreter_languages (id, interpreter_id, language) VALUES (?, ?, ?)",
                    (language_id, interpreter_id, language)
                )
                migrated_count += 1

        print(f"✅ Migrated {migrated_count} language records to junction table")

        # Step 5: Commit changes
        conn.commit()
        print("✅ Migration completed successfully!")

        # Step 6: Show summary
        cursor.execute("SELECT COUNT(*) FROM interpreters")
        total_interpreters = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM interpreter_languages")
        total_languages = cursor.fetchone()[0]

        print(f"\n📊 Database Summary:")
        print(f"   Total interpreters: {total_interpreters}")
        print(f"   Total language associations: {total_languages}")

    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    db_path = os.getenv("DATABASE_PATH", "alfa_payment.db")

    # Check if database exists
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        sys.exit(1)

    # Create backup
    backup_path = f"{db_path}.backup_{int(os.path.getctime(db_path))}"
    import shutil
    print(f"💾 Creating backup at: {backup_path}")
    shutil.copy2(db_path, backup_path)
    print("✅ Backup created")

    # Run migration
    run_migration(db_path)
