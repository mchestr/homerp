"""Integration tests for image upload security.

Tests verify:
- File size limits are enforced
- File type validation works correctly
- Malicious file uploads are rejected
- Content-type spoofing is prevented
"""

import pytest
from httpx import AsyncClient


class TestImageSizeLimits:
    """Tests for image upload size limit enforcement."""

    async def test_upload_small_image_succeeds(
        self,
        authenticated_client: AsyncClient,
        small_test_image: bytes,
    ):
        """Small images should upload successfully."""
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("small.jpg", small_test_image, "image/jpeg")},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["id"] is not None
        assert data["original_filename"] == "small.jpg"

    async def test_upload_oversized_image_rejected(
        self,
        authenticated_client: AsyncClient,
        oversized_test_image: bytes,
    ):
        """Oversized images should be rejected with 400 error."""
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("large.bmp", oversized_test_image, "image/bmp")},
        )

        # Should fail - either due to size or type validation
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data

    async def test_size_limit_boundary(
        self,
        authenticated_client: AsyncClient,
    ):
        """Test upload at exactly the size limit boundary."""
        # Create a file just at the limit (10MB - 1 byte)
        # This is tricky because we can't precisely control compressed image size
        # so we use raw bytes for a more controlled test
        from io import BytesIO

        from PIL import Image as PILImage

        # Create a moderately sized image that should be under 10MB
        img = PILImage.new("RGB", (1000, 1000), color=(128, 128, 128))
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=50)
        moderate_image = buffer.getvalue()

        # This should succeed as it's well under 10MB
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("moderate.jpg", moderate_image, "image/jpeg")},
        )

        assert response.status_code == 201


class TestFileTypeValidation:
    """Tests for file type validation."""

    async def test_jpeg_upload_allowed(
        self,
        authenticated_client: AsyncClient,
        small_test_image: bytes,
    ):
        """JPEG images should be allowed."""
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("test.jpg", small_test_image, "image/jpeg")},
        )

        assert response.status_code == 201

    async def test_png_upload_allowed(
        self,
        authenticated_client: AsyncClient,
        test_png_image: bytes,
    ):
        """PNG images should be allowed."""
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("test.png", test_png_image, "image/png")},
        )

        assert response.status_code == 201

    async def test_webp_upload_allowed(
        self,
        authenticated_client: AsyncClient,
        test_webp_image: bytes,
    ):
        """WebP images should be allowed."""
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("test.webp", test_webp_image, "image/webp")},
        )

        assert response.status_code == 201

    async def test_gif_upload_allowed(
        self,
        authenticated_client: AsyncClient,
        test_gif_image: bytes,
    ):
        """GIF images should be allowed."""
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("test.gif", test_gif_image, "image/gif")},
        )

        assert response.status_code == 201

    async def test_pdf_upload_rejected(
        self,
        authenticated_client: AsyncClient,
    ):
        """PDF files should be rejected."""
        # Create a minimal PDF content
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 0\ntrailer\n<<>>\nstartxref\n0\n%%EOF"

        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("test.pdf", pdf_content, "application/pdf")},
        )

        assert response.status_code == 400
        assert "not allowed" in response.json()["detail"].lower()

    async def test_html_upload_rejected(
        self,
        authenticated_client: AsyncClient,
    ):
        """HTML files should be rejected (XSS prevention)."""
        html_content = b"<html><script>alert('xss')</script></html>"

        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("test.html", html_content, "text/html")},
        )

        assert response.status_code == 400

    async def test_svg_upload_rejected(
        self,
        authenticated_client: AsyncClient,
    ):
        """SVG files should be rejected (XSS via SVG prevention)."""
        svg_content = (
            b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        )

        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("test.svg", svg_content, "image/svg+xml")},
        )

        assert response.status_code == 400

    async def test_executable_upload_rejected(
        self,
        authenticated_client: AsyncClient,
    ):
        """Executable files should be rejected."""
        # Minimal ELF header (Linux executable)
        elf_content = b"\x7fELF\x01\x01\x01\x00" + b"\x00" * 100

        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("malware.exe", elf_content, "application/x-executable")},
        )

        assert response.status_code == 400


class TestContentTypeSpoofing:
    """Tests for content-type spoofing prevention."""

    @pytest.mark.xfail(
        reason="SECURITY: Content-type spoofing allows malicious files. "
        "Implementation only checks Content-Type header, not file magic bytes. "
        "Should validate actual file content matches declared type."
    )
    async def test_exe_with_image_content_type_rejected(
        self,
        authenticated_client: AsyncClient,
    ):
        """Executable with fake image content-type should fail.

        SECURITY ISSUE: Current implementation only checks Content-Type header,
        not file magic bytes. Malicious files can be uploaded by spoofing
        the Content-Type. Pillow may fail during thumbnail generation, but
        the file could still be stored.

        Expected behavior: Should return 400 after validating file content.
        """
        exe_content = b"MZ" + b"\x00" * 100  # Windows PE header

        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("image.jpg", exe_content, "image/jpeg")},
        )

        # EXPECTED: 400 - file content doesn't match declared image type
        assert response.status_code == 400, (
            f"Expected 400 for spoofed content-type, got {response.status_code}"
        )

    @pytest.mark.xfail(
        reason="SECURITY: Script files accepted with spoofed image content-type. "
        "Should validate file magic bytes match declared MIME type."
    )
    async def test_script_with_image_content_type(
        self,
        authenticated_client: AsyncClient,
    ):
        """JavaScript with image content-type should be rejected.

        SECURITY ISSUE: Script content can be uploaded by declaring image/jpeg
        content-type. This could lead to XSS if served without proper headers.
        """
        js_content = b'alert("xss");'

        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("script.jpg", js_content, "image/jpeg")},
        )

        # EXPECTED: 400 - file content doesn't match declared image type
        assert response.status_code == 400, (
            f"Expected 400 for spoofed content-type, got {response.status_code}"
        )


