"""
Unit tests for thread-safe rate limiter
"""

import pytest
import time
import threading
from rate_limiter import RateLimiter


class TestRateLimiter:
    """Test suite for RateLimiter class"""

    def test_basic_rate_limiting(self):
        """Test basic rate limiting functionality"""
        limiter = RateLimiter(max_calls=3, time_window=1)

        # First 3 calls should not require waiting
        assert limiter.acquire() is None
        assert limiter.acquire() is None
        assert limiter.acquire() is None

        # 4th call should require waiting
        wait_time = limiter.acquire()
        assert wait_time is not None
        assert wait_time > 0

    def test_time_window_expiry(self):
        """Test that old calls are removed from the time window"""
        limiter = RateLimiter(max_calls=2, time_window=1)

        # Make 2 calls
        assert limiter.acquire() is None
        assert limiter.acquire() is None

        # 3rd call should require waiting
        wait_time = limiter.acquire()
        assert wait_time is not None

        # Wait for time window to expire
        time.sleep(1.1)

        # New call should not require waiting
        assert limiter.acquire() is None

    def test_thread_safety(self):
        """Test that rate limiter is thread-safe under concurrent access"""
        limiter = RateLimiter(max_calls=10, time_window=1)
        successful_acquires = []
        failed_acquires = []
        lock = threading.Lock()

        def worker():
            wait_time = limiter.acquire()
            with lock:
                if wait_time is None:
                    successful_acquires.append(1)
                else:
                    failed_acquires.append(wait_time)

        # Create 20 threads trying to acquire at once
        threads = []
        for _ in range(20):
            t = threading.Thread(target=worker)
            threads.append(t)
            t.start()

        # Wait for all threads to complete
        for t in threads:
            t.join()

        # Exactly 10 should succeed (the max_calls limit)
        assert len(successful_acquires) == 10
        # The rest should be told to wait
        assert len(failed_acquires) == 10
        # All wait times should be positive
        assert all(wait > 0 for wait in failed_acquires)

    def test_wait_if_needed(self):
        """Test wait_if_needed method"""
        limiter = RateLimiter(max_calls=2, time_window=1)

        # First 2 calls should not wait
        start = time.time()
        limiter.wait_if_needed()
        limiter.wait_if_needed()
        elapsed = time.time() - start
        assert elapsed < 0.1  # Should be almost instantaneous

        # 3rd call should wait
        start = time.time()
        limiter.wait_if_needed()
        elapsed = time.time() - start
        assert elapsed >= 1.0  # Should wait at least 1 second

    def test_concurrent_wait_if_needed(self):
        """Test concurrent calls to wait_if_needed"""
        limiter = RateLimiter(max_calls=5, time_window=1)
        completed = []
        lock = threading.Lock()

        def worker(worker_id):
            limiter.wait_if_needed()
            with lock:
                completed.append(worker_id)

        # Launch 10 threads
        threads = []
        start = time.time()
        for i in range(10):
            t = threading.Thread(target=worker, args=(i,))
            threads.append(t)
            t.start()

        # Wait for all to complete
        for t in threads:
            t.join()

        elapsed = time.time() - start

        # All 10 should complete
        assert len(completed) == 10
        # Should take at least 1 second (need to wait for time window)
        assert elapsed >= 1.0

    def test_edge_case_zero_calls(self):
        """Test edge case with max_calls=1"""
        limiter = RateLimiter(max_calls=1, time_window=1)

        # First call should succeed
        assert limiter.acquire() is None

        # Second call should wait
        wait_time = limiter.acquire()
        assert wait_time is not None
        assert wait_time > 0

    def test_multiple_time_windows(self):
        """Test behavior across multiple time windows"""
        limiter = RateLimiter(max_calls=2, time_window=0.5)

        # First window - 2 calls succeed
        assert limiter.acquire() is None
        assert limiter.acquire() is None

        # 3rd call fails
        assert limiter.acquire() is not None

        # Wait for first window to expire
        time.sleep(0.6)

        # Next 2 calls should succeed
        assert limiter.acquire() is None
        assert limiter.acquire() is None

        # 3rd call fails again
        assert limiter.acquire() is not None
