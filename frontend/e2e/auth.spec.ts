import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Authentication", () => {
  test("displays login page for unauthenticated users", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /google|sign in/i })
    ).toBeVisible();
  });

  test("protected routes redirect to login", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/.*\/(login|auth)/);
  });

  test("successful OAuth callback redirects to dashboard", async ({ page }) => {
    await page.route("**/api/v1/auth/callback/google*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: {
            access_token: "mock-jwt-token",
            expires_in: 86400,
          },
          user: fixtures.testUser,
        }),
      });
    });

    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixtures.testUser),
      });
    });

    await setupApiMocks(page);

    await page.goto("/callback/google?code=mock-auth-code");

    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test("OAuth error shows error page", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/callback/google?error=access_denied");

    await expect(
      page.getByRole("heading", { name: "Authentication Failed" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Back to Login" })
    ).toBeVisible();
  });
});
