import { http, HttpResponse } from "msw";
import { test, expect, authenticateUser } from "../fixtures/test-setup";
import {
  testCollaborationContext,
  testCollaborationContextViewer,
  testCollaborationContextEmpty,
  sharedInventoryOwner,
} from "../fixtures/factories";

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
    test.beforeEach(async ({ page, network, isMobile }) => {
      await authenticateUser(page);
      network.use(
        http.get("**/api/v1/collaboration/context", () => {
          return HttpResponse.json(testCollaborationContext);
        })
      );

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

    test("hides own-data sections from sidebar", async ({ page, isMobile }) => {
      await page.goto("/dashboard");

      // On mobile, need to open the sidebar first
      await openMobileSidebarIfNeeded(page, isMobile);

      // Verify own-data sections are hidden (AI Tools, Account, Admin)
      await expect(page.getByTestId("sidebar-link-settings")).not.toBeVisible();
      await expect(
        page.getByTestId("sidebar-link-ai-assistant")
      ).not.toBeVisible();
      await expect(
        page.getByTestId("sidebar-link-settings-billing")
      ).not.toBeVisible();
      await expect(page.getByTestId("sidebar-link-feedback")).not.toBeVisible();

      // Verify inventory sections are still visible
      await expect(page.getByTestId("sidebar-link-items")).toBeVisible();
      await expect(page.getByTestId("sidebar-link-categories")).toBeVisible();
      await expect(page.getByTestId("sidebar-link-locations")).toBeVisible();
    });

    test("shows mobile banner in header", async ({ page, isMobile }) => {
      // Skip on desktop - mobile banner is only visible on mobile
      test.skip(!isMobile, "Mobile-only test");

      await page.goto("/dashboard");

      // Mobile banner should be visible in header (without opening sidebar)
      await expect(
        page.getByTestId("shared-inventory-banner-mobile")
      ).toBeVisible();
      await expect(
        page.getByTestId("shared-inventory-banner-mobile")
      ).toContainText(sharedInventoryOwner.name);
    });
  });

  test.describe("when viewing a shared inventory with viewer role", () => {
    test.beforeEach(async ({ page, network, isMobile }) => {
      await authenticateUser(page);
      network.use(
        http.get("**/api/v1/collaboration/context", () => {
          return HttpResponse.json(testCollaborationContextViewer);
        })
      );

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
    test.beforeEach(async ({ page, network }) => {
      await authenticateUser(page);
      // No shared inventories
      network.use(
        http.get("**/api/v1/collaboration/context", () => {
          return HttpResponse.json(testCollaborationContextEmpty);
        })
      );
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
  });

  test.describe("banner content", () => {
    test.beforeEach(async ({ page, network, isMobile }) => {
      await authenticateUser(page);
      network.use(
        http.get("**/api/v1/collaboration/context", () => {
          return HttpResponse.json(testCollaborationContext);
        })
      );

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
      network,
      isMobile,
    }) => {
      await authenticateUser(page);
      network.use(
        http.get("**/api/v1/collaboration/context", () => {
          return HttpResponse.json(testCollaborationContext);
        })
      );

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
