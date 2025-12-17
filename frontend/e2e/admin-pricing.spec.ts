import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Admin Pricing Management", () => {
  test.describe("Navigation", () => {
    test("navigates to pricing page from admin dashboard quick action", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin");

      await expect(page.getByTestId("quick-actions-grid")).toBeVisible();

      const pricingAction = page.getByTestId("quick-action-pricing");
      await expect(pricingAction).toBeVisible();
      await pricingAction.click();

      await expect(page).toHaveURL(/.*\/admin\/pricing/, { timeout: 10000 });
      await expect(page.getByTestId("admin-pricing-page")).toBeVisible();
    });

    test("back button navigates to admin dashboard", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      const backButton = page.getByTestId("pricing-back-button");
      await expect(backButton).toBeVisible();
      await backButton.click();

      await expect(page).toHaveURL(/.*\/admin$/, { timeout: 10000 });
    });
  });

  test.describe("Desktop View - Pricing Table", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("displays all pricing configurations in table", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      await expect(page.getByTestId("pricing-table")).toBeVisible();

      // Check that all pricing configurations are displayed
      for (const pricing of fixtures.testAdminPricing) {
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
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      const activeRow = page.getByTestId("pricing-row-image_classification");
      await expect(activeRow).toBeVisible();
      await expect(activeRow.getByText("Active")).toBeVisible();
    });

    test("displays inactive status badge for inactive pricing", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      const inactiveRow = page.getByTestId("pricing-row-category_suggestion");
      await expect(inactiveRow).toBeVisible();
      await expect(inactiveRow.getByText("Inactive")).toBeVisible();
    });

    test("opens edit dialog when clicking edit button", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

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
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      await expect(page.getByTestId("pricing-cards")).toBeVisible();

      // Check that all pricing configurations are displayed as cards
      for (const pricing of fixtures.testAdminPricing) {
        const card = page.getByTestId(`pricing-card-${pricing.operation_type}`);
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeVisible();
        await expect(card).toContainText(pricing.display_name);
        await expect(card).toContainText(pricing.operation_type);
      }
    });

    test("displays active badge on mobile cards", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      const activeCard = page.getByTestId("pricing-card-image_classification");
      await activeCard.scrollIntoViewIfNeeded();
      await expect(activeCard).toBeVisible();
      await expect(activeCard.getByText("Active")).toBeVisible();
    });

    test("opens edit dialog from mobile card", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

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
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

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
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

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

    test("can edit credits per operation", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      const editButton = page.getByTestId("pricing-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("pricing-edit-dialog");
      await expect(dialog).toBeVisible();

      // Edit credits
      const creditsInput = page.getByTestId("pricing-credits-input");
      await creditsInput.fill("2");

      const saveButton = page.getByTestId("pricing-save-button");
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test("can edit description", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      const editButton = page.getByTestId("pricing-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("pricing-edit-dialog");
      await expect(dialog).toBeVisible();

      // Edit description
      const descriptionInput = page.getByTestId("pricing-description-input");
      await descriptionInput.fill("Updated description for AI classification");

      const saveButton = page.getByTestId("pricing-save-button");
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test("can toggle is_active status", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      const editButton = page.getByTestId("pricing-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("pricing-edit-dialog");
      await expect(dialog).toBeVisible();

      // Toggle active status
      const activeCheckbox = page.getByTestId("pricing-active-checkbox");
      await expect(activeCheckbox).toBeChecked();
      await activeCheckbox.click();
      await expect(activeCheckbox).not.toBeChecked();

      const saveButton = page.getByTestId("pricing-save-button");
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test("can edit all fields at once", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      const editButton = page.getByTestId("pricing-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("pricing-edit-dialog");
      await expect(dialog).toBeVisible();

      // Edit all fields
      const displayNameInput = page.getByTestId("pricing-display-name-input");
      await displayNameInput.fill("New Display Name");

      const creditsInput = page.getByTestId("pricing-credits-input");
      await creditsInput.fill("3");

      const descriptionInput = page.getByTestId("pricing-description-input");
      await descriptionInput.fill("New description");

      const activeCheckbox = page.getByTestId("pricing-active-checkbox");
      await activeCheckbox.click();

      const saveButton = page.getByTestId("pricing-save-button");
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test("closes dialog when clicking cancel", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

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
    test("regular user cannot access pricing page", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.testUser,
      });

      await page.goto("/admin/pricing");

      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    });

    test("pricing quick action not shown for regular users", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.testUser,
      });

      await page.goto("/admin");

      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

      // Verify no pricing quick action is shown
      await expect(page.getByTestId("quick-action-pricing")).not.toBeVisible();
    });
  });

  test.describe("Edge Cases", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("handles empty pricing list", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      // Override pricing endpoint to return empty array
      await page.route(/\/api\/v1\/admin\/pricing$/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await page.goto("/admin/pricing");

      // Table should still be visible but empty
      const table = page.getByTestId("pricing-table");
      await expect(table).toBeVisible();

      // No rows should be present
      await expect(page.getByTestId(/pricing-row-/)).not.toBeVisible();
    });

    test("handles pricing with no description", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      // Override with pricing that has null description
      const pricingWithoutDesc = [
        {
          ...fixtures.testAdminPricing[0],
          description: null,
        },
      ];

      await page.route(/\/api\/v1\/admin\/pricing$/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(pricingWithoutDesc),
        });
      });

      await page.goto("/admin/pricing");

      const row = page.getByTestId("pricing-row-image_classification");
      await expect(row).toBeVisible();
    });

    test("handles zero credits per operation", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/pricing");

      const row = page.getByTestId("pricing-row-category_suggestion");
      await expect(row).toBeVisible();
      await expect(row).toContainText("0");
    });
  });
});
