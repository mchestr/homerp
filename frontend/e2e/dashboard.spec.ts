import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("displays dashboard with stats overview", async ({ page }) => {
    await page.goto("/dashboard");

    // Should display page title
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    // Should show items count
    await expect(page.getByText(/total items/i)).toBeVisible();
  });

  test("displays low stock items alert when items are low", async ({ page }) => {
    await page.goto("/dashboard");

    // Should show low stock section
    const lowStockItem = fixtures.testItems.find((i) => i.is_low_stock);
    if (lowStockItem) {
      await expect(page.getByText(/low stock/i)).toBeVisible();
    }
  });

  test("shows quick actions for navigation", async ({ page }) => {
    await page.goto("/dashboard");

    // Should have links to main sections
    await expect(page.getByRole("link", { name: /items/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /categories/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /locations/i }).first()).toBeVisible();
  });

  test("sidebar navigation works", async ({ page }) => {
    await page.goto("/dashboard");

    // Click on items in sidebar
    await page.getByRole("link", { name: /items/i }).first().click();
    await expect(page).toHaveURL(/.*\/items/);
  });

  test("displays credit balance in sidebar", async ({ page }) => {
    await page.goto("/dashboard");

    // Should show credit count somewhere
    const creditsText = page.getByText(
      new RegExp(`${fixtures.testCreditBalance.total_credits}`, "i")
    );
    await expect(creditsText.first()).toBeVisible();
  });

  test("user can access settings from profile", async ({ page }) => {
    await page.goto("/dashboard");

    // Click on user menu or settings link
    const settingsLink = page.getByRole("link", { name: /settings/i });
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await expect(page).toHaveURL(/.*\/settings/);
    }
  });
});

test.describe("Dashboard - Unauthenticated", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    // Mock auth endpoint to return 401
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/dashboard");

    // Should redirect to login or show login prompt
    await expect(page).toHaveURL(/.*\/(login|auth)/);
  });
});
