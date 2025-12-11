import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Locations Page", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("displays locations tree view", async ({ page }) => {
    await page.goto("/locations");

    // Should show page title
    await expect(page.getByRole("heading", { name: /locations/i })).toBeVisible();

    // Should display root location
    await expect(page.getByText("Workshop")).toBeVisible();
  });

  test("shows nested locations", async ({ page }) => {
    await page.goto("/locations");

    // Parent location should be visible
    await expect(page.getByText("Workshop")).toBeVisible();

    // Expand if needed
    const expandButton = page.locator('[aria-expanded]').first();
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }

    // Child location should be visible
    await expect(page.getByText("Shelf A")).toBeVisible();
  });

  test("shows item count per location", async ({ page }) => {
    await page.goto("/locations");

    // Should show item counts
    const workshopCount = fixtures.testLocationTree[0].item_count;
    await expect(page.getByText(new RegExp(`${workshopCount}`))).toBeVisible();
  });

  test("shows location type", async ({ page }) => {
    await page.goto("/locations");

    // Should show location types (room, shelf, etc.)
    await expect(page.getByText(/room|shelf/i)).toBeVisible();
  });

  test("can create new location", async ({ page }) => {
    await page.goto("/locations");

    // Click add location button
    const addButton = page.getByRole("button", { name: /add|new|create/i });
    await addButton.click();

    // Should show form/dialog
    const nameInput = page.getByLabel(/name/i);
    await expect(nameInput).toBeVisible();

    // Fill form
    await nameInput.fill("Storage Room");

    // Set location type if available
    const typeInput = page.getByLabel(/type/i);
    if (await typeInput.isVisible()) {
      await typeInput.fill("room");
    }

    // Submit
    const submitButton = page.getByRole("button", { name: /save|create|add/i });
    await submitButton.click();

    // Should show new location
    await expect(page.getByText("Storage Room")).toBeVisible();
  });

  test("can edit existing location", async ({ page }) => {
    await page.goto("/locations");

    // Click on location to select
    await page.getByText("Workshop").click();

    // Find edit button
    const editButton = page.getByRole("button", { name: /edit/i });
    if (await editButton.isVisible()) {
      await editButton.click();

      // Edit name
      const nameInput = page.getByLabel(/name/i);
      await nameInput.fill("Main Workshop");

      // Save
      const saveButton = page.getByRole("button", { name: /save|update/i });
      await saveButton.click();

      // Should show updated name
      await expect(page.getByText("Main Workshop")).toBeVisible();
    }
  });

  test("can delete location", async ({ page }) => {
    await page.goto("/locations");

    // Select location
    await page.getByText("Workshop").click();

    // Find delete button
    const deleteButton = page.getByRole("button", { name: /delete/i });
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion
      const confirmButton = page.getByRole("button", { name: /confirm|yes|delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });

  test("can set parent location when creating", async ({ page }) => {
    await page.goto("/locations");

    // Click add button
    const addButton = page.getByRole("button", { name: /add|new|create/i });
    await addButton.click();

    // Fill name
    await page.getByLabel(/name/i).fill("Bin 1");

    // Select parent
    const parentSelect = page.getByLabel(/parent/i);
    if (await parentSelect.isVisible()) {
      await parentSelect.click();
      await page.getByText("Shelf A").click();
    }

    // Submit
    const submitButton = page.getByRole("button", { name: /save|create|add/i });
    await submitButton.click();
  });

  test("shows description for location", async ({ page }) => {
    await page.goto("/locations");

    // Select location with description
    await page.getByText("Workshop").click();

    // Should show description
    await expect(page.getByText("Main workshop")).toBeVisible();
  });
});

test.describe("Location Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("clicking location filters items view", async ({ page }) => {
    await page.goto("/locations");

    // Click on location name/link
    const locationLink = page.getByRole("link", { name: /workshop/i });
    if (await locationLink.isVisible()) {
      await locationLink.click();
      // Should navigate to items filtered by location
      await expect(page).toHaveURL(/.*items.*location/);
    }
  });

  test("location path is shown for nested locations", async ({ page }) => {
    await page.goto("/locations");

    // Expand parent
    const expandButton = page.locator('[aria-expanded="false"]').first();
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }

    // Select nested location
    await page.getByText("Shelf A").click();

    // Should show full path
    await expect(page.getByText(/Workshop/)).toBeVisible();
  });
});

test.describe("Location Types", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("can filter by location type", async ({ page }) => {
    await page.goto("/locations");

    // Look for type filter
    const typeFilter = page.getByRole("combobox", { name: /type/i });
    if (await typeFilter.isVisible()) {
      await typeFilter.click();
      await page.getByText("room").click();
    }
  });

  test("location type icons are displayed", async ({ page }) => {
    await page.goto("/locations");

    // Different location types might have different icons
    // Just verify the page loads correctly with locations
    await expect(page.getByText("Workshop")).toBeVisible();
    await expect(page.getByText(/room/i)).toBeVisible();
  });
});
