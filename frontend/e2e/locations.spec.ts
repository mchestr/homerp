import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Locations", () => {
  test("displays locations page", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/locations");

    await expect(
      page.getByRole("heading", { name: /locations/i })
    ).toBeVisible();
    await expect(page.getByText("Workshop")).toBeVisible();
  });

  test("can create new location", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/locations");

    await page.getByTestId("add-location-button").click();

    const nameInput = page.getByTestId("location-name-input");
    await expect(nameInput).toBeVisible();

    await nameInput.fill("Storage Room");

    await page.getByTestId("location-submit-button").click();

    // Form should close after successful submission
    await expect(nameInput).not.toBeVisible();
    // Add button should reappear
    await expect(page.getByTestId("add-location-button")).toBeVisible();
  });
});

test.describe("Location Photo", () => {
  test("displays upload area when location has no photo", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    // Navigate to location detail page
    await page.goto(`/locations/${fixtures.testLocations[0].id}`);

    // Wait for the page to load
    await expect(
      page.getByRole("heading", { name: fixtures.testLocations[0].name })
    ).toBeVisible();

    // Check that upload area is visible (no photo by default)
    const uploadArea = page.getByTestId("location-photo-upload");
    await expect(uploadArea).toBeVisible();
  });

  test("displays photo when location has one", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    // Pre-populate location images by setting up a custom route handler
    await page.route(/\/api\/v1\/images\/location\/loc-1$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([fixtures.testLocationImage]),
      });
    });

    // Navigate to location detail page
    await page.goto(`/locations/${fixtures.testLocations[0].id}`);

    // Wait for the page to load
    await expect(
      page.getByRole("heading", { name: fixtures.testLocations[0].name })
    ).toBeVisible();

    // Photo container should be visible (may take time for image to load)
    await expect(page.getByTestId("location-photo")).toBeVisible({
      timeout: 10000,
    });

    // Upload area should not be visible
    await expect(page.getByTestId("location-photo-upload")).not.toBeVisible();
  });

  test("can remove photo from location", async ({ page }) => {
    await authenticateUser(page);

    // Track whether photo has been removed
    let photoRemoved = false;

    await setupApiMocks(page);

    // Setup location images route with state
    await page.route(/\/api\/v1\/images\/location\/loc-1$/, async (route) => {
      if (photoRemoved) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([fixtures.testLocationImage]),
        });
      }
    });

    // Setup detach route to update state
    await page.route(
      /\/api\/v1\/images\/[^/]+\/detach-location$/,
      async (route) => {
        photoRemoved = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...fixtures.testLocationImage,
            location_id: null,
            is_primary: false,
          }),
        });
      }
    );

    // Navigate to location detail page
    await page.goto(`/locations/${fixtures.testLocations[0].id}`);

    // Wait for the page to load
    await expect(
      page.getByRole("heading", { name: fixtures.testLocations[0].name })
    ).toBeVisible();

    // Photo container should be visible
    await expect(page.getByTestId("location-photo")).toBeVisible({
      timeout: 10000,
    });

    // Hover over the photo to reveal the remove button
    const photoContainer = page.getByTestId("location-photo");
    await photoContainer.hover();

    // Click the remove button
    const removeButton = page.getByTestId("remove-location-photo");
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Wait for the photo to be removed and upload area to appear
    await expect(page.getByTestId("location-photo-upload")).toBeVisible({
      timeout: 10000,
    });
  });
});
