import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("displays settings page", async ({ page }) => {
    await page.goto("/settings");

    // Should show settings title
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
  });

  test("shows current user info", async ({ page }) => {
    await page.goto("/settings");

    // Should show user email
    await expect(page.getByText(fixtures.testUser.email)).toBeVisible();

    // Should show user name if available
    if (fixtures.testUser.name) {
      await expect(page.getByText(fixtures.testUser.name)).toBeVisible();
    }
  });

  test("can toggle dark mode", async ({ page }) => {
    await page.goto("/settings");

    // Find theme toggle
    const themeToggle = page.getByRole("button", { name: /dark|light|theme/i });
    if (await themeToggle.isVisible()) {
      await themeToggle.click();

      // Page should reflect theme change
      const html = page.locator("html");
      const classList = await html.getAttribute("class");
      expect(classList).toMatch(/dark|light/);
    }
  });

  test("can navigate to billing settings", async ({ page }) => {
    await page.goto("/settings");

    // Click billing link
    const billingLink = page.getByRole("link", { name: /billing/i });
    await billingLink.click();

    await expect(page).toHaveURL(/.*\/settings\/billing/);
  });

  test("shows logout option", async ({ page }) => {
    await page.goto("/settings");

    // Should have logout button
    const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
    await expect(logoutButton).toBeVisible();
  });

  test("logout clears session", async ({ page }) => {
    await page.goto("/settings");

    const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/(login|auth)/);
    }
  });
});

test.describe("Theme Persistence", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("theme persists across page navigation", async ({ page }) => {
    await page.goto("/settings");

    // Get initial theme state
    const html = page.locator("html");
    const initialClass = await html.getAttribute("class");

    // Toggle theme
    const themeToggle = page.getByRole("button", { name: /dark|light|theme/i });
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(100);

      const newClass = await html.getAttribute("class");

      // Navigate to another page
      await page.goto("/dashboard");

      // Theme should persist
      const dashboardClass = await html.getAttribute("class");
      expect(dashboardClass).toBe(newClass);
    }
  });
});
