import { test, expect } from "@playwright/test";
import {
  setupApiMocks,
  authenticateUser,
  setupClassificationMock,
} from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Billing", () => {
  test("displays credit balance and packs", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/settings/billing");

    // Should show credit balance section
    await expect(
      page.getByRole("heading", { name: "Credit Balance" })
    ).toBeVisible();

    // Should show at least one credit pack
    await expect(
      page.getByText(fixtures.testCreditPacks[0].name)
    ).toBeVisible();
  });

  test("shows transaction history", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/settings/billing");

    // Should show past transactions
    await expect(
      page.getByText(fixtures.testCreditTransactions[0].description)
    ).toBeVisible();
  });

  test("purchase button is available", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/settings/billing");

    const purchaseButton = page
      .getByRole("button", { name: /purchase|buy/i })
      .first();
    await expect(purchaseButton).toBeVisible();
  });

  test("displays zero balance correctly", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      creditBalance: fixtures.testCreditBalanceZero,
    });

    await page.goto("/settings/billing");

    // Should show zero credits in the total credits heading (large text)
    await expect(
      page.locator(".text-3xl.font-bold, .text-primary").getByText("0").first()
    ).toBeVisible();
  });
});

test.describe("Insufficient Credits Modal", () => {
  // Helper function to setup image upload mocks BEFORE navigation
  async function setupImageUploadMocks(page: import("@playwright/test").Page) {
    // Register image upload mock (LIFO - this one wins over the one in setupApiMocks)
    await page.route("**/api/v1/images/upload", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixtures.testImageUpload),
      });
    });

    // Mock the specific image GET endpoint
    await page.route(
      `**/api/v1/images/${fixtures.testImageUpload.id}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...fixtures.testImageUpload,
            ai_processed: false,
            ai_result: null,
          }),
        });
      }
    );
  }

  // Helper function to upload an image and get the classify button
  async function uploadImageAndGetClassifyButton(
    page: import("@playwright/test").Page
  ) {
    // Navigate to item creation page
    await page.goto("/items/new");

    // Wait for page to load
    await expect(
      page.getByRole("heading", { name: "Add New Item" })
    ).toBeVisible({ timeout: 10000 });

    // Upload an image by selecting a file
    const fileInput = page.locator('input[type="file"]').first();
    const buffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    await fileInput.setInputFiles({
      name: "test-image.png",
      mimeType: "image/png",
      buffer: buffer,
    });

    // Wait for upload to complete and classify button to appear
    const classifyButton = page.getByTestId("classify-button");
    await expect(classifyButton).toBeVisible({ timeout: 15000 });

    return classifyButton;
  }

  test("shows modal when classification fails with 402", async ({ page }) => {
    await authenticateUser(page);
    // Setup mocks BEFORE navigation (LIFO - later registrations win)
    await setupApiMocks(page);
    await setupImageUploadMocks(page);
    await setupClassificationMock(page, { hasCredits: false });

    const classifyButton = await uploadImageAndGetClassifyButton(page);

    // Click to classify - should trigger 402 and show modal
    await classifyButton.click();

    // Modal should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Should show "Insufficient Credits" title
    await expect(page.getByText("Insufficient Credits")).toBeVisible();

    // Should show purchase and cancel buttons within the modal
    await expect(
      modal.getByRole("button", { name: /purchase credits/i })
    ).toBeVisible();
    await expect(modal.getByRole("button", { name: /cancel/i })).toBeVisible();
  });

  test("modal can be dismissed by clicking Cancel", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
    await setupImageUploadMocks(page);
    await setupClassificationMock(page, { hasCredits: false });

    const classifyButton = await uploadImageAndGetClassifyButton(page);
    await classifyButton.click();

    // Modal should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click Cancel button in the modal
    await modal.getByRole("button", { name: /cancel/i }).click();

    // Modal should be dismissed
    await expect(modal).not.toBeVisible();
  });

  test("modal can be dismissed by clicking backdrop", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
    await setupImageUploadMocks(page);
    await setupClassificationMock(page, { hasCredits: false });

    const classifyButton = await uploadImageAndGetClassifyButton(page);
    await classifyButton.click();

    // Modal should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click on the overlay (Radix dialog overlay that covers the backdrop)
    // Using force: true ensures the click is dispatched even if the element
    // is covered by another element, which is more reliable than coordinates
    const overlay = page.locator("[data-radix-dialog-overlay]");
    await overlay.click({ force: true });

    // Modal should be dismissed
    await expect(modal).not.toBeVisible();
  });

  test("modal can be dismissed with Escape key", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
    await setupImageUploadMocks(page);
    await setupClassificationMock(page, { hasCredits: false });

    const classifyButton = await uploadImageAndGetClassifyButton(page);
    await classifyButton.click();

    // Modal should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Press Escape key
    await page.keyboard.press("Escape");

    // Modal should be dismissed
    await expect(modal).not.toBeVisible();
  });

  test("Purchase Credits button navigates to billing page", async ({
    page,
  }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
    await setupImageUploadMocks(page);
    await setupClassificationMock(page, { hasCredits: false });

    const classifyButton = await uploadImageAndGetClassifyButton(page);
    await classifyButton.click();

    // Modal should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click Purchase Credits button
    await page.getByRole("button", { name: /purchase credits/i }).click();

    // Should navigate to billing page
    await expect(page).toHaveURL(/\/settings\/billing/);

    // Modal should be closed
    await expect(modal).not.toBeVisible();

    // Billing page should be displayed
    await expect(
      page.getByRole("heading", { name: "Credit Balance" })
    ).toBeVisible();
  });
});
