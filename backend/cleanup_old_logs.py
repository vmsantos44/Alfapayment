#!/usr/bin/env python3
"""
Clean up old sync logs from the database to reduce database size
"""

import sys
sys.path.insert(0, '.')

from datetime import datetime, timedelta
from database import get_db
from sqlalchemy import text

def cleanup_old_logs(days_to_keep=30):
    """
    Delete sync logs older than specified days

    Args:
        days_to_keep: Number of days of logs to retain (default: 30)
    """
    db = next(get_db())

    try:
        # Calculate cutoff date
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)

        # Count logs before deletion
        count_before = db.execute(text("SELECT COUNT(*) FROM sync_logs")).scalar()

        # Delete old logs
        result = db.execute(
            text("DELETE FROM sync_logs WHERE created_at < :cutoff_date"),
            {"cutoff_date": cutoff_date}
        )

        db.commit()

        deleted_count = result.rowcount
        count_after = db.execute(text("SELECT COUNT(*) FROM sync_logs")).scalar()

        print(f"=" * 60)
        print(f"Sync Logs Cleanup Complete")
        print(f"=" * 60)
        print(f"Logs before:     {count_before:,}")
        print(f"Logs deleted:    {deleted_count:,}")
        print(f"Logs remaining:  {count_after:,}")
        print(f"Cutoff date:     {cutoff_date.strftime('%Y-%m-%d')}")
        print(f"=" * 60)

        # Vacuum database to reclaim space
        print("\nOptimizing database (VACUUM)...")
        db.execute(text("VACUUM"))
        print("✅ Database optimized")

        return {
            "success": True,
            "deleted_count": deleted_count,
            "remaining_count": count_after,
            "cutoff_date": cutoff_date.isoformat()
        }

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()

def keep_only_recent_sync():
    """Keep only logs from the most recent completed sync operation"""
    db = next(get_db())

    try:
        # Get the most recent completed sync
        result = db.execute(
            text("""
                SELECT id FROM sync_operations
                WHERE status = 'completed'
                ORDER BY created_at DESC
                LIMIT 1
            """)
        ).fetchone()

        if not result:
            print("No completed sync operations found")
            db.close()
            return

        most_recent_sync_id = result[0]

        # Count logs
        count_total = db.execute(text("SELECT COUNT(*) FROM sync_logs")).scalar()
        count_to_keep = db.execute(
            text("SELECT COUNT(*) FROM sync_logs WHERE sync_operation_id = :sync_id"),
            {"sync_id": most_recent_sync_id}
        ).scalar()

        count_to_delete = count_total - count_to_keep

        print(f"=" * 60)
        print(f"Cleanup: Keep Only Most Recent Sync")
        print(f"=" * 60)
        print(f"Most recent sync ID: {most_recent_sync_id}")
        print(f"Total sync logs:     {count_total:,}")
        print(f"Logs to keep:        {count_to_keep:,}")
        print(f"Logs to delete:      {count_to_delete:,}")
        print(f"=" * 60)

        response = input(f"\nDelete {count_to_delete:,} old logs? (yes/no): ")

        if response.lower() in ['yes', 'y']:
            # Delete logs not from most recent sync
            result = db.execute(
                text("DELETE FROM sync_logs WHERE sync_operation_id != :sync_id"),
                {"sync_id": most_recent_sync_id}
            )
            db.commit()

            print(f"\n✅ Deleted {result.rowcount:,} old logs")

            # Vacuum database
            print("\nOptimizing database (VACUUM)...")
            db.execute(text("VACUUM"))
            print("✅ Database optimized")
        else:
            print("❌ Cleanup cancelled")

        db.close()

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        db.close()


def delete_all_logs():
    """Delete ALL sync logs (for testing/development)"""
    db = next(get_db())

    try:
        count_total = db.execute(text("SELECT COUNT(*) FROM sync_logs")).scalar()

        print(f"=" * 60)
        print(f"⚠️  WARNING: Delete ALL Sync Logs")
        print(f"=" * 60)
        print(f"Total sync logs: {count_total:,}")
        print(f"=" * 60)

        response = input(f"\nDelete ALL {count_total:,} logs? (type 'DELETE ALL' to confirm): ")

        if response == 'DELETE ALL':
            db.execute(text("DELETE FROM sync_logs"))
            db.commit()

            print(f"\n✅ Deleted {count_total:,} logs")

            # Vacuum database
            print("\nOptimizing database (VACUUM)...")
            db.execute(text("VACUUM"))
            print("✅ Database optimized")
        else:
            print("❌ Cleanup cancelled")

        db.close()

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        db.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Clean up sync logs from database")
    parser.add_argument(
        "--mode",
        choices=["days", "recent", "all"],
        default="days",
        help="Cleanup mode: 'days' (keep N days), 'recent' (keep only most recent sync), 'all' (delete everything)"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days of logs to keep (only for --mode=days)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without actually deleting (only for --mode=days)"
    )

    args = parser.parse_args()

    if args.mode == "recent":
        keep_only_recent_sync()
    elif args.mode == "all":
        delete_all_logs()
    else:  # days mode
        if args.dry_run:
            db = next(get_db())
            cutoff_date = datetime.utcnow() - timedelta(days=args.days)

            count_total = db.execute(text("SELECT COUNT(*) FROM sync_logs")).scalar()
            count_old = db.execute(
                text("SELECT COUNT(*) FROM sync_logs WHERE created_at < :cutoff_date"),
                {"cutoff_date": cutoff_date}
            ).scalar()

            print(f"=" * 60)
            print(f"DRY RUN - No changes will be made")
            print(f"=" * 60)
            print(f"Total sync logs:        {count_total:,}")
            print(f"Logs older than {args.days} days: {count_old:,}")
            print(f"Logs to keep:           {count_total - count_old:,}")
            print(f"Cutoff date:            {cutoff_date.strftime('%Y-%m-%d')}")
            print(f"=" * 60)
            print(f"\nRun without --dry-run to delete {count_old:,} old logs")

            db.close()
        else:
            print(f"Cleaning up sync logs older than {args.days} days...")
            print()
            cleanup_old_logs(days_to_keep=args.days)
