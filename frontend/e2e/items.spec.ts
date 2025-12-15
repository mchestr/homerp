import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Items", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test("displays items and allows navigation", async ({ page }) => {
    await page.goto("/items");

    // Verify page loads with items
    await expect(page.getByRole("heading", { name: /items/i })).toBeVisible();
    await expect(page.getByText(fixtures.testItems[0].name)).toBeVisible();

    // Can navigate to create new item
    await page.getByTestId("add-item-button").click();
    await expect(page).toHaveURL(/.*\/items\/new/);
  });

  test("can view and create items", async ({ page }) => {
    // View item details
    const item = fixtures.testItems[0];
    await page.goto(`/items/${item.id}`);
    await expect(page.getByText(item.name)).toBeVisible();

    // Create new item
    await page.goto("/items/new");
    await page.getByTestId("item-name-input").fill("Test Item");
    await page.getByRole("button", { name: /create|save|add/i }).click();
    await expect(page).toHaveURL(/.*\/items/);
  });

  test.describe("View Toggle", () => {
    test("switches between grid and list views", async ({ page }) => {
      await page.goto("/items");

      // Verify grid view is default
      await expect(page.getByTestId("items-grid-view")).toBeVisible();
      await expect(page.getByTestId("view-mode-grid")).toHaveClass(
        /bg-primary/
      );
      await expect(
        page.getByTestId(`item-card-${fixtures.testItems[0].id}`)
      ).toBeVisible();

      // Switch to list view
      await page.getByTestId("view-mode-list").click();
      await expect(page.getByTestId("items-list-view")).toBeVisible();
      await expect(page.getByTestId("items-grid-view")).not.toBeVisible();
      await expect(page.getByTestId("view-mode-list")).toHaveClass(
        /bg-primary/
      );
      await expect(
        page.getByTestId(`item-row-${fixtures.testItems[0].id}`)
      ).toBeVisible();

      // Verify same number of items in both views
      const rowCount = await page.getByTestId(/^item-row-/).count();
      expect(rowCount).toBe(fixtures.testItems.length);
    });

    test("quick quantity buttons work", async ({ page }) => {
      const testItem = fixtures.testItems[0];

      // Mock quantity endpoint
      await page.route(
        `**/api/v1/items/${testItem.id}/quantity`,
        async (route) => {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ...testItem, quantity: body.quantity }),
          });
        }
      );

      await page.goto("/items");
      await expect(page.getByTestId(`item-card-${testItem.id}`)).toBeVisible();

      // Test increment in grid view
      const responsePromise = page.waitForResponse(
        `**/api/v1/items/${testItem.id}/quantity`
      );
      await page
        .getByTestId(`item-card-${testItem.id}`)
        .getByTitle(/increase/i)
        .click();
      await responsePromise;
    });

    test("shows low stock indicators", async ({ page }) => {
      await page.goto("/items");

      const lowStockItem = fixtures.testItems.find((i) => i.is_low_stock);
      expect(lowStockItem).toBeDefined();

      // Check grid view
      const itemCard = page.getByTestId(`item-card-${lowStockItem!.id}`);
      await expect(itemCard).toBeVisible();
      await expect(itemCard.getByText(/low stock/i)).toBeVisible();

      // Check list view
      await page.getByTestId("view-mode-list").click();
      const itemRow = page.getByTestId(`item-row-${lowStockItem!.id}`);
      await expect(itemRow).toBeVisible();
      await expect(itemRow.getByText(/low stock/i)).toBeVisible();
    });

    test("persists view preference", async ({ page }) => {
      await page.goto("/items");

      // Switch to list view
      await page.getByTestId("view-mode-list").click();
      await expect(page.getByTestId("items-list-view")).toBeVisible();

      // Verify localStorage
      const viewMode = await page.evaluate(() =>
        localStorage.getItem("items-view-mode")
      );
      expect(viewMode).toBe('"list"');

      // Reload and verify persistence
      await page.reload();
      await expect(page.getByTestId("items-list-view")).toBeVisible();
      await expect(page.getByTestId("view-mode-list")).toHaveClass(
        /bg-primary/
      );
    });

    test("list view is responsive on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/items");

      await page.getByTestId("view-mode-list").click();
      const listView = page.getByTestId("items-list-view");
      await expect(listView).toBeVisible();
      await expect(listView).toHaveClass(/overflow-x-auto/);

      // Verify scrollable
      const scrollWidth = await listView.evaluate((el) => el.scrollWidth);
      const clientWidth = await listView.evaluate((el) => el.clientWidth);
      expect(scrollWidth).toBeGreaterThan(clientWidth);
    });
  });

  test.describe("Similar Items Display", () => {
    test("displays similar items with authenticated images", async ({
      page,
    }) => {
      const signedUrlCalls: string[] = [];

      // Track signed-url calls
      await page.route(
        /\/api\/v1\/images\/[^/]+\/signed-url/,
        async (route) => {
          const match = route
            .request()
            .url()
            .match(/\/images\/([^/]+)\/signed-url/);
          signedUrlCalls.push(match?.[1] || "");
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              url: `http://localhost:8000/uploads/mock.jpg?token=mock`,
            }),
          });
        }
      );

      // Mock pre-classified image
      await page.route(/\/api\/v1\/images\/[^/]+$/, async (route) => {
        if (route.request().url().includes("signed-url")) {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "pre-classified-img",
            storage_path: "/uploads/test.jpg",
            original_filename: "test.jpg",
            mime_type: "image/jpeg",
            size_bytes: 102400,
            content_hash: "abc123",
            ai_processed: true,
            ai_result: {
              identified_name: "Arduino Uno R3",
              confidence: 0.95,
              category_path: "Electronics.Microcontrollers",
              description: "Arduino board",
              specifications: {},
              quantity_estimate: "1 piece",
            },
            created_at: "2024-01-01T00:00:00Z",
          }),
        });
      });

      await page.goto("/items/new?image_id=pre-classified-img");

      // Wait for similar items
      await expect(page.getByTestId("similar-items-section")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByTestId("similar-item-similar-1")).toBeVisible();
      await expect(page.getByTestId("similar-item-similar-2")).toBeVisible();

      // Verify authenticated image loading
      await page
        .waitForResponse(/\/signed-url/, { timeout: 5000 })
        .catch(() => {});
      expect(signedUrlCalls).toContain("img-similar-1");
      expect(signedUrlCalls).toContain("img-similar-2");
    });
  });
});
