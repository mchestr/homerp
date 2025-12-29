import { http, HttpResponse } from "msw";
import { test, expect, authenticateUser } from "../fixtures/test-setup";
import { adminUser, testUser, testAdminPricing } from "../fixtures/factories";

test.describe("Admin Pricing Management", () => {
  test.beforeEach(async ({ page, network }) => {
    await authenticateUser(page);
    network.use(
      http.get("**/api/v1/auth/me", () => {
        return HttpResponse.json(adminUser);
      })
    );
  });

  test.describe("Navigation", () => {
    test("navigates to settings page from admin dashboard quick action", async ({
      page,
    }) => {
      await page.goto("/admin");

      await expect(page.getByTestId("quick-actions-grid")).toBeVisible();

      const settingsAction = page.getByTestId("quick-action-settings");
      await expect(settingsAction).toBeVisible();
      await settingsAction.click();

      await expect(page).toHaveURL(/.*\/admin\/settings/, { timeout: 10000 });
      await expect(page.getByTestId("admin-settings-page")).toBeVisible();
    });

    test("back button navigates to admin dashboard", async ({ page }) => {
      await page.goto("/admin/settings?tab=pricing");

      const backButton = page.getByTestId("settings-back-button");
      await expect(backButton).toBeVisible();
      await backButton.click();

      await expect(page).toHaveURL(/.*\/admin$/, { timeout: 10000 });
    });
  });

  test.describe("Desktop View - Pricing Table", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("displays all pricing configurations in table", async ({ page }) => {
      await page.goto("/admin/settings?tab=pricing");

      await expect(page.getByTestId("pricing-table")).toBeVisible();

      // Check that all pricing configurations are displayed
      for (const pricing of testAdminPricing) {
        const row = page.getByTestId(`pricing-row-${pricing.operation_type}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(pricing.display_name);
        await expect(row).toContainText(
          pricing.credits_per_operation.toString()
        );
        await expect(row).toContainText(pricing.operation_type);
      }
    });

    test("displays active status badge for active pricing", async ({
      page,
    }) => {
      await page.goto("/admin/settings?tab=pricing");

      const activeRow = page.getByTestId("pricing-row-image_classification");
      await expect(activeRow).toBeVisible();
      await expect(activeRow.getByText("Active")).toBeVisible();
    });

    test("displays inactive status badge for inactive pricing", async ({
      page,
    }) => {
      await page.goto("/admin/settings?tab=pricing");

      const inactiveRow = page.getByTestId("pricing-row-category_suggestion");
      await expect(inactiveRow).toBeVisible();
      await expect(inactiveRow.getByText("Inactive")).toBeVisible();
    });

    test("opens edit dialog when clicking edit button", async ({ page }) => {
      await page.goto("/admin/settings?tab=pricing");

      const editButton = page.getByTestId("pricing-edit-image_classification");
      await expect(editButton).toBeVisible();
      await editButton.click();

      const dialog = page.getByTestId("pricing-edit-dialog");
      await expect(dialog).toBeVisible();
    });
  });

  test.describe("Mobile View - Pricing Cards", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("displays all pricing configurations as cards", async ({ page }) => {
      await page.goto("/admin/settings?tab=pricing");

      await expect(page.getByTestId("pricing-cards")).toBeVisible();

      // Check that all pricing configurations are displayed as cards
      for (const pricing of testAdminPricing) {
        const card = page.getByTestId(`pricing-card-${pricing.operation_type}`);
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeVisible();
        await expect(card).toContainText(pricing.display_name);
        await expect(card).toContainText(pricing.operation_type);
      }
    });

    test("displays active badge on mobile cards", async ({ page }) => {
      await page.goto("/admin/settings?tab=pricing");

      const activeCard = page.getByTestId("pricing-card-image_classification");
      await activeCard.scrollIntoViewIfNeeded();
      await expect(activeCard).toBeVisible();
      await expect(activeCard.getByText("Active")).toBeVisible();
    });

    test("opens edit dialog from mobile card", async ({ page }) => {
      await page.goto("/admin/settings?tab=pricing");

      const editButton = page.getByTestId(
        "pricing-edit-mobile-image_classification"
      );
      await editButton.scrollIntoViewIfNeeded();
      await expect(editButton).toBeVisible();
      await editButton.click();

      const dialog = page.getByTestId("pricing-edit-dialog");
      await expect(dialog).toBeVisible();
    });
  });

  test.describe("Edit Dialog", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("displays current pricing values in edit form", async ({ page }) => {
      await page.goto("/admin/settings?tab=pricing");

      const editButton = page.getByTestId("pricing-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("pricing-edit-dialog");
      await expect(dialog).toBeVisible();

      // Check that operation_type is displayed and disabled
      const operationTypeInput = page.getByTestId("pricing-operation-type");
      await expect(operationTypeInput).toBeVisible();
      await expect(operationTypeInput).toBeDisabled();
      await expect(operationTypeInput).toHaveValue("image_classification");

      // Check display name
      const displayNameInput = page.getByTestId("pricing-display-name-input");
      await expect(displayNameInput).toHaveValue("Image Classification");

      // Check credits per operation
      const creditsInput = page.getByTestId("pricing-credits-input");
      await expect(creditsInput).toHaveValue("1");

      // Check description
      const descriptionInput = page.getByTestId("pricing-description-input");
      await expect(descriptionInput).toHaveValue(
        "AI-powered image classification and metadata extraction"
      );

      // Check is_active checkbox
      const activeCheckbox = page.getByTestId("pricing-active-checkbox");
      await expect(activeCheckbox).toBeChecked();
    });

    test("can edit display name and save changes", async ({ page }) => {
      await page.goto("/admin/settings?tab=pricing");

      const editButton = page.getByTestId("pricing-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("pricing-edit-dialog");
      await expect(dialog).toBeVisible();

      // Edit display name
      const displayNameInput = page.getByTestId("pricing-display-name-input");
      await displayNameInput.fill("Updated Image Classification");

      // Set up response expectation
      const responsePromise = page.waitForResponse(
        /\/api\/v1\/admin\/pricing\/pricing-1$/
      );

      // Click save
      const saveButton = page.getByTestId("pricing-save-button");
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // Wait for API call
      await responsePromise;

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test("closes dialog when clicking cancel", async ({ page }) => {
      await page.goto("/admin/settings?tab=pricing");

      const editButton = page.getByTestId("pricing-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("pricing-edit-dialog");
      await expect(dialog).toBeVisible();

      // Make some changes
      const displayNameInput = page.getByTestId("pricing-display-name-input");
      await displayNameInput.fill("This should not be saved");

      // Click cancel
      const cancelButton = page.getByTestId("pricing-cancel-button");
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();

      // Dialog should close without saving
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe("Access Control", () => {
    test("regular user cannot access pricing page", async ({
      page,
      network,
    }) => {
      network.use(
        http.get("**/api/v1/auth/me", () => {
          return HttpResponse.json(testUser);
        })
      );

      await page.goto("/admin/settings?tab=pricing");

      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    });
  });

  test.describe("Edge Cases", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("handles empty pricing list", async ({ page, network }) => {
      // Override pricing endpoint to return empty array
      network.use(
        http.get(/\/api\/v1\/admin\/pricing$/, () => {
          return HttpResponse.json([]);
        })
      );

      await page.goto("/admin/settings?tab=pricing");

      // Table should still be visible but empty
      const table = page.getByTestId("pricing-table");
      await expect(table).toBeVisible();

      // No rows should be present
      await expect(page.getByTestId(/pricing-row-/)).not.toBeVisible();
    });
  });
});
