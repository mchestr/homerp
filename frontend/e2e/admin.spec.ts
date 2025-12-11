import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Admin Access Control", () => {
  test("admin can access admin dashboard", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.adminUser,
    });

    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
  });

  test("regular user cannot access admin dashboard", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.testUser,
    });

    await page.goto("/admin");

    // Should redirect away or show access denied
    await expect(page).not.toHaveURL(/.*\/admin$/);
  });

  test("admin link shown only for admin users", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.adminUser,
    });

    await page.goto("/dashboard");

    const adminLink = page.getByRole("link", { name: /admin/i });
    await expect(adminLink).toBeVisible();
  });

  test("admin link hidden for regular users", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      user: fixtures.testUser,
    });

    await page.goto("/dashboard");

    const adminLink = page.getByRole("link", { name: /^admin$/i });
    await expect(adminLink).not.toBeVisible();
  });
});
