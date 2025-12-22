import { test, expect } from "@playwright/test";
import {
  setupApiMocks,
  authenticateUser,
  setupNotificationPreferencesMock,
} from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Settings", () => {
  test("displays settings page with user info", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { name: /settings/i })
    ).toBeVisible();
    // Scope to main content to avoid matching sidebar user profile email
    await expect(
      page.getByRole("main").getByText(fixtures.testUser.email)
    ).toBeVisible();
  });

  test("displays OAuth provider in authentication section", async ({
    page,
  }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/settings");

    // Verify the OAuth provider is displayed (testUser has oauth_provider: "google")
    await expect(page.getByText(/Signed in via Google OAuth/i)).toBeVisible();
  });

  test("can navigate to billing settings", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/settings");

    await page.getByTestId("billing-link").click();

    await expect(page).toHaveURL(/.*\/settings\/billing/);
  });

  test("logout redirects to login", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/settings");

    const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await expect(page).toHaveURL(/.*\/(login|auth)/);
    }
  });

  test.describe("Notification Preferences", () => {
    test("displays notification preferences section with switches", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      await page.goto("/settings");

      // Verify Notifications section appears
      await expect(
        page.getByRole("heading", { name: /notifications/i })
      ).toBeVisible();

      // Verify Email Notifications switch is present and checked
      const emailNotificationsSwitch = page.getByTestId(
        "email-notifications-switch"
      );
      await expect(emailNotificationsSwitch).toBeVisible();
      await expect(emailNotificationsSwitch).toBeChecked();

      // Verify Low Stock Alerts switch is present and checked
      const lowStockAlertsSwitch = page.getByTestId("low-stock-alerts-switch");
      await expect(lowStockAlertsSwitch).toBeVisible();
      await expect(lowStockAlertsSwitch).toBeChecked();
    });

    test("can toggle email notifications switch", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      await page.goto("/settings");

      const emailNotificationsSwitch = page.getByTestId(
        "email-notifications-switch"
      );

      // Wait for switch to be visible and ready
      await expect(emailNotificationsSwitch).toBeVisible();
      await expect(emailNotificationsSwitch).toBeChecked();

      // Wait for the API response when toggling
      const responsePromise = page.waitForResponse(
        "**/api/v1/notifications/preferences"
      );
      await emailNotificationsSwitch.click();
      await responsePromise;

      // Verify switch is now unchecked
      await expect(emailNotificationsSwitch).not.toBeChecked();
    });

    test("can toggle low stock alerts switch", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      await page.goto("/settings");

      const lowStockAlertsSwitch = page.getByTestId("low-stock-alerts-switch");

      // Wait for switch to be visible and ready
      await expect(lowStockAlertsSwitch).toBeVisible();
      await expect(lowStockAlertsSwitch).toBeChecked();

      // Wait for the API response when toggling
      const responsePromise = page.waitForResponse(
        "**/api/v1/notifications/preferences"
      );
      await lowStockAlertsSwitch.click();
      await responsePromise;

      // Verify switch is now unchecked
      await expect(lowStockAlertsSwitch).not.toBeChecked();
    });

    test("low stock alerts switch is disabled when email notifications is off", async ({
      page,
    }) => {
      await authenticateUser(page);
      // Set up with email notifications disabled
      await setupApiMocks(page, {
        notificationPreferences: fixtures.testNotificationPreferencesDisabled,
      });

      await page.goto("/settings");

      const emailNotificationsSwitch = page.getByTestId(
        "email-notifications-switch"
      );
      const lowStockAlertsSwitch = page.getByTestId("low-stock-alerts-switch");

      // Verify email notifications is off
      await expect(emailNotificationsSwitch).toBeVisible();
      await expect(emailNotificationsSwitch).not.toBeChecked();

      // Verify low stock alerts is disabled
      await expect(lowStockAlertsSwitch).toBeVisible();
      await expect(lowStockAlertsSwitch).toBeDisabled();
    });

    test("low stock alerts becomes disabled when email notifications is toggled off", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      await page.goto("/settings");

      const emailNotificationsSwitch = page.getByTestId(
        "email-notifications-switch"
      );
      const lowStockAlertsSwitch = page.getByTestId("low-stock-alerts-switch");

      // Initially, both should be enabled and checked
      await expect(emailNotificationsSwitch).toBeVisible();
      await expect(emailNotificationsSwitch).toBeChecked();
      await expect(lowStockAlertsSwitch).toBeVisible();
      await expect(lowStockAlertsSwitch).toBeChecked();
      await expect(lowStockAlertsSwitch).toBeEnabled();

      // Toggle email notifications off
      const responsePromise = page.waitForResponse(
        "**/api/v1/notifications/preferences"
      );
      await emailNotificationsSwitch.click();
      await responsePromise;

      // Verify low stock alerts is now disabled
      await expect(lowStockAlertsSwitch).toBeDisabled();
    });

    test("displays error toast when notification update fails", async ({
      page,
    }) => {
      await authenticateUser(page);
      // Set up base mocks first
      await setupApiMocks(page);
      // Override notification preferences endpoint with error behavior
      await setupNotificationPreferencesMock(page, { shouldFail: true });

      await page.goto("/settings");

      const emailNotificationsSwitch = page.getByTestId(
        "email-notifications-switch"
      );

      // Wait for switch to be visible
      await expect(emailNotificationsSwitch).toBeVisible();

      // Try to toggle the switch
      await emailNotificationsSwitch.click();

      // Wait for error toast to appear
      // Toast messages typically contain the word "error" and the failure message
      const toast = page.locator('[role="status"], [role="alert"]');
      await expect(toast).toBeVisible({ timeout: 5000 });
    });
  });
});
