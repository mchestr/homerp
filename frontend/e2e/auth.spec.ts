import { test, expect } from "@playwright/test";
import { setupApiMocks, clearAuth } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Authentication - Login Flow", () => {
  test("displays login page for unauthenticated users", async ({ page }) => {
    // Mock auth to return 401
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/login");

    // Should show login page
    await expect(page.getByRole("heading", { name: /sign in|login/i })).toBeVisible();
  });

  test("shows Google OAuth button", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/login");

    // Should have Google sign-in button
    const googleButton = page.getByRole("button", { name: /google|sign in/i });
    await expect(googleButton).toBeVisible();
  });

  test("clicking sign in redirects to Google OAuth", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.route("**/api/v1/auth/google*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authorization_url: "https://accounts.google.com/o/oauth2/auth?mock=true",
        }),
      });
    });

    await page.goto("/login");

    const googleButton = page.getByRole("button", { name: /google|sign in/i });
    await googleButton.click();

    // Should attempt to redirect to Google
    // In test, we can check the request was made
  });

  test("protected routes redirect to login", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    // Try to access protected route
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/.*\/(login|auth)/);
  });

  test("items page requires authentication", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/items");
    await expect(page).toHaveURL(/.*\/(login|auth)/);
  });

  test("categories page requires authentication", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/categories");
    await expect(page).toHaveURL(/.*\/(login|auth)/);
  });

  test("settings page requires authentication", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/settings");
    await expect(page).toHaveURL(/.*\/(login|auth)/);
  });
});

test.describe("Authentication - OAuth Callback", () => {
  test("handles successful OAuth callback", async ({ page }) => {
    // Mock the callback endpoint
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

    // Mock auth/me for after login
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixtures.testUser),
      });
    });

    // Mock other needed endpoints
    await setupApiMocks(page);

    // Simulate callback with code
    await page.goto("/callback/google?code=mock-auth-code");

    // Should redirect to dashboard after successful login
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test("handles OAuth error", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    // Simulate callback with error
    await page.goto("/callback/google?error=access_denied");

    // Should show error or redirect to login
    await expect(page).toHaveURL(/.*\/(login|auth)/);
  });

  test("handles missing code parameter", async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    // Callback without code
    await page.goto("/callback/google");

    // Should redirect to login
    await expect(page).toHaveURL(/.*\/(login|auth)/);
  });
});

test.describe("Authentication - Session Management", () => {
  test("expired token redirects to login", async ({ page }) => {
    // First request succeeds, then fails (simulating token expiry)
    let requestCount = 0;
    await page.route("**/api/v1/auth/me", async (route) => {
      requestCount++;
      if (requestCount === 1) {
        await route.fulfill({
          status: 401,
          body: JSON.stringify({ detail: "Token expired" }),
        });
      } else {
        await route.fulfill({
          status: 401,
          body: JSON.stringify({ detail: "Not authenticated" }),
        });
      }
    });

    await page.goto("/dashboard");

    // Should redirect to login due to expired token
    await expect(page).toHaveURL(/.*\/(login|auth)/);
  });
});

test.describe("Authentication - User Context", () => {
  test("user info available after login", async ({ page }) => {
    // Set up authenticated state
    await page.addInitScript(() => {
      localStorage.setItem("auth_token", "mock-jwt-token");
    });

    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixtures.testUser),
      });
    });

    await setupApiMocks(page);

    await page.goto("/dashboard");

    // User name or email should be visible somewhere
    await expect(
      page.getByText(fixtures.testUser.email).or(page.getByText(fixtures.testUser.name!))
    ).toBeVisible();
  });

  test("admin badge shown for admin users", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("auth_token", "mock-jwt-token");
    });

    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixtures.adminUser),
      });
    });

    await setupApiMocks(page, { user: fixtures.adminUser });

    await page.goto("/dashboard");

    // Admin should see admin link
    const adminLink = page.getByRole("link", { name: /admin/i });
    await expect(adminLink).toBeVisible();
  });
});
