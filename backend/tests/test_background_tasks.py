"""
Unit tests for background tasks and memory management
"""

import pytest
import time
from datetime import datetime, timedelta
from background_tasks import (
    import_jobs,
    import_jobs_lock,
    cleanup_old_jobs,
    get_job_status,
    set_job_status,
    MAX_JOBS_RETENTION,
    JOB_TTL_HOURS
)


class TestBackgroundTasks:
    """Test suite for background task management"""

    def setup_method(self):
        """Clear import_jobs before each test"""
        with import_jobs_lock:
            import_jobs.clear()

    def test_set_and_get_job_status(self):
        """Test basic job status operations"""
        job_id = "test_job_1"
        status_data = {
            "status": "in_progress",
            "progress": 50,
            "message": "Processing..."
        }

        set_job_status(job_id, status_data)
        retrieved = get_job_status(job_id)

        assert retrieved is not None
        assert retrieved["status"] == "in_progress"
        assert retrieved["progress"] == 50
        assert "timestamp" in retrieved  # Should be auto-added

    def test_get_nonexistent_job(self):
        """Test getting status of non-existent job"""
        result = get_job_status("nonexistent_job")
        assert result is None

    def test_timestamp_auto_added(self):
        """Test that timestamp is automatically added to job status"""
        job_id = "test_job_2"
        status_data = {
            "status": "completed",
            "progress": 100
        }

        before = datetime.utcnow()
        set_job_status(job_id, status_data)
        after = datetime.utcnow()

        retrieved = get_job_status(job_id)
        assert "timestamp" in retrieved
        assert before <= retrieved["timestamp"] <= after

    def test_cleanup_removes_old_jobs(self):
        """Test that cleanup removes jobs older than JOB_TTL_HOURS"""
        # Create many jobs to exceed MAX_JOBS_RETENTION (which triggers cleanup)
        # First create some old completed jobs
        num_old_jobs = 5
        for i in range(num_old_jobs):
            old_job_id = f"old_job_{i}"
            old_timestamp = datetime.utcnow() - timedelta(hours=JOB_TTL_HOURS + 1)
            old_status = {
                "status": "completed",
                "progress": 100,
                "timestamp": old_timestamp
            }
            with import_jobs_lock:
                import_jobs[old_job_id] = old_status

        # Then create enough recent jobs to exceed MAX_JOBS_RETENTION
        for i in range(MAX_JOBS_RETENTION):
            recent_job_id = f"recent_job_{i}"
            recent_status = {
                "status": "completed",
                "progress": 100
            }
            set_job_status(recent_job_id, recent_status)

        # Trigger cleanup by calling get_job_status (which auto-triggers cleanup)
        get_job_status("any_job")

        # Old jobs should be gone
        for i in range(num_old_jobs):
            assert get_job_status(f"old_job_{i}") is None

        # At least some recent jobs should still exist
        assert get_job_status("recent_job_0") is not None

    def test_cleanup_respects_max_retention(self):
        """Test that cleanup enforces MAX_JOBS_RETENTION limit"""
        # Create more than MAX_JOBS_RETENTION completed jobs
        num_jobs = MAX_JOBS_RETENTION + 10
        for i in range(num_jobs):
            job_id = f"job_{i}"
            status_data = {
                "status": "completed",
                "progress": 100
            }
            set_job_status(job_id, status_data)

        # Trigger cleanup
        cleanup_old_jobs()

        # Should have at most MAX_JOBS_RETENTION jobs
        with import_jobs_lock:
            assert len(import_jobs) <= MAX_JOBS_RETENTION

    def test_cleanup_keeps_in_progress_jobs(self):
        """Test that cleanup doesn't remove in-progress jobs"""
        # Create old in-progress job
        old_job_id = "old_in_progress"
        old_timestamp = datetime.utcnow() - timedelta(hours=JOB_TTL_HOURS + 1)
        old_status = {
            "status": "in_progress",
            "progress": 50,
            "timestamp": old_timestamp
        }
        set_job_status(old_job_id, old_status)

        # Trigger cleanup
        cleanup_old_jobs()

        # In-progress job should still exist even if old
        assert get_job_status(old_job_id) is not None

    def test_thread_safe_concurrent_access(self):
        """Test thread-safe concurrent job status updates"""
        import threading

        job_id = "concurrent_job"
        num_threads = 10
        updates_per_thread = 10

        def worker(thread_id):
            for i in range(updates_per_thread):
                status_data = {
                    "status": "in_progress",
                    "progress": thread_id * updates_per_thread + i,
                    "thread_id": thread_id
                }
                set_job_status(f"{job_id}_{thread_id}", status_data)

        threads = []
        for i in range(num_threads):
            t = threading.Thread(target=worker, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # All jobs should be created
        for i in range(num_threads):
            status = get_job_status(f"{job_id}_{i}")
            assert status is not None
            assert status["thread_id"] == i

    def test_update_existing_job(self):
        """Test updating an existing job status"""
        job_id = "update_test"

        # Create initial status
        initial_status = {
            "status": "in_progress",
            "progress": 25,
            "message": "Starting..."
        }
        set_job_status(job_id, initial_status)

        # Update status
        updated_status = {
            "status": "in_progress",
            "progress": 75,
            "message": "Almost done..."
        }
        set_job_status(job_id, updated_status)

        # Retrieve and verify
        result = get_job_status(job_id)
        assert result["progress"] == 75
        assert result["message"] == "Almost done..."

    def test_cleanup_called_on_get(self):
        """Test that cleanup is automatically called when getting job status"""
        # Create many old completed jobs
        for i in range(MAX_JOBS_RETENTION + 5):
            job_id = f"auto_cleanup_job_{i}"
            old_timestamp = datetime.utcnow() - timedelta(hours=JOB_TTL_HOURS + 1)
            status_data = {
                "status": "completed",
                "progress": 100,
                "timestamp": old_timestamp
            }
            with import_jobs_lock:
                import_jobs[job_id] = status_data

        # Getting any job status should trigger cleanup
        get_job_status("any_job")

        # Jobs should have been cleaned up
        with import_jobs_lock:
            assert len(import_jobs) <= MAX_JOBS_RETENTION

    def test_memory_leak_prevention(self):
        """Test that import_jobs doesn't grow indefinitely"""
        # Simulate many job completions
        for i in range(MAX_JOBS_RETENTION * 3):
            job_id = f"leak_test_{i}"
            status_data = {
                "status": "completed",
                "progress": 100
            }
            set_job_status(job_id, status_data)

            # Trigger cleanup every 10 jobs
            if i % 10 == 0:
                get_job_status(job_id)

        # Final size should be reasonable
        with import_jobs_lock:
            final_size = len(import_jobs)
            assert final_size <= MAX_JOBS_RETENTION * 1.1  # Allow 10% buffer