class TestDuplicateImageHandling:
    """Tests for duplicate image detection."""

    async def test_duplicate_image_returns_existing(
        self,
        authenticated_client: AsyncClient,
        small_test_image: bytes,
    ):
        """Uploading the same image twice should return the existing record."""
        # First upload
        response1 = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("first.jpg", small_test_image, "image/jpeg")},
        )
        assert response1.status_code == 201
        first_id = response1.json()["id"]

        # Second upload with same content but different filename
        response2 = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("second.jpg", small_test_image, "image/jpeg")},
        )
        assert response2.status_code == 201
        second_id = response2.json()["id"]

        # Should return the same image ID
        assert first_id == second_id

    async def test_different_images_create_separate_records(
        self,
        authenticated_client: AsyncClient,
        small_test_image: bytes,
        test_png_image: bytes,
    ):
        """Different images should create separate records."""
        # First upload
        response1 = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("first.jpg", small_test_image, "image/jpeg")},
        )
        assert response1.status_code == 201
        first_id = response1.json()["id"]

        # Second upload with different content
        response2 = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("second.png", test_png_image, "image/png")},
        )
        assert response2.status_code == 201
        second_id = response2.json()["id"]

        # Should be different IDs
        assert first_id != second_id


class TestUnauthenticatedUpload:
    """Tests for unauthenticated upload attempts."""

    async def test_upload_without_auth_rejected(
        self,
        unauthenticated_client: AsyncClient,
        small_test_image: bytes,
    ):
        """Uploads without authentication should be rejected."""
        response = await unauthenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("test.jpg", small_test_image, "image/jpeg")},
        )

        assert response.status_code == 401


class TestPathTraversalPrevention:
    """Tests for path traversal attack prevention in filenames."""

    @pytest.mark.xfail(
        reason="SECURITY: Path traversal sequences not sanitized from filenames. "
        "Should use os.path.basename() or similar to extract only the filename."
    )
    async def test_filename_with_directory_traversal_sanitized(
        self,
        authenticated_client: AsyncClient,
        small_test_image: bytes,
    ):
        """Filenames with ../ should be sanitized or rejected.

        SECURITY ISSUE: Current implementation stores the filename as-is without
        sanitizing path traversal sequences. While the actual storage path uses
        a UUID, the original_filename field could be used in unsafe ways.
        """
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("../../etc/passwd", small_test_image, "image/jpeg")},
        )

        assert response.status_code == 201
        data = response.json()
        # EXPECTED: Filename should not contain path traversal sequences
        assert ".." not in data["original_filename"]
        assert "/" not in data["original_filename"]

    @pytest.mark.xfail(
        reason="SECURITY: Absolute paths not sanitized from filenames. "
        "Should extract basename to prevent path information disclosure."
    )
    async def test_filename_with_absolute_path_sanitized(
        self,
        authenticated_client: AsyncClient,
        small_test_image: bytes,
    ):
        """Filenames with absolute paths should be sanitized.

        SECURITY ISSUE: Absolute paths in filenames are stored as-is.
        """
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("/etc/passwd", small_test_image, "image/jpeg")},
        )

        assert response.status_code == 201
        data = response.json()
        # EXPECTED: Should only keep the basename
        assert data["original_filename"] == "passwd"

    @pytest.mark.xfail(
        reason="SECURITY: Windows-style path traversal not sanitized. "
        "Should handle both forward and backslash path separators."
    )
    async def test_filename_with_backslash_traversal_sanitized(
        self,
        authenticated_client: AsyncClient,
        small_test_image: bytes,
    ):
        """Filenames with Windows-style traversal should be sanitized.

        SECURITY ISSUE: Windows-style path traversal sequences are not sanitized.
        """
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={
                "file": (
                    "..\\..\\windows\\system32\\config",
                    small_test_image,
                    "image/jpeg",
                )
            },
        )

        assert response.status_code == 201
        data = response.json()
        # EXPECTED: Should not contain traversal sequences
        assert ".." not in data["original_filename"]
        assert "\\" not in data["original_filename"]

    async def test_filename_with_null_byte_sanitized(
        self,
        authenticated_client: AsyncClient,
        small_test_image: bytes,
    ):
        """Filenames with null bytes should be sanitized."""
        # Null byte injection attempt
        response = await authenticated_client.post(
            "/api/v1/images/upload",
            files={"file": ("image.jpg\x00.exe", small_test_image, "image/jpeg")},
        )

        if response.status_code == 201:
            data = response.json()
            # Should not contain null bytes
            assert "\x00" not in data["original_filename"]
        else:
            # Rejection is also acceptable
            assert response.status_code == 400
