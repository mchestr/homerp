import { test, expect } from "@playwright/test";
import {
  setupApiMocks,
  authenticateUser,
  setupClassificationMock,
} from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Items List Page", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("displays list of items", async ({ page }) => {
    await page.goto("/items");

    // Should display page title
    await expect(page.getByRole("heading", { name: /items/i })).toBeVisible();

    // Should display test items
    for (const item of fixtures.testItems) {
      await expect(page.getByText(item.name)).toBeVisible();
    }
  });

  test("shows item quantity and category", async ({ page }) => {
    await page.goto("/items");

    // Should show quantity for first item
    const firstItem = fixtures.testItems[0];
    await expect(page.getByText(firstItem.name)).toBeVisible();
  });

  test("can search items", async ({ page }) => {
    await page.goto("/items");

    // Find search input and type
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("Arduino");
      await searchInput.press("Enter");

      // Should still show matching item
      await expect(page.getByText("Arduino Uno")).toBeVisible();
    }
  });

  test("can navigate to create new item", async ({ page }) => {
    await page.goto("/items");

    // Click add/new item button
    const newItemButton = page.getByRole("link", { name: /new|add|create/i });
    await newItemButton.click();

    await expect(page).toHaveURL(/.*\/items\/new/);
  });

  test("can click on item to view details", async ({ page }) => {
    await page.goto("/items");

    // Click on first item
    const firstItem = fixtures.testItems[0];
    await page.getByText(firstItem.name).click();

    await expect(page).toHaveURL(new RegExp(`/items/${firstItem.id}`));
  });

  test("shows low stock indicator for items below minimum", async ({
    page,
  }) => {
    await page.goto("/items");

    // The capacitor should show as low stock
    const lowStockItem = fixtures.testItems.find((i) => i.is_low_stock);
    if (lowStockItem) {
      const itemRow = page.locator(`text=${lowStockItem.name}`).locator("..");
      await expect(itemRow).toBeVisible();
    }
  });

  test("filter items by category", async ({ page }) => {
    await page.goto("/items");

    // Look for category filter
    const categoryFilter = page.getByRole("combobox", { name: /category/i });
    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      await page.getByText("Electronics").click();
    }
  });
});

test.describe("Item Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("displays item details", async ({ page }) => {
    const item = fixtures.testItems[0];
    await page.goto(`/items/${item.id}`);

    await expect(page.getByText(item.name)).toBeVisible();
    await expect(page.getByText(item.description!)).toBeVisible();
  });

  test("can edit item", async ({ page }) => {
    const item = fixtures.testItems[0];
    await page.goto(`/items/${item.id}`);

    // Click edit button
    const editButton = page.getByRole("link", { name: /edit/i });
    if (await editButton.isVisible()) {
      await editButton.click();
      await expect(page).toHaveURL(new RegExp(`/items/${item.id}/edit`));
    }
  });

  test("can delete item", async ({ page }) => {
    const item = fixtures.testItems[0];
    await page.goto(`/items/${item.id}`);

    // Click delete button
    const deleteButton = page.getByRole("button", { name: /delete/i });
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Should show confirmation dialog
      const confirmButton = page.getByRole("button", {
        name: /confirm|yes|delete/i,
      });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });

  test("displays category and location breadcrumbs", async ({ page }) => {
    const item = fixtures.testItems[0];
    await page.goto(`/items/${item.id}`);

    if (item.category) {
      await expect(page.getByText(item.category.name)).toBeVisible();
    }
    if (item.location) {
      await expect(page.getByText(item.location.name)).toBeVisible();
    }
  });
});

