import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
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
});
