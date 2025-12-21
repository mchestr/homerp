import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Admin AI Model Settings", () => {
  test.describe("Navigation", () => {
    test("back button navigates to admin dashboard", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      const backButton = page.getByTestId("settings-back-button");
      await expect(backButton).toBeVisible();
      await backButton.click();

      await expect(page).toHaveURL(/.*\/admin$/, { timeout: 10000 });
    });
  });

  test.describe("Desktop View - AI Models Table", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("displays all AI model settings in table", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      await expect(page.getByTestId("ai-models-table")).toBeVisible();

      // Check that all settings are displayed
      for (const settings of fixtures.testAIModelSettings) {
        const row = page.getByTestId(`settings-row-${settings.operation_type}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(settings.display_name);
        await expect(row).toContainText(settings.model_name);
      }
    });

    test("displays active status badge for active settings", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      const activeRow = page.getByTestId("settings-row-image_classification");
      await expect(activeRow).toBeVisible();
      await expect(activeRow.getByText("Active")).toBeVisible();
    });

    test("displays inactive status badge for inactive settings", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      const inactiveRow = page.getByTestId("settings-row-location_analysis");
      await expect(inactiveRow).toBeVisible();
      await expect(inactiveRow.getByText("Inactive")).toBeVisible();
    });

    test("opens edit dialog when clicking edit button", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      const editButton = page.getByTestId("settings-edit-image_classification");
      await expect(editButton).toBeVisible();
      await editButton.click();

      const dialog = page.getByTestId("settings-edit-dialog");
      await expect(dialog).toBeVisible();
    });
  });

  test.describe("Mobile View - AI Models Cards", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("displays all AI model settings as cards", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      await expect(page.getByTestId("ai-models-cards")).toBeVisible();

      // Check that all settings are displayed as cards
      for (const settings of fixtures.testAIModelSettings) {
        const card = page.getByTestId(
          `settings-card-${settings.operation_type}`
        );
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeVisible();
        await expect(card).toContainText(settings.display_name);
        await expect(card).toContainText(settings.operation_type);
      }
    });

    test("displays active badge on mobile cards", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      const activeCard = page.getByTestId("settings-card-image_classification");
      await activeCard.scrollIntoViewIfNeeded();
      await expect(activeCard).toBeVisible();
      await expect(activeCard.getByText("Active")).toBeVisible();
    });

    test("opens edit dialog from mobile card", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      const editButton = page.getByTestId(
        "settings-edit-mobile-image_classification"
      );
      await editButton.scrollIntoViewIfNeeded();
      await expect(editButton).toBeVisible();
      await editButton.click();

      const dialog = page.getByTestId("settings-edit-dialog");
      await expect(dialog).toBeVisible();
    });
  });

  test.describe("Edit Dialog", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("displays current settings values in edit form", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      const editButton = page.getByTestId("settings-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("settings-edit-dialog");
      await expect(dialog).toBeVisible();

      // Check that operation_type is displayed and disabled
      const operationTypeInput = page.getByTestId("settings-operation-type");
      await expect(operationTypeInput).toBeVisible();
      await expect(operationTypeInput).toBeDisabled();
      await expect(operationTypeInput).toHaveValue("image_classification");

      // Check display name
      const displayNameInput = page.getByTestId("settings-display-name-input");
      await expect(displayNameInput).toHaveValue("Image Classification");

      // Check model name
      const modelNameInput = page.getByTestId("settings-model-name-input");
      await expect(modelNameInput).toHaveValue("gpt-4o");

      // Check description
      const descriptionInput = page.getByTestId("settings-description-input");
      await expect(descriptionInput).toHaveValue(
        "AI-powered image analysis and metadata extraction"
      );

      // Check is_active checkbox
      const activeCheckbox = page.getByTestId("settings-active-checkbox");
      await expect(activeCheckbox).toBeChecked();
    });

    test("can edit model name and save changes", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      const editButton = page.getByTestId("settings-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("settings-edit-dialog");
      await expect(dialog).toBeVisible();

      // Edit model name
      const modelNameInput = page.getByTestId("settings-model-name-input");
      await modelNameInput.fill("gpt-4o-mini");

      // Click save
      const saveButton = page.getByTestId("settings-save-button");
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test("can edit temperature", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      const editButton = page.getByTestId("settings-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("settings-edit-dialog");
      await expect(dialog).toBeVisible();

      // Edit temperature
      const temperatureInput = page.getByTestId("settings-temperature-input");
      await temperatureInput.fill("0.7");

      const saveButton = page.getByTestId("settings-save-button");
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test("can edit max tokens", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.adminUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      const editButton = page.getByTestId("settings-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("settings-edit-dialog");
      await expect(dialog).toBeVisible();

      // Edit max tokens
      const maxTokensInput = page.getByTestId("settings-max-tokens-input");
      await maxTokensInput.fill("4000");

      const saveButton = page.getByTestId("settings-save-button");
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

      await page.goto("/admin/settings?tab=ai-models");

      const editButton = page.getByTestId("settings-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("settings-edit-dialog");
      await expect(dialog).toBeVisible();

      // Toggle active status
      const activeCheckbox = page.getByTestId("settings-active-checkbox");
      await expect(activeCheckbox).toBeChecked();
      await activeCheckbox.click();
      await expect(activeCheckbox).not.toBeChecked();

      const saveButton = page.getByTestId("settings-save-button");
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

      await page.goto("/admin/settings?tab=ai-models");

      const editButton = page.getByTestId("settings-edit-image_classification");
      await editButton.click();

      const dialog = page.getByTestId("settings-edit-dialog");
      await expect(dialog).toBeVisible();

      // Make some changes
      const displayNameInput = page.getByTestId("settings-display-name-input");
      await displayNameInput.fill("This should not be saved");

      // Click cancel
      const cancelButton = page.getByTestId("settings-cancel-button");
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();

      // Dialog should close without saving
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe("Access Control", () => {
    test("regular user cannot access AI models page", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        user: fixtures.testUser,
      });

      await page.goto("/admin/settings?tab=ai-models");

      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    });
  });
});