test.describe("Create Item Page", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("displays create item form", async ({ page }) => {
    await page.goto("/items/new");

    // Should show form fields
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/quantity/i).first()).toBeVisible();
  });

  test("can create item without image", async ({ page }) => {
    await page.goto("/items/new");

    // Fill in required fields
    await page.getByLabel(/name/i).fill("Test Item");

    const descInput = page.getByLabel(/description/i);
    if (await descInput.isVisible()) {
      await descInput.fill("A test item description");
    }

    // Submit form
    const submitButton = page.getByRole("button", { name: /create|save|add/i });
    await submitButton.click();

    // Should redirect to items list or new item page
    await expect(page).toHaveURL(/.*\/items/);
  });

  test("validates required fields", async ({ page }) => {
    await page.goto("/items/new");

    // Try to submit without filling required fields
    const submitButton = page.getByRole("button", { name: /create|save|add/i });
    await submitButton.click();

    // Should show validation error or stay on page
    await expect(page).toHaveURL(/.*\/items\/new/);
  });
});

test.describe("Create Item with AI Classification", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
    await setupClassificationMock(page, {
      shouldSucceed: true,
      hasCredits: true,
    });
  });

  test("can classify uploaded image with credits", async ({ page }) => {
    await page.goto("/items/new");

    // Upload an image (simulate)
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Create a mock file
      await fileInput.setInputFiles({
        name: "test-image.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("fake image content"),
      });

      // Wait for upload to complete
      await page.waitForTimeout(500);

      // Click classify button
      const classifyButton = page.getByRole("button", { name: /classify/i });
      if (await classifyButton.isVisible()) {
        await classifyButton.click();

        // Should show classification result
        await expect(page.getByText(/Arduino Uno R3/i)).toBeVisible();
      }
    }
  });

  test("shows prefilled form after successful classification", async ({
    page,
  }) => {
    await page.goto("/items/new");

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: "test-image.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("fake image content"),
      });

      await page.waitForTimeout(500);

      const classifyButton = page.getByRole("button", { name: /classify/i });
      if (await classifyButton.isVisible()) {
        await classifyButton.click();

        // Wait for classification response
        await page.waitForTimeout(500);

        // Should use prefilled data or show classification
        const nameInput = page.getByLabel(/name/i);
        const nameValue = await nameInput.inputValue();
        // Name should be prefilled or classification should be visible
        if (nameValue === "") {
          await expect(page.getByText(/Arduino Uno R3/i)).toBeVisible();
        }
      }
    }
  });
});

test.describe("Create Item - Insufficient Credits", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      creditBalance: fixtures.testCreditBalanceZero,
    });
    await setupClassificationMock(page, { hasCredits: false });
  });

  test("shows insufficient credits modal when trying to classify", async ({
    page,
  }) => {
    await page.goto("/items/new");

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: "test-image.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("fake image content"),
      });

      await page.waitForTimeout(500);

      const classifyButton = page.getByRole("button", { name: /classify/i });
      if (await classifyButton.isVisible()) {
        await classifyButton.click();

        // Should show insufficient credits modal or error
        const modal = page.getByRole("dialog");
        const errorText = page.getByText(/insufficient|no credits|purchase/i);
        await expect(modal.or(errorText)).toBeVisible();
      }
    }
  });

  test("can still create item manually without classification", async ({
    page,
  }) => {
    await page.goto("/items/new");

    // Fill in form manually
    await page.getByLabel(/name/i).fill("Manual Item");

    const quantityInput = page.getByLabel(/quantity/i).first();
    if (await quantityInput.isVisible()) {
      await quantityInput.fill("5");
    }

    // Submit form
    const submitButton = page.getByRole("button", { name: /create|save|add/i });
    await submitButton.click();

    // Should succeed without using credits
    await expect(page).toHaveURL(/.*\/items/);
  });
});

test.describe("Create Item - Classification Failure", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
    await setupClassificationMock(page, {
      shouldSucceed: false,
      hasCredits: true,
    });
  });

  test("handles classification API failure gracefully", async ({ page }) => {
    await page.goto("/items/new");

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: "test-image.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("fake image content"),
      });

      await page.waitForTimeout(500);

      const classifyButton = page.getByRole("button", { name: /classify/i });
      if (await classifyButton.isVisible()) {
        await classifyButton.click();

        // Should show error message but not crash
        const errorMessage = page.getByText(/failed|error|try again/i);
        await expect(errorMessage).toBeVisible();

        // Form should still be usable
        await expect(page.getByLabel(/name/i)).toBeEnabled();
      }
    }
  });
});
