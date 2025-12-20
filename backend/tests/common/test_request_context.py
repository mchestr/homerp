"""Tests for request context utilities."""

import asyncio

from src.common.request_context import (
    generate_request_id,
    get_request_id,
    set_request_id,
)


class TestRequestContext:
    """Test request context functions."""

    def test_generate_request_id_creates_uuid(self):
        """generate_request_id should create a valid UUID string."""
        request_id = generate_request_id()
        assert request_id is not None
        assert isinstance(request_id, str)
        assert len(request_id) == 36  # UUID4 format: 8-4-4-4-12
        assert request_id.count("-") == 4

    def test_generate_request_id_is_unique(self):
        """Each call to generate_request_id should produce a unique ID."""
        id1 = generate_request_id()
        id2 = generate_request_id()
        id3 = generate_request_id()
        assert id1 != id2
        assert id2 != id3
        assert id1 != id3

    def test_get_request_id_returns_none_initially(self):
        """get_request_id should return None when no ID is set."""
        # Note: This test may fail if other tests set a request ID
        # but contextvars should be isolated per test execution
        request_id = get_request_id()
        assert request_id is None

    def test_set_and_get_request_id(self):
        """set_request_id should store a value that get_request_id retrieves."""
        test_id = "test-request-id-123"
        set_request_id(test_id)
        retrieved_id = get_request_id()
        assert retrieved_id == test_id

    def test_request_id_isolation_across_async_tasks(self):
        """Request IDs should be isolated between concurrent async tasks."""

        async def task_with_request_id(request_id: str) -> str:
            set_request_id(request_id)
            # Simulate async work
            await asyncio.sleep(0.01)
            return get_request_id()

        async def run_test():
            # Run multiple tasks concurrently
            results = await asyncio.gather(
                task_with_request_id("task-1"),
                task_with_request_id("task-2"),
                task_with_request_id("task-3"),
            )
            return results

        results = asyncio.run(run_test())
        # Each task should have its own isolated request ID
        assert results == ["task-1", "task-2", "task-3"]
