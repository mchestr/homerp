import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";

test.describe("Dashboard", () => {
  test("displays dashboard with stats", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();
    await expect(page.getByText(/total items/i)).toBeVisible();
  });

  test("sidebar navigation works", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/dashboard");

    await page.getByRole("link", { name: /items/i }).first().click();
    await expect(page).toHaveURL(/.*\/items/);
  });
});
