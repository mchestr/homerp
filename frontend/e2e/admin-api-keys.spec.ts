import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

/**
 * E2E tests for Admin API Keys page with focus on modal overflow fixes
 * and responsive behavior across different screen sizes.
 *
 * Key test areas:
 * 1. Long text handling (50+ character names)
 * 2. Datetime-local input behavior
 * 3. Scope checkbox selection
 * 4. Modal boundary constraints on mobile/tablet/desktop
 * 5. KeyCreatedDialog with long API key values
 */

test.describe("Admin API Keys - Form Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.adminUser,
    });
  });

  test("opens create API key modal and displays all form fields", async ({
    page,
  }) => {
    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    // Verify modal is visible with all expected fields
    await expect(
      page.getByRole("heading", { name: "Create API Key" })
    ).toBeVisible();
    await expect(page.getByTestId("api-key-name-input")).toBeVisible();
    await expect(page.getByTestId("api-key-expires-input")).toBeVisible();
    await expect(
      page.getByTestId("scope-checkbox-feedback:read")
    ).toBeVisible();
    await expect(
      page.getByTestId("scope-checkbox-feedback:write")
    ).toBeVisible();
    await expect(page.getByTestId("scope-checkbox-admin:*")).toBeVisible();
    await expect(page.getByTestId("save-api-key-button")).toBeVisible();
  });

  test("handles long API key name (50+ characters) without overflow", async ({
    page,
  }) => {
    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    // Enter a very long name to test overflow handling
    const longName =
      "This is a very long API key name that exceeds fifty characters for overflow testing";
    await page.getByTestId("api-key-name-input").fill(longName);

    // Verify input contains the long text
    await expect(page.getByTestId("api-key-name-input")).toHaveValue(longName);

    // Get the modal dialog content container
    const dialogContent = page.locator('[role="dialog"]').first();
    await expect(dialogContent).toBeVisible();

    // Verify the input field doesn't cause horizontal overflow
    const inputBox = await page.getByTestId("api-key-name-input").boundingBox();
    const dialogBox = await dialogContent.boundingBox();

    expect(inputBox).not.toBeNull();
    expect(dialogBox).not.toBeNull();

    // Input should be contained within dialog (accounting for padding)
    expect(inputBox!.x + inputBox!.width).toBeLessThanOrEqual(
      dialogBox!.x + dialogBox!.width
    );
  });

  test("datetime-local input accepts and displays date correctly", async ({
    page,
  }) => {
    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    const expiresInput = page.getByTestId("api-key-expires-input");
    await expect(expiresInput).toBeVisible();

    // Set expiration date to future date
    const futureDate = "2025-12-31T23:59";
    await expiresInput.fill(futureDate);

    // Verify the value is set correctly
    await expect(expiresInput).toHaveValue(futureDate);

    // Verify the input is of type datetime-local
    await expect(expiresInput).toHaveAttribute("type", "datetime-local");
  });

  test("scope checkboxes can be toggled correctly", async ({ page }) => {
    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    const feedbackReadCheckbox = page.getByTestId(
      "scope-checkbox-feedback:read"
    );
    const feedbackWriteCheckbox = page.getByTestId(
      "scope-checkbox-feedback:write"
    );
    const adminCheckbox = page.getByTestId("scope-checkbox-admin:*");

    // Initially all should be unchecked
    await expect(feedbackReadCheckbox).not.toBeChecked();
    await expect(feedbackWriteCheckbox).not.toBeChecked();
    await expect(adminCheckbox).not.toBeChecked();

    // Check all scopes
    await feedbackReadCheckbox.check();
    await feedbackWriteCheckbox.check();
    await adminCheckbox.check();

    // Verify all are checked
    await expect(feedbackReadCheckbox).toBeChecked();
    await expect(feedbackWriteCheckbox).toBeChecked();
    await expect(adminCheckbox).toBeChecked();

    // Uncheck one
    await feedbackWriteCheckbox.uncheck();
    await expect(feedbackWriteCheckbox).not.toBeChecked();
    await expect(feedbackReadCheckbox).toBeChecked(); // Others remain checked
    await expect(adminCheckbox).toBeChecked();
  });

  test("creates API key with form submission", async ({ page }) => {
    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    // Wait for modal to be visible
    await expect(
      page.getByRole("heading", { name: "Create API Key" })
    ).toBeVisible();

    // Fill out the form
    await page.getByTestId("api-key-name-input").fill("Test Integration Key");
    await page.getByTestId("api-key-expires-input").fill("2025-12-31T23:59");
    await page.getByTestId("scope-checkbox-feedback:read").check();
    await page.getByTestId("scope-checkbox-feedback:write").check();

    // Wait for the response before clicking submit
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/apikeys") &&
        response.request().method() === "POST"
    );

    // Submit the form
    await page.getByTestId("save-api-key-button").click();

    // Wait for the response
    await responsePromise;

    // Verify KeyCreatedDialog appears
    await expect(
      page.getByRole("heading", { name: "API Key Created" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("form requires name field to submit", async ({ page }) => {
    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    // Try to submit without filling name
    const saveButton = page.getByTestId("save-api-key-button");

    // HTML5 validation should prevent submission
    // The button should be present but form won't submit due to required attribute
    await expect(saveButton).toBeVisible();

    // Verify name input has required attribute
    await expect(page.getByTestId("api-key-name-input")).toHaveAttribute(
      "required"
    );
  });

  test("modal closes when clicking outside or cancel button", async ({
    page,
  }) => {
    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    // Verify modal is open
    await expect(
      page.getByRole("heading", { name: "Create API Key" })
    ).toBeVisible();

    // Click cancel button
    await page.getByRole("button", { name: /cancel/i }).click();

    // Modal should close
    await expect(
      page.getByRole("heading", { name: "Create API Key" })
    ).not.toBeVisible();
  });
});

test.describe("Admin API Keys - KeyCreatedDialog", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.adminUser,
    });
  });

  test("displays created API key with long key value", async ({ page }) => {
    await page.goto("/admin/integrations?tab=api-keys");

    // Open and submit create modal
    await page.getByTestId("create-api-key-button").click();
    await expect(
      page.getByRole("heading", { name: "Create API Key" })
    ).toBeVisible();

    await page.getByTestId("api-key-name-input").fill("Test Key");
    await page.getByTestId("scope-checkbox-feedback:read").check();

    // Wait for response
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/apikeys") &&
        response.request().method() === "POST"
    );

    await page.getByTestId("save-api-key-button").click();
    await responsePromise;

    // KeyCreatedDialog should appear
    await expect(
      page.getByRole("heading", { name: "API Key Created" })
    ).toBeVisible({ timeout: 10000 });

    // Verify the long API key is displayed
    const keyDisplay = page.locator("code").filter({
      hasText: fixtures.testApiKeyCreatedResponse.key,
    });
    await expect(keyDisplay).toBeVisible();

    // Verify the key container doesn't overflow the modal
    const dialogContent = page.locator('[role="dialog"]').last();
    const keyBox = await keyDisplay.boundingBox();
    const dialogBox = await dialogContent.boundingBox();

    expect(keyBox).not.toBeNull();
    expect(dialogBox).not.toBeNull();

    // Key should be contained within dialog (with padding tolerance)
    expect(keyBox!.x + keyBox!.width).toBeLessThanOrEqual(
      dialogBox!.x + dialogBox!.width + 10
    );
  });

  test("copy button copies API key to clipboard", async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/admin/integrations?tab=api-keys");

    // Open and submit create modal
    await page.getByTestId("create-api-key-button").click();
    await expect(
      page.getByRole("heading", { name: "Create API Key" })
    ).toBeVisible();

    await page.getByTestId("api-key-name-input").fill("Test Key");
    await page.getByTestId("scope-checkbox-feedback:read").check();

    // Wait for response
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/apikeys") &&
        response.request().method() === "POST"
    );

    await page.getByTestId("save-api-key-button").click();
    await responsePromise;

    // Wait for KeyCreatedDialog
    await expect(
      page.getByRole("heading", { name: "API Key Created" })
    ).toBeVisible({ timeout: 10000 });

    // Click copy button
    const copyButton = page.getByTestId("copy-api-key-button");
    await copyButton.click();

    // Verify the button shows the check icon (copied state)
    await expect(copyButton.locator("svg")).toHaveClass(/lucide-check/i);

    // Verify clipboard content
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(clipboardText).toBe(fixtures.testApiKeyCreatedResponse.key);
  });

  test("closes KeyCreatedDialog with close button", async ({ page }) => {
    await page.goto("/admin/integrations?tab=api-keys");

    // Open and submit create modal
    await page.getByTestId("create-api-key-button").click();
    await expect(
      page.getByRole("heading", { name: "Create API Key" })
    ).toBeVisible();

    await page.getByTestId("api-key-name-input").fill("Test Key");
    await page.getByTestId("scope-checkbox-feedback:read").check();

    // Wait for response
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/apikeys") &&
        response.request().method() === "POST"
    );

    await page.getByTestId("save-api-key-button").click();
    await responsePromise;

    // Wait for KeyCreatedDialog
    await expect(
      page.getByRole("heading", { name: "API Key Created" })
    ).toBeVisible({ timeout: 10000 });

    // Click close button
    await page.getByTestId("close-key-dialog-button").click();

    // Dialog should close
    await expect(
      page.getByRole("heading", { name: "API Key Created" })
    ).not.toBeVisible();
  });

  test("displays API key metadata correctly", async ({ page }) => {
    await page.goto("/admin/integrations?tab=api-keys");

    // Create a key with specific scopes
    await page.getByTestId("create-api-key-button").click();
    await expect(
      page.getByRole("heading", { name: "Create API Key" })
    ).toBeVisible();

    await page.getByTestId("api-key-name-input").fill("Test Key");
    await page.getByTestId("scope-checkbox-feedback:read").check();
    await page.getByTestId("scope-checkbox-feedback:write").check();

    // Wait for response
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/apikeys") &&
        response.request().method() === "POST"
    );

    await page.getByTestId("save-api-key-button").click();
    await responsePromise;

    // Verify metadata is displayed
    await expect(
      page.getByRole("heading", { name: "API Key Created" })
    ).toBeVisible({ timeout: 10000 });

    // Check that scopes are displayed in the KeyCreatedDialog
    // Scope text in the created dialog: "feedback:read, feedback:write"
    const dialogContent = page.locator('[role="dialog"]').last();
    await expect(
      dialogContent.getByText("feedback:read, feedback:write")
    ).toBeVisible();
  });
});

