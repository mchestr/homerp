import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import {
  testCollaborationContext,
  testCollaborationContextViewer,
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

test.describe("Viewer Permission Restrictions", () => {
  test.describe("Items List Page - Viewer Role", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContextViewer,
      });

      // Navigate to dashboard and switch to shared inventory
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: /dashboard/i })
      ).toBeVisible();

      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to the shared inventory (viewer role)
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();

      await page.waitForLoadState("networkidle");
    });

    test("hides add item button for viewers", async ({ page }) => {
      await page.goto("/items");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify add item button is not visible
      await expect(page.getByTestId("add-item-button")).not.toBeVisible();
    });

    test("hides batch upload button for viewers", async ({ page }) => {
      await page.goto("/items");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify batch upload button is not visible
      await expect(page.getByTestId("batch-upload-button")).not.toBeVisible();
    });

    test("hides select items button for viewers", async ({ page }) => {
      await page.goto("/items");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify select items button is not visible
      await expect(page.getByTestId("enter-selection-mode")).not.toBeVisible();
    });

    test("hides batch update button for viewers", async ({ page }) => {
      await page.goto("/items");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify batch update button is not visible
      await expect(page.getByTestId("batch-update-button")).not.toBeVisible();
    });
  });

  test.describe("Items List Page - Editor Role", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContext,
      });

      // Navigate to dashboard and switch to shared inventory
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: /dashboard/i })
      ).toBeVisible();

      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to the shared inventory (editor role)
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();

      await page.waitForLoadState("networkidle");
    });

    test("shows add item button for editors", async ({ page }) => {
      await page.goto("/items");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify add item button IS visible for editors
      await expect(page.getByTestId("add-item-button")).toBeVisible();
    });

    test("shows batch upload button for editors", async ({ page }) => {
      await page.goto("/items");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify batch upload button IS visible for editors
      await expect(page.getByTestId("batch-upload-button")).toBeVisible();
    });

    test("shows select items button for editors", async ({ page }) => {
      await page.goto("/items");
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify select items button IS visible for editors
      await expect(page.getByTestId("enter-selection-mode")).toBeVisible();
    });
  });

  test.describe("Item Detail Page - Viewer Role", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContextViewer,
      });

      // Navigate to dashboard and switch to shared inventory
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: /dashboard/i })
      ).toBeVisible();

      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to the shared inventory (viewer role)
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();

      await page.waitForLoadState("networkidle");
    });

    test("hides edit button for viewers", async ({ page }) => {
      await page.goto("/items/item-1");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify edit button is not visible
      await expect(page.getByTestId("edit-button")).not.toBeVisible();
    });

    test("hides delete button for viewers", async ({ page }) => {
      await page.goto("/items/item-1");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify delete button is not visible
      await expect(page.getByTestId("delete-button")).not.toBeVisible();
    });

    test("hides image upload section for viewers", async ({ page }) => {
      await page.goto("/items/item-1");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify "Upload Image" heading is not visible
      await expect(
        page.getByRole("heading", { name: /upload image/i })
      ).not.toBeVisible();
    });

    test("hides check-in/out card for viewers", async ({ page }) => {
      await page.goto("/items/item-1");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify "Check In / Out" heading is not visible (note the spaces)
      await expect(
        page.getByRole("heading", { name: /check in \/ out/i })
      ).not.toBeVisible();
    });

    test("shows print label button for viewers", async ({ page }) => {
      await page.goto("/items/item-1");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify print label button IS visible (viewers can print labels)
      await expect(page.getByTestId("print-label-button")).toBeVisible();
    });
  });

  test.describe("Item Detail Page - Editor Role", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContext,
      });

      // Navigate to dashboard and switch to shared inventory
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: /dashboard/i })
      ).toBeVisible();

      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to the shared inventory (editor role)
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();

      await page.waitForLoadState("networkidle");
    });

    test("shows edit button for editors", async ({ page }) => {
      await page.goto("/items/item-1");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify edit button IS visible for editors
      await expect(page.getByTestId("edit-button")).toBeVisible();
    });

    test("shows delete button for editors", async ({ page }) => {
      await page.goto("/items/item-1");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify delete button IS visible for editors
      await expect(page.getByTestId("delete-button")).toBeVisible();
    });

    test("shows image upload section for editors", async ({ page }) => {
      await page.goto("/items/item-1");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify "Upload Image" heading IS visible for editors
      await expect(
        page.getByRole("heading", { name: /upload image/i })
      ).toBeVisible();
    });

    test("shows check-in/out card for editors", async ({ page }) => {
      await page.goto("/items/item-1");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify "Check In / Out" heading IS visible for editors (note the spaces)
      await expect(
        page.getByRole("heading", { name: /check in \/ out/i })
      ).toBeVisible();
    });
  });

  test.describe("Categories Page - Viewer Role", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContextViewer,
      });

      // Navigate to dashboard and switch to shared inventory
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: /dashboard/i })
      ).toBeVisible();

      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to the shared inventory (viewer role)
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();

      await page.waitForLoadState("networkidle");
    });

    test("hides add category button for viewers", async ({ page }) => {
      await page.goto("/categories");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify add category button is not visible
      // Looking for button with "Add Category" text
      await expect(
        page.getByRole("button", { name: /add category/i })
      ).not.toBeVisible();
    });

    test("hides edit/delete buttons on category items for viewers", async ({
      page,
    }) => {
      await page.goto("/categories");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Wait for categories tree view to load
      await expect(page.getByTestId("categories-tree-view")).toBeVisible();

      // Verify edit buttons (with Edit icon) are not visible
      // Using count assertion since there might be no categories in view mode
      const editButtons = page.locator('button[title="Edit" i]');
      await expect(editButtons).toHaveCount(0);

      // Verify delete buttons (with Delete/Trash icon) are not visible
      const deleteButtons = page.locator('button[title="Delete" i]');
      await expect(deleteButtons).toHaveCount(0);
    });
  });

  test.describe("Categories Page - Editor Role", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContext,
      });

      // Navigate to dashboard and switch to shared inventory
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: /dashboard/i })
      ).toBeVisible();

      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to the shared inventory (editor role)
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();

      await page.waitForLoadState("networkidle");
    });

    test("shows add category button for editors", async ({ page }) => {
      await page.goto("/categories");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify add category button IS visible for editors
      await expect(
        page.getByRole("button", { name: /add category/i })
      ).toBeVisible();
    });

    test("shows edit/delete buttons on category items for editors", async ({
      page,
    }) => {
      await page.goto("/categories");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Wait for categories tree view to load
      await expect(page.getByTestId("categories-tree-view")).toBeVisible();

      // Hover over Electronics category node to reveal action buttons
      const categoryNode = page.getByText("Electronics");
      await categoryNode.hover();

      // Verify edit buttons (with Edit icon) are visible
      const editButtons = page.locator('button[title="Edit" i]');
      await expect(editButtons.first()).toBeVisible();

      // Verify delete buttons (with Delete/Trash icon) are visible
      const deleteButtons = page.locator('button[title="Delete" i]');
      await expect(deleteButtons.first()).toBeVisible();
    });
  });

  test.describe("Locations Page - Viewer Role", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContextViewer,
      });

      // Navigate to dashboard and switch to shared inventory
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: /dashboard/i })
      ).toBeVisible();

      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to the shared inventory (viewer role)
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();

      await page.waitForLoadState("networkidle");
    });

    test("hides add location button for viewers", async ({ page }) => {
      await page.goto("/locations");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify add location button is not visible
      await expect(page.getByTestId("add-location-button")).not.toBeVisible();
    });

    test("hides edit/delete buttons on location items for viewers", async ({
      page,
    }) => {
      await page.goto("/locations");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Wait for locations tree view to load
      await expect(page.getByTestId("locations-tree-view")).toBeVisible();

      // Verify edit buttons (with Edit icon) are not visible
      const editButtons = page.locator('button[title="Edit" i]');
      await expect(editButtons).toHaveCount(0);

      // Verify delete buttons (with Delete/Trash icon) are not visible
      const deleteButtons = page.locator('button[title="Delete" i]');
      await expect(deleteButtons).toHaveCount(0);
    });

    test("shows QR code button for viewers", async ({ page }) => {
      await page.goto("/locations");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Wait for locations tree view to load
      await expect(page.getByTestId("locations-tree-view")).toBeVisible();

      // Verify QR code buttons are visible (viewers can view QR codes)
      // Use specific test id from the tree view
      const qrButtons = page.locator('[data-testid^="qr-button-"]');
      await expect(qrButtons.first()).toBeVisible();
    });

    test("shows print label button for viewers", async ({ page }) => {
      await page.goto("/locations");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Wait for locations tree view to load
      await expect(page.getByTestId("locations-tree-view")).toBeVisible();

      // Verify print label buttons are visible (viewers can print labels)
      const printButtons = page.locator('[data-testid^="print-label-button-"]');
      await expect(printButtons.first()).toBeVisible();
    });
  });

  test.describe("Locations Page - Editor Role", () => {
    test.beforeEach(async ({ page, isMobile }) => {
      await authenticateUser(page);
      await setupApiMocks(page, {
        collaborationContext: testCollaborationContext,
      });

      // Navigate to dashboard and switch to shared inventory
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: /dashboard/i })
      ).toBeVisible();

      await openMobileSidebarIfNeeded(page, isMobile);

      // Switch to the shared inventory (editor role)
      await page.getByTestId("inventory-switcher").click();
      await page
        .getByTestId(`inventory-option-${sharedInventoryOwner.id}`)
        .click();

      await page.waitForLoadState("networkidle");
    });

    test("shows add location button for editors", async ({ page }) => {
      await page.goto("/locations");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Verify add location button IS visible for editors
      await expect(page.getByTestId("add-location-button")).toBeVisible();
    });

    test("shows edit/delete buttons on location items for editors", async ({
      page,
    }) => {
      await page.goto("/locations");

      // Wait for the page to load
      await expect(page.getByTestId("shared-inventory-banner")).toBeVisible();

      // Wait for locations tree view to load
      await expect(page.getByTestId("locations-tree-view")).toBeVisible();

      // Hover over Workshop location node to reveal action buttons
      const locationNode = page.getByText("Workshop");
      await locationNode.hover();

      // Verify edit buttons (with Edit icon) are visible
      const editButtons = page.locator('button[title="Edit" i]');
      await expect(editButtons.first()).toBeVisible();

      // Verify delete buttons (with Delete/Trash icon) are visible
      const deleteButtons = page.locator('button[title="Delete" i]');
      await expect(deleteButtons.first()).toBeVisible();
    });
  });
});
