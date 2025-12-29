import { http, HttpResponse } from "msw";
import { test, expect } from "../fixtures/test-setup";
import { testUser } from "../fixtures/factories";

test.describe("Authentication", () => {
  test("displays login page for unauthenticated users", async ({
    page,
    network,
  }) => {
    // Override auth/me to return 401 (unauthenticated)
    network.use(
      http.get("**/api/v1/auth/me", () => {
        return HttpResponse.json(
          { detail: "Not authenticated" },
          { status: 401 }
        );
      })
    );

    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  });

  test("protected routes redirect to login", async ({ page, network }) => {
    // Override auth/me to return 401 (unauthenticated)
    network.use(
      http.get("**/api/v1/auth/me", () => {
        return HttpResponse.json(
          { detail: "Not authenticated" },
          { status: 401 }
        );
      })
    );

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/.*\/(login|auth)/);
  });

  test("successful OAuth callback redirects to dashboard", async ({
    page,
    network,
  }) => {
    // Override the callback route to return success
    network.use(
      http.get("**/api/v1/auth/callback/google", () => {
        return HttpResponse.json({
          token: {
            access_token: "mock-jwt-token",
            expires_in: 86400,
          },
          user: testUser,
        });
      })
    );

    await page.goto("/callback/google?code=mock-auth-code");

    // Wait longer for the redirect to complete - it happens via React's router.push
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  });

  test("OAuth error shows error page", async ({ page, network }) => {
    // Override auth/me to return 401 (unauthenticated)
    network.use(
      http.get("**/api/v1/auth/me", () => {
        return HttpResponse.json(
          { detail: "Not authenticated" },
          { status: 401 }
        );
      })
    );

    await page.goto("/callback/google?error=access_denied");

    await expect(
      page.getByRole("heading", { name: "Authentication Failed" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Back to Login" })
    ).toBeVisible();
  });
});
