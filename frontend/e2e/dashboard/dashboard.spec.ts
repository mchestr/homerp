import { test, expect, authenticateUser } from "../fixtures/test-setup";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test("displays dashboard with stats", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();
    await expect(page.getByText(/total items/i)).toBeVisible();
  });

  test("sidebar navigation works", async ({ page, isMobile }) => {
    await page.goto("/dashboard");

    // Wait for the dashboard to fully load
    await expect(
      page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();

    // On mobile, need to open the sidebar first via the menu button
    if (isMobile) {
      const menuButton = page
        .getByRole("button")
        .filter({ has: page.locator("svg.lucide-menu") });
      await menuButton.waitFor({ state: "visible" });
      await menuButton.click();
    }

    // Use data-testid for reliable selection and wait for it to be visible
    const itemsLink = page.getByTestId("sidebar-link-items");
    await itemsLink.waitFor({ state: "visible" });
    await itemsLink.click();

    // Use longer timeout for navigation in CI
    await expect(page).toHaveURL(/.*\/items/, { timeout: 10000 });
  });
});
