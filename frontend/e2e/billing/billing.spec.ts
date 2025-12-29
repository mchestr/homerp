import { http, HttpResponse } from "msw";
import { test, expect, authenticateUser } from "../fixtures/test-setup";
import {
  testCreditPacks,
  testCreditBalanceZero,
  testCreditTransactions,
  testImageUpload,
} from "../fixtures/factories";

test.describe("Billing", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test("displays credit balance and packs", async ({ page }) => {
    await page.goto("/settings/billing");

    // Should show credit balance section
    await expect(
      page.getByRole("heading", { name: "Credit Balance" })
    ).toBeVisible();

    // Should show at least one credit pack
    await expect(page.getByText(testCreditPacks[0].name)).toBeVisible();
  });

  test("shows transaction history", async ({ page }) => {
    await page.goto("/settings/billing");

    // Should show past transactions
    await expect(
      page.getByText(testCreditTransactions[0].description)
    ).toBeVisible();
  });

  test("purchase button is available", async ({ page }) => {
    await page.goto("/settings/billing");

    const purchaseButton = page
      .getByRole("button", { name: /purchase|buy/i })
      .first();
    await expect(purchaseButton).toBeVisible();
  });

  test("displays zero balance correctly", async ({ page, network }) => {
    // Override credit balance to zero
    network.use(
      http.get("**/api/v1/billing/balance", () => {
        return HttpResponse.json(testCreditBalanceZero);
      })
    );

    await page.goto("/settings/billing");

    // Should show zero credits in the total credits heading (large text)
    await expect(
      page.locator(".text-3xl.font-bold, .text-primary").getByText("0").first()
    ).toBeVisible();
  });
});

test.describe("Insufficient Credits Modal", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

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

  test("shows modal when classification fails with 402", async ({
    page,
    network,
  }) => {
    // Override image upload and classify mocks
    network.use(
      http.post("**/api/v1/images/upload", () => {
        return HttpResponse.json(testImageUpload);
      }),
      http.get(`**/api/v1/images/${testImageUpload.id}`, () => {
        return HttpResponse.json({
          ...testImageUpload,
          ai_processed: false,
          ai_result: null,
        });
      }),
      http.post("**/api/v1/images/classify", () => {
        return HttpResponse.json(
          { detail: "Insufficient credits" },
          { status: 402 }
        );
      })
    );

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

  test("modal can be dismissed by clicking Cancel", async ({
    page,
    network,
  }) => {
    network.use(
      http.post("**/api/v1/images/upload", () => {
        return HttpResponse.json(testImageUpload);
      }),
      http.get(`**/api/v1/images/${testImageUpload.id}`, () => {
        return HttpResponse.json({
          ...testImageUpload,
          ai_processed: false,
          ai_result: null,
        });
      }),
      http.post("**/api/v1/images/classify", () => {
        return HttpResponse.json(
          { detail: "Insufficient credits" },
          { status: 402 }
        );
      })
    );

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

  test("modal can be dismissed by clicking backdrop", async ({
    page,
    network,
  }) => {
    network.use(
      http.post("**/api/v1/images/upload", () => {
        return HttpResponse.json(testImageUpload);
      }),
      http.get(`**/api/v1/images/${testImageUpload.id}`, () => {
        return HttpResponse.json({
          ...testImageUpload,
          ai_processed: false,
          ai_result: null,
        });
      }),
      http.post("**/api/v1/images/classify", () => {
        return HttpResponse.json(
          { detail: "Insufficient credits" },
          { status: 402 }
        );
      })
    );

    const classifyButton = await uploadImageAndGetClassifyButton(page);
    await classifyButton.click();

    // Modal should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // The InsufficientCreditsModal is a custom modal (not Radix Dialog).
    // The backdrop is the dialog element itself with onClick handler.
    // Click in the corner area which is outside the centered modal content.
    const dialogBox = await modal.boundingBox();
    if (dialogBox) {
      // Click near the top-left corner, which is on the backdrop
      await page.mouse.click(dialogBox.x + 10, dialogBox.y + 10);
    }

    // Modal should be dismissed
    await expect(modal).not.toBeVisible();
  });

  test("modal can be dismissed with Escape key", async ({ page, network }) => {
    network.use(
      http.post("**/api/v1/images/upload", () => {
        return HttpResponse.json(testImageUpload);
      }),
      http.get(`**/api/v1/images/${testImageUpload.id}`, () => {
        return HttpResponse.json({
          ...testImageUpload,
          ai_processed: false,
          ai_result: null,
        });
      }),
      http.post("**/api/v1/images/classify", () => {
        return HttpResponse.json(
          { detail: "Insufficient credits" },
          { status: 402 }
        );
      })
    );

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
    network,
  }) => {
    network.use(
      http.post("**/api/v1/images/upload", () => {
        return HttpResponse.json(testImageUpload);
      }),
      http.get(`**/api/v1/images/${testImageUpload.id}`, () => {
        return HttpResponse.json({
          ...testImageUpload,
          ai_processed: false,
          ai_result: null,
        });
      }),
      http.post("**/api/v1/images/classify", () => {
        return HttpResponse.json(
          { detail: "Insufficient credits" },
          { status: 402 }
        );
      })
    );

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
