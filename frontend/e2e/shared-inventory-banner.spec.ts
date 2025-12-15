import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import {
  testCollaborationContext,
  testCollaborationContextViewer,
  testCollaborationContextEmpty,
  sharedInventoryOwner,
} from "./fixtures/test-data";

// Helper to open mobile sidebar if needed
async function openMobileSidebarIfNeeded(
  page: import("@playwright/test").Page,
  isMobile: boolean
) {
  if (isMobile) {
    const menuButton = page
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-menu") });
    await menuButton.waitFor({ state: "visible" });
    await menuButton.click();
  }
}

test.describe("Shared Inventory Banner", () => {
  test.describe("when viewing a shared inventory with editor role", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContext,
      });

      // Navigate to dashboard to trigger inventory context load
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: /dashboard/i })
      ).toBeVisible();

      // On mobile, need to open the sidebar first
      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to the shared inventory
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();

      // Wait for the page to reload with the new inventory context
      await page.waitForLoadState("networkidle");
    });

    test("shows banner on /dashboard page", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify the banner shows the owner's name
      await expect(page.getByTestId("shared-inventory-banner")).toContainText(
        sharedInventoryOwner.name
      );

      // Verify the badge shows "Editor"
      const badge = page.getByTestId("shared-inventory-role-badge");
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/editor/i);
    });

    test("shows banner on /items page", async ({ page }) => {
      await page.goto("/items");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();
      await expect(page.getByTestId("shared-inventory-banner")).toContainText(
        sharedInventoryOwner.name
      );
    });

    test("shows banner on /categories page", async ({ page }) => {
      await page.goto("/categories");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();
      await expect(page.getByTestId("shared-inventory-banner")).toContainText(
        sharedInventoryOwner.name
      );
    });

    test("shows banner on /locations page", async ({ page }) => {
      await page.goto("/locations");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();
      await expect(page.getByTestId("shared-inventory-banner")).toContainText(
        sharedInventoryOwner.name
      );
    });

    test("shows banner on /checked-out page", async ({ page }) => {
      await page.goto("/checked-out");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();
      await expect(page.getByTestId("shared-inventory-banner")).toContainText(
        sharedInventoryOwner.name
      );
    });

    test("shows banner on /gridfinity page", async ({ page }) => {
      await page.goto("/gridfinity");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();
      await expect(page.getByTestId("shared-inventory-banner")).toContainText(
        sharedInventoryOwner.name
      );
    });

    test("hides banner on /settings page", async ({ page }) => {
      await page.goto("/settings");
      await expect(
        page.getByTestId("shared-inventory-banner")
      ).not.toBeVisible();
    });

    test("hides banner on /ai-assistant page", async ({ page }) => {
      await page.goto("/ai-assistant");
      await expect(
        page.getByTestId("shared-inventory-banner")
      ).not.toBeVisible();
    });

    test("hides banner on /images/classified page", async ({ page }) => {
      await page.goto("/images/classified");
      await expect(
        page.getByTestId("shared-inventory-banner")
      ).not.toBeVisible();
    });

    test("hides banner on /declutter-suggestions page", async ({ page }) => {
      await page.goto("/declutter-suggestions");
      await expect(
        page.getByTestId("shared-inventory-banner")
      ).not.toBeVisible();
    });

    test("hides banner on /feedback page", async ({ page }) => {
      await page.goto("/feedback");
      await expect(
        page.getByTestId("shared-inventory-banner")
      ).not.toBeVisible();
    });

    test("hides banner on /admin page", async ({ page }) => {
      await page.goto("/admin");
      await expect(
        page.getByTestId("shared-inventory-banner")
      ).not.toBeVisible();
    });
  });

  test.describe("when viewing a shared inventory with viewer role", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContextViewer,
      });

      // Navigate to dashboard to trigger inventory context load
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: /dashboard/i })
      ).toBeVisible();

      // On mobile, need to open the sidebar first
      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to the shared inventory
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();

      // Wait for the page to reload with the new inventory context
      await page.waitForLoadState("networkidle");
    });

    test("shows banner with viewer badge on /dashboard page", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify the badge shows "Viewer"
      const badge = page.getByTestId("shared-inventory-role-badge");
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/viewer/i);
    });

    test("shows banner with viewer badge on /items page", async ({ page }) => {
      await page.goto("/items");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      const badge = page.getByTestId("shared-inventory-role-badge");
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/viewer/i);
    });
  });

  test.describe("when viewing own inventory", () => {
    test.beforeEach(async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        // No shared inventories
        collaborationContext: testCollaborationContextEmpty,
      });
    });

    test("hides banner on /dashboard page", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(
        page.getByTestId("shared-inventory-banner")
      ).not.toBeVisible();
    });

    test("hides banner on /items page", async ({ page }) => {
      await page.goto("/items");
      await expect(
        page.getByTestId("shared-inventory-banner")
      ).not.toBeVisible();
    });

    test("hides banner on /settings page", async ({ page }) => {
      await page.goto("/settings");
      await expect(
        page.getByTestId("shared-inventory-banner")
      ).not.toBeVisible();
    });
  });

  test.describe("banner content", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContext,
      });

      // Navigate to dashboard and switch to shared inventory
      await page.goto("/dashboard");

      // On mobile, need to open the sidebar first
      await openMobileSidebarIfNeeded(page, isMobile);

      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();
      await page.waitForLoadState("networkidle");
      await page.goto("/dashboard");
    });

    test("displays owner name in banner", async ({ page }) => {
      const banner = page.getByTestId("shared-inventory-banner");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText(sharedInventoryOwner.name);
    });

    test("displays editor role badge", async ({ page }) => {
      const badge = page.getByTestId("shared-inventory-role-badge");
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/editor/i);
    });
  });

  test.describe("switching between inventories", () => {
    test("banner disappears when switching back to own inventory", async ({
      page,
      isMobile,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContext,
      });

      await page.goto("/dashboard");

      // On mobile, need to open the sidebar first
      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to shared inventory
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();
      await page.waitForLoadState("networkidle");
      await page.goto("/dashboard");

      // Verify banner is visible
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // On mobile, need to open the sidebar again after page navigation
      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch back to own inventory
      await page.getByTestId("inventory-switcher").click();
      await page.getByTestId("inventory-option-own").click();
      await page.waitForLoadState("networkidle");
      await page.goto("/dashboard");

      // Verify banner is hidden
      await expect(
        page.getByTestId("shared-inventory-banner")
      ).not.toBeVisible();
    });
  });
});