test.describe("Admin API Keys - Responsive Modal Behavior", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.adminUser,
    });
  });

  test("modal displays correctly on mobile viewport (375x667)", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    // Verify modal is visible and fits viewport
    const dialogContent = page.locator('[role="dialog"]').first();
    await expect(dialogContent).toBeVisible();

    const dialogBox = await dialogContent.boundingBox();
    expect(dialogBox).not.toBeNull();

    // Modal should not exceed viewport width (with small margin)
    expect(dialogBox!.width).toBeLessThanOrEqual(375);

    // Test long name input on mobile
    const longName =
      "This is a very long API key name for mobile overflow testing with more than fifty characters";
    await page.getByTestId("api-key-name-input").fill(longName);

    // Input should not cause horizontal scrolling
    const inputBox = await page.getByTestId("api-key-name-input").boundingBox();
    expect(inputBox).not.toBeNull();
    expect(inputBox!.x + inputBox!.width).toBeLessThanOrEqual(
      dialogBox!.x + dialogBox!.width
    );
  });

  test("modal displays correctly on tablet viewport (768x1024)", async ({
    page,
  }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    const dialogContent = page.locator('[role="dialog"]').first();
    await expect(dialogContent).toBeVisible();

    const dialogBox = await dialogContent.boundingBox();
    expect(dialogBox).not.toBeNull();

    // Modal should have max-width constraint on tablet (sm:max-w-md = 448px)
    // but should fit within viewport
    expect(dialogBox!.width).toBeLessThanOrEqual(768);

    // Verify all form elements are visible
    await expect(page.getByTestId("api-key-name-input")).toBeVisible();
    await expect(page.getByTestId("api-key-expires-input")).toBeVisible();
    await expect(
      page.getByTestId("scope-checkbox-feedback:read")
    ).toBeVisible();
  });

  test("modal displays correctly on desktop viewport (1920x1080)", async ({
    page,
  }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    const dialogContent = page.locator('[role="dialog"]').first();
    await expect(dialogContent).toBeVisible();

    const dialogBox = await dialogContent.boundingBox();
    expect(dialogBox).not.toBeNull();

    // Modal should have max-width constraint (sm:max-w-md = 448px)
    expect(dialogBox!.width).toBeLessThanOrEqual(500); // Allowing some padding

    // Modal should be centered
    const viewportWidth = 1920;
    const modalCenterX = dialogBox!.x + dialogBox!.width / 2;
    const viewportCenterX = viewportWidth / 2;

    // Center should be within 100px of viewport center
    expect(Math.abs(modalCenterX - viewportCenterX)).toBeLessThan(100);
  });

  test("KeyCreatedDialog handles long key on mobile viewport", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/admin/integrations?tab=api-keys");

    // Create a key
    await page.getByTestId("create-api-key-button").click();
    await expect(
      page.getByRole("heading", { name: "Create API Key" })
    ).toBeVisible();

    await page.getByTestId("api-key-name-input").fill("Test Key");
    await page.getByTestId("scope-checkbox-feedback:read").check();

    // Wait for response
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/apikeys") &&
        response.request().method() === "POST"
    );

    await page.getByTestId("save-api-key-button").click();
    await responsePromise;

    // KeyCreatedDialog should appear
    await expect(
      page.getByRole("heading", { name: "API Key Created" })
    ).toBeVisible({ timeout: 10000 });

    const dialogContent = page.locator('[role="dialog"]').last();
    const keyDisplay = page.locator("code").filter({
      hasText: fixtures.testApiKeyCreatedResponse.key,
    });

    await expect(keyDisplay).toBeVisible();

    // Verify the key wraps and doesn't overflow
    const keyBox = await keyDisplay.boundingBox();
    const dialogBox = await dialogContent.boundingBox();

    expect(keyBox).not.toBeNull();
    expect(dialogBox).not.toBeNull();

    // Key should be contained within dialog
    expect(keyBox!.x + keyBox!.width).toBeLessThanOrEqual(
      dialogBox!.x + dialogBox!.width + 10
    );
  });

  test("datetime-local picker displays correctly on mobile", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    const expiresInput = page.getByTestId("api-key-expires-input");
    await expect(expiresInput).toBeVisible();

    // On mobile, datetime-local inputs should show native picker
    // Verify input is not overflowing
    const dialogContent = page.locator('[role="dialog"]').first();
    const inputBox = await expiresInput.boundingBox();
    const dialogBox = await dialogContent.boundingBox();

    expect(inputBox).not.toBeNull();
    expect(dialogBox).not.toBeNull();

    expect(inputBox!.x + inputBox!.width).toBeLessThanOrEqual(
      dialogBox!.x + dialogBox!.width
    );

    // Verify can interact with the input
    await expiresInput.click();
    // Native picker behavior varies by browser, so we just verify it doesn't crash
    await expect(expiresInput).toBeVisible();
  });

  test("scope checkboxes layout correctly on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/admin/integrations?tab=api-keys");

    // Open the create modal
    await page.getByTestId("create-api-key-button").click();

    // Verify all scope checkboxes are visible and clickable
    const scopes = [
      "scope-checkbox-feedback:read",
      "scope-checkbox-feedback:write",
      "scope-checkbox-admin:*",
    ];

    for (const scope of scopes) {
      const checkbox = page.getByTestId(scope);
      await expect(checkbox).toBeVisible();

      // Verify checkbox is within modal bounds
      const dialogContent = page.locator('[role="dialog"]').first();
      const checkboxBox = await checkbox.boundingBox();
      const dialogBox = await dialogContent.boundingBox();

      expect(checkboxBox).not.toBeNull();
      expect(dialogBox).not.toBeNull();

      expect(checkboxBox!.x).toBeGreaterThanOrEqual(dialogBox!.x);
      expect(checkboxBox!.x + checkboxBox!.width).toBeLessThanOrEqual(
        dialogBox!.x + dialogBox!.width
      );
    }
  });
});

test.describe("Admin API Keys - Access Control", () => {
  test("non-admin user cannot access API keys page", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.testUser, // Regular user, not admin
    });

    await page.goto("/admin/integrations?tab=api-keys");

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  });
});
