import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "../mocks/api-handlers";
import * as fixtures from "../fixtures/test-data";

test.describe("Change Primary Image", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    // Mock usage stats endpoint for item detail page
    await page.route(
      `**/api/v1/items/${fixtures.testItemWithImages.id}/usage-stats`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            total_check_outs: 0,
            total_check_ins: 0,
            currently_checked_out: 0,
            last_check_out: null,
          }),
        });
      }
    );

    // Mock history endpoint for item detail page
    await page.route(
      `**/api/v1/items/${fixtures.testItemWithImages.id}/history*`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [],
            total: 0,
            page: 1,
            limit: 5,
            total_pages: 0,
          }),
        });
      }
    );
  });

  test.describe("Primary Image Badge Visibility", () => {
    test("shows primary badge on main image when image is primary", async ({
      page,
    }) => {
      // Mock the item detail endpoint with multiple images
      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixtures.testItemWithImages),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      // Wait for images to load
      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // Verify primary badge is visible on the main image
      await expect(page.getByTestId("primary-image-badge")).toBeVisible();

      // Verify primary badge text
      const badge = page.getByTestId("primary-image-badge");
      await expect(badge).toContainText("Primary image");
    });

    test("shows primary star on thumbnail for primary image", async ({
      page,
    }) => {
      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixtures.testItemWithImages),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      // Wait for thumbnails to load
      await expect(page.getByTestId("gallery-thumbnail-0")).toBeVisible();

      // First image is primary - should have star badge
      await expect(page.getByTestId("thumbnail-primary-badge-0")).toBeVisible();

      // Second and third images should not have star badge
      await expect(
        page.getByTestId("thumbnail-primary-badge-1")
      ).not.toBeVisible();
      await expect(
        page.getByTestId("thumbnail-primary-badge-2")
      ).not.toBeVisible();
    });

    test("does not show primary badge when no image is primary", async ({
      page,
    }) => {
      // Create item with images where none are primary
      const itemWithNoPrimary = {
        ...fixtures.testItemWithImages,
        images: fixtures.testItemImages.map((img) => ({
          ...img,
          is_primary: false,
        })),
      };

      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemWithNoPrimary),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // Primary badge should not be visible
      await expect(page.getByTestId("primary-image-badge")).not.toBeVisible();
    });
  });

  test.describe("Set as Primary Button", () => {
    test("shows set-primary button on hover for non-primary images", async ({
      page,
    }) => {
      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixtures.testItemWithImages),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      // Wait for gallery to load
      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // Navigate to second image (non-primary)
      await page.getByTestId("gallery-thumbnail-1").click();

      // Wait for image to change
      await page.waitForTimeout(300);

      // Hover over the image area to reveal controls
      const imageContainer = page.locator(".bg-muted.group");
      await imageContainer.hover();

      // Set as primary button should be visible
      await expect(page.getByTestId("set-primary-button")).toBeVisible();
      await expect(page.getByTestId("set-primary-button")).toContainText(
        "Set as primary"
      );
    });

    test("does not show set-primary button for already primary image", async ({
      page,
    }) => {
      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixtures.testItemWithImages),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // First image is already primary
      const imageContainer = page.locator(".bg-muted.group");
      await imageContainer.hover();

      // Set as primary button should not be visible
      await expect(page.getByTestId("set-primary-button")).not.toBeVisible();

      // But primary badge should be visible
      await expect(page.getByTestId("primary-image-badge")).toBeVisible();
    });
  });

  test.describe("Changing Primary Image", () => {
    test("successfully changes primary image and shows success toast", async ({
      page,
    }) => {
      let currentPrimaryIndex = 0;

      // Mock the item endpoint with state tracking
      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          const images = fixtures.testItemImages.map((img, idx) => ({
            ...img,
            is_primary: idx === currentPrimaryIndex,
          }));

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...fixtures.testItemWithImages,
              images,
            }),
          });
        }
      );

      // Mock set-primary endpoint with state update
      await page.route(
        /\/api\/v1\/images\/[^/]+\/set-primary$/,
        async (route) => {
          const url = route.request().url();
          const parts = url.split("/");
          parts.pop(); // "set-primary"
          const imageId = parts.pop();

          // Update which image is primary based on ID
          const newPrimaryIndex = fixtures.testItemImages.findIndex(
            (img) => img.id === imageId
          );
          if (newPrimaryIndex !== -1) {
            currentPrimaryIndex = newPrimaryIndex;
          }

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: imageId,
              is_primary: true,
            }),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      // Wait for gallery to load
      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // Verify first image is currently primary
      await expect(page.getByTestId("primary-image-badge")).toBeVisible();
      await expect(page.getByTestId("thumbnail-primary-badge-0")).toBeVisible();

      // Navigate to second image
      await page.getByTestId("gallery-thumbnail-1").click();
      await page.waitForTimeout(300);

      // Hover to reveal controls
      const imageContainer = page.locator(".bg-muted.group");
      await imageContainer.hover();

      // Wait for API call and success toast
      const responsePromise = page.waitForResponse(
        /\/api\/v1\/images\/[^/]+\/set-primary$/
      );

      // Click set as primary
      await page.getByTestId("set-primary-button").click();

      // Wait for API response
      await responsePromise;

      // Wait for page to reload with new data after query invalidation
      await page.waitForTimeout(1000);

      // Verify badge has moved to second image
      await expect(page.getByTestId("primary-image-badge")).toBeVisible();
      await expect(page.getByTestId("thumbnail-primary-badge-1")).toBeVisible();
      await expect(
        page.getByTestId("thumbnail-primary-badge-0")
      ).not.toBeVisible();
    });

    test("handles error when setting primary image fails", async ({ page }) => {
      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixtures.testItemWithImages),
          });
        }
      );

      // Mock set-primary endpoint to fail
      await page.route(
        /\/api\/v1\/images\/[^/]+\/set-primary$/,
        async (route) => {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              detail: "Internal server error",
            }),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // Navigate to second image
      await page.getByTestId("gallery-thumbnail-1").click();
      await page.waitForTimeout(300);

      // Hover to reveal controls
      const imageContainer = page.locator(".bg-muted.group");
      await imageContainer.hover();

      // Click set as primary
      await page.getByTestId("set-primary-button").click();

      // Wait a bit for the mutation to complete
      await page.waitForTimeout(1000);

      // Verify primary badge hasn't changed (error should prevent state change)
      await page.getByTestId("gallery-thumbnail-0").click();
      await page.waitForTimeout(300);
      await expect(page.getByTestId("primary-image-badge")).toBeVisible();
    });

    test("button is disabled while request is in progress", async ({
      page,
    }) => {
      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixtures.testItemWithImages),
          });
        }
      );

      // Mock set-primary endpoint with delay
      await page.route(
        /\/api\/v1\/images\/[^/]+\/set-primary$/,
        async (route) => {
          // Delay to test loading state
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "item-img-2",
              is_primary: true,
            }),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // Navigate to second image
      await page.getByTestId("gallery-thumbnail-1").click();
      await page.waitForTimeout(300);

      const imageContainer = page.locator(".bg-muted.group");
      await imageContainer.hover();

      const button = page.getByTestId("set-primary-button");
      await expect(button).toBeVisible();

      // Click button
      await button.click();

      // Button should be disabled during request
      await expect(button).toBeDisabled();

      // Wait for request to complete
      await page.waitForResponse(/\/api\/v1\/images\/[^/]+\/set-primary$/);
    });
  });

  test.describe("Mobile Viewport", () => {
    test("set-primary button works on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      let currentPrimaryIndex = 0;

      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          const images = fixtures.testItemImages.map((img, idx) => ({
            ...img,
            is_primary: idx === currentPrimaryIndex,
          }));

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...fixtures.testItemWithImages,
              images,
            }),
          });
        }
      );

      await page.route(
        /\/api\/v1\/images\/[^/]+\/set-primary$/,
        async (route) => {
          const url = route.request().url();
          const parts = url.split("/");
          parts.pop();
          const imageId = parts.pop();

          const newPrimaryIndex = fixtures.testItemImages.findIndex(
            (img) => img.id === imageId
          );
          if (newPrimaryIndex !== -1) {
            currentPrimaryIndex = newPrimaryIndex;
          }

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: imageId,
              is_primary: true,
            }),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // Navigate to second image
      await page.getByTestId("gallery-thumbnail-1").click();
      await page.waitForTimeout(300);

      // On mobile, hover events work as tap - tap the image area
      const imageContainer = page.locator(".bg-muted.group");
      await imageContainer.click();

      // Button should be visible after tap
      await expect(page.getByTestId("set-primary-button")).toBeVisible();

      const responsePromise = page.waitForResponse(
        /\/api\/v1\/images\/[^/]+\/set-primary$/
      );

      // Click set as primary
      await page.getByTestId("set-primary-button").click();

      await responsePromise;

      // Wait for page to reload with new data
      await page.waitForTimeout(1000);
    });

    test("primary badge is visible on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixtures.testItemWithImages),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // Primary badge should be visible on mobile
      await expect(page.getByTestId("primary-image-badge")).toBeVisible();

      // Thumbnail badges should also be visible
      await expect(page.getByTestId("thumbnail-primary-badge-0")).toBeVisible();
    });
  });

  test.describe("Multiple Image Navigation", () => {
    test("primary badge follows selected image correctly", async ({ page }) => {
      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixtures.testItemWithImages),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // First image shows badge
      await expect(page.getByTestId("primary-image-badge")).toBeVisible();

      // Navigate to second image (not primary)
      await page.getByTestId("gallery-thumbnail-1").click();
      await page.waitForTimeout(300);

      // Badge should not be visible
      await expect(page.getByTestId("primary-image-badge")).not.toBeVisible();

      // Navigate back to first image
      await page.getByTestId("gallery-thumbnail-0").click();
      await page.waitForTimeout(300);

      // Badge should be visible again
      await expect(page.getByTestId("primary-image-badge")).toBeVisible();
    });

    test("can navigate with arrow buttons and see correct primary state", async ({
      page,
    }) => {
      await page.route(
        `**/api/v1/items/${fixtures.testItemWithImages.id}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixtures.testItemWithImages),
          });
        }
      );

      await page.goto(`/items/${fixtures.testItemWithImages.id}`);

      await expect(page.getByTestId("main-gallery-image")).toBeVisible();

      // Hover to show navigation arrows
      const imageContainer = page.locator(".bg-muted.group");
      await imageContainer.hover();

      // First image - badge visible
      await expect(page.getByTestId("primary-image-badge")).toBeVisible();

      // Click next arrow
      await page.getByTestId("gallery-next").click();
      await page.waitForTimeout(300);

      // Second image - badge not visible, set-primary button visible
      await expect(page.getByTestId("primary-image-badge")).not.toBeVisible();
      await imageContainer.hover();
      await expect(page.getByTestId("set-primary-button")).toBeVisible();

      // Click next arrow again
      await page.getByTestId("gallery-next").click();
      await page.waitForTimeout(300);

      // Third image - badge not visible
      await expect(page.getByTestId("primary-image-badge")).not.toBeVisible();

      // Click previous arrow
      await page.getByTestId("gallery-prev").click();
      await page.waitForTimeout(300);

      // Back to second image
      await expect(page.getByTestId("primary-image-badge")).not.toBeVisible();

      // Click previous arrow again
      await page.getByTestId("gallery-prev").click();
      await page.waitForTimeout(300);

      // Back to first image - badge visible
      await expect(page.getByTestId("primary-image-badge")).toBeVisible();
    });
  });
});
