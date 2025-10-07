"""
Rate limiter for Zoho API calls
"""

import time
import threading
from collections import deque
from typing import Optional


class RateLimiter:
    """
    Simple rate limiter to prevent exceeding Zoho API limits

    Zoho CRM has the following limits:
    - 10 requests per 10 seconds per API endpoint
    - 5000 API calls per day (basic plan)
    """

    def __init__(self, max_calls: int = 10, time_window: int = 10):
        """
        Initialize rate limiter

        Args:
            max_calls: Maximum number of calls allowed in the time window
            time_window: Time window in seconds
        """
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = deque()
        self._lock = threading.Lock()

    def acquire(self) -> Optional[float]:
        """
        Acquire permission to make an API call

        Returns:
            Wait time in seconds if rate limit would be exceeded, None otherwise
        """
        with self._lock:
            now = time.time()

            # Remove calls outside the time window
            while self.calls and self.calls[0] < now - self.time_window:
                self.calls.popleft()

            # Check if we've hit the limit
            if len(self.calls) >= self.max_calls:
                # Calculate wait time
                oldest_call = self.calls[0]
                wait_time = self.time_window - (now - oldest_call)
                return max(0, wait_time)

            # Record this call
            self.calls.append(now)
            return None

    def wait_if_needed(self):
        """
        Wait if rate limit would be exceeded
        """
        wait_time = self.acquire()
        if wait_time:
            time.sleep(wait_time + 0.1)  # Add small buffer
            # After waiting, try to acquire again
            self.acquire()


# Global rate limiter for Zoho API
zoho_rate_limiter = RateLimiter(max_calls=10, time_window=10)
