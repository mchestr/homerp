"""Tests for image storage security."""

import tempfile
from pathlib import Path

import pytest

from src.images.storage import LocalStorage, PathTraversalError


class TestPathTraversalProtection:
    """Test path traversal protection in LocalStorage."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = Path(tempfile.mkdtemp()).resolve()

    def test_simple_filename_allowed(self):
        """Simple filenames should work normally."""

        class FakeSettings:
            upload_dir = str(self.temp_dir)

        storage = LocalStorage(settings=FakeSettings())
        path = storage._get_file_path("image.jpg")
        assert path.name == "image.jpg"
        assert path.parent == self.temp_dir

    def test_path_traversal_stripped(self):
        """Path traversal sequences should be stripped to just filename."""

        class FakeSettings:
            upload_dir = str(self.temp_dir)

        storage = LocalStorage(settings=FakeSettings())

        # The Path.name extraction should strip the traversal
        path = storage._get_file_path("../../../etc/passwd")
        assert path.name == "passwd"
        assert path.parent == self.temp_dir

    def test_absolute_path_stripped(self):
        """Absolute paths should be converted to just the filename."""

        class FakeSettings:
            upload_dir = str(self.temp_dir)

        storage = LocalStorage(settings=FakeSettings())

        path = storage._get_file_path("/etc/passwd")
        assert path.name == "passwd"
        assert path.parent == self.temp_dir

    def test_generated_filename_is_safe(self):
        """Generated filenames should always be safe."""

        class FakeSettings:
            upload_dir = str(self.temp_dir)

        storage = LocalStorage(settings=FakeSettings())

        # Even if original filename has traversal, generated should be UUID
        filename = storage._generate_filename("../../../etc/passwd")
        # Generated filename should be a UUID with extension
        assert "/" not in filename
        assert ".." not in filename

    def test_get_full_path_protected(self):
        """get_full_path should also be protected."""

        class FakeSettings:
            upload_dir = str(self.temp_dir)

        storage = LocalStorage(settings=FakeSettings())

        path = storage.get_full_path("../../../etc/passwd")
        assert path.name == "passwd"
        assert path.parent == self.temp_dir

    def test_symlink_escaping_blocked(self):
        """Symlinks pointing outside upload_dir should raise PathTraversalError."""
        import os

        class FakeSettings:
            upload_dir = str(self.temp_dir)

        storage = LocalStorage(settings=FakeSettings())

        # Create a symlink that points outside the upload directory
        symlink_path = self.temp_dir / "evil_link"
        try:
            os.symlink("/etc", symlink_path)
        except OSError:
            pytest.skip("Cannot create symlinks on this system")

        # When the symlink is resolved, it should detect the escape attempt
        # and raise PathTraversalError
        with pytest.raises(PathTraversalError):
            storage._get_file_path("evil_link")

    def test_nested_traversal_stripped(self):
        """Nested path components should be stripped."""

        class FakeSettings:
            upload_dir = str(self.temp_dir)

        storage = LocalStorage(settings=FakeSettings())

        path = storage._get_file_path("foo/bar/baz/image.jpg")
        # Only the final component should remain
        assert path.name == "image.jpg"
        assert path.parent == self.temp_dir

    def test_dot_dot_slash_variations(self):
        """Various path traversal patterns should all be handled."""

        class FakeSettings:
            upload_dir = str(self.temp_dir)

        storage = LocalStorage(settings=FakeSettings())

        test_cases = [
            ("../file.jpg", "file.jpg"),
            ("../../file.jpg", "file.jpg"),
            ("../../../file.jpg", "file.jpg"),
            ("./file.jpg", "file.jpg"),
            ("dir/../file.jpg", "file.jpg"),
        ]

        for input_path, expected_name in test_cases:
            path = storage._get_file_path(input_path)
            assert path.name == expected_name, f"Failed for input: {input_path}"
            assert path.parent == self.temp_dir, f"Parent mismatch for: {input_path}"

    async def test_read_with_traversal_path_is_sanitized(self):
        """Read operation should use sanitized path."""

        class FakeSettings:
            upload_dir = str(self.temp_dir)

        storage = LocalStorage(settings=FakeSettings())

        # Create a file with a normal name
        test_file = self.temp_dir / "testfile.txt"
        test_file.write_text("test content")

        # Try to read with traversal - should find the sanitized file
        content = await storage.read("../testfile.txt")
        assert content == b"test content"

    async def test_delete_with_traversal_uses_safe_path(self):
        """Delete operation should use sanitized path."""

        class FakeSettings:
            upload_dir = str(self.temp_dir)

        storage = LocalStorage(settings=FakeSettings())

        # Create a file
        test_file = self.temp_dir / "to_delete.txt"
        test_file.write_text("delete me")

        # Delete using traversal path - should delete the sanitized file
        await storage.delete("../to_delete.txt")
        assert not test_file.exists()
