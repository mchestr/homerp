import { test, expect, authenticateUser } from "../fixtures/test-setup";
import { adminUser, testUser } from "../fixtures/factories";
import { http, HttpResponse } from "msw";

test.describe("Admin Access Control", () => {
  test("admin can access admin dashboard", async ({ page, network }) => {
    await authenticateUser(page);
    // Override auth/me to return admin user
    network.use(
      http.get("**/api/v1/auth/me", () => {
        return HttpResponse.json(adminUser);
      })
    );

    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "Admin Panel" })
    ).toBeVisible();
  });

  test("regular user cannot access admin dashboard", async ({
    page,
    network,
  }) => {
    await authenticateUser(page);
    // Override auth/me to return regular user
    network.use(
      http.get("**/api/v1/auth/me", () => {
        return HttpResponse.json(testUser);
      })
    );

    await page.goto("/admin");

    // Should redirect to dashboard - wait for the redirect to complete
    // The admin page uses useEffect + router.push for non-admin users
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  });

  test("admin link shown only for admin users", async ({ page, network }) => {
    await authenticateUser(page);
    network.use(
      http.get("**/api/v1/auth/me", () => {
        return HttpResponse.json(adminUser);
      })
    );

    await page.goto("/dashboard");

    const adminLink = page.getByRole("link", { name: /admin/i });
    await expect(adminLink).toBeVisible();
  });

  test("admin link hidden for regular users", async ({ page, network }) => {
    await authenticateUser(page);
    network.use(
      http.get("**/api/v1/auth/me", () => {
        return HttpResponse.json(testUser);
      })
    );

    await page.goto("/dashboard");

    const adminLink = page.getByRole("link", { name: /^admin$/i });
    await expect(adminLink).not.toBeVisible();
  });
});
