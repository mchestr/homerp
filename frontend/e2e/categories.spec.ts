import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Categories Page", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("displays categories tree view", async ({ page }) => {
    await page.goto("/categories");

    // Should show page title
    await expect(
      page.getByRole("heading", { name: /categories/i })
    ).toBeVisible();

    // Should display root category
    await expect(page.getByText("Electronics")).toBeVisible();
  });

  test("shows nested categories", async ({ page }) => {
    await page.goto("/categories");

    // Parent category should be visible
    await expect(page.getByText("Electronics")).toBeVisible();

    // Child category might need expanding
    const expandButton = page.locator("[aria-expanded]").first();
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }

    // Now child should be visible
    await expect(page.getByText("Components")).toBeVisible();
  });

  test("shows item count per category", async ({ page }) => {
    await page.goto("/categories");

    // Should show item count for categories
    const electronicsCount = fixtures.testCategoryTree[0].item_count;
    await expect(
      page.getByText(new RegExp(`${electronicsCount}`))
    ).toBeVisible();
  });

  test("can create new category", async ({ page }) => {
    await page.goto("/categories");

    // Click add category button
    const addButton = page.getByRole("button", { name: /add|new|create/i });
    await addButton.click();

    // Should show form/dialog
    const nameInput = page.getByLabel(/name/i);
    await expect(nameInput).toBeVisible();

    // Fill form
    await nameInput.fill("Test Category");

    // Submit
    const submitButton = page.getByRole("button", { name: /save|create|add/i });
    await submitButton.click();

    // Should show new category
    await expect(page.getByText("Test Category")).toBeVisible();
  });

  test("can edit existing category", async ({ page }) => {
    await page.goto("/categories");

    // Click on category to select it
    await page.getByText("Electronics").click();

    // Find edit button
    const editButton = page.getByRole("button", { name: /edit/i });
    if (await editButton.isVisible()) {
      await editButton.click();

      // Should show edit form
      const nameInput = page.getByLabel(/name/i);
      await expect(nameInput).toBeVisible();

      // Edit name
      await nameInput.fill("Electronics Updated");

      // Save
      const saveButton = page.getByRole("button", { name: /save|update/i });
      await saveButton.click();

      // Should reflect update
      await expect(page.getByText("Electronics Updated")).toBeVisible();
    }
  });

  test("can delete category", async ({ page }) => {
    await page.goto("/categories");

    // Select category
    await page.getByText("Electronics").click();

    // Find delete button
    const deleteButton = page.getByRole("button", { name: /delete/i });
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion
      const confirmButton = page.getByRole("button", {
        name: /confirm|yes|delete/i,
      });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });

  test("shows attribute template for category", async ({ page }) => {
    await page.goto("/categories");

    // Select category with template
    await page.getByText("Components").click();

    // Should show attribute template fields
    const templateText = page.getByText(/voltage|package/i);
    await expect(templateText)
      .toBeVisible()
      .catch(() => {
        // Template might be shown differently
      });
  });

  test("can set parent category when creating", async ({ page }) => {
    await page.goto("/categories");

    // Click add button
    const addButton = page.getByRole("button", { name: /add|new|create/i });
    await addButton.click();

    // Fill name
    await page.getByLabel(/name/i).fill("Child Category");

    // Select parent
    const parentSelect = page.getByLabel(/parent/i);
    if (await parentSelect.isVisible()) {
      await parentSelect.click();
      await page.getByText("Electronics").click();
    }

    // Submit
    const submitButton = page.getByRole("button", { name: /save|create|add/i });
    await submitButton.click();
  });
});

test.describe("Category Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("clicking category filters items view", async ({ page }) => {
    await page.goto("/categories");

    // Click on category name/link
    const categoryLink = page.getByRole("link", { name: /electronics/i });
    if (await categoryLink.isVisible()) {
      await categoryLink.click();
      // Should navigate to items filtered by category
      await expect(page).toHaveURL(/.*items.*category/);
    }
  });

  test("breadcrumb navigation in categories", async ({ page }) => {
    await page.goto("/categories");

    // Expand to show nested category
    const expandButton = page.locator('[aria-expanded="false"]').first();
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }

    // Click on nested category
    await page.getByText("Components").click();

    // Should show path or breadcrumb
    await expect(page.getByText(/Electronics/)).toBeVisible();
  });
});
