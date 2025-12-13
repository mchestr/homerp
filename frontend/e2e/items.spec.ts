import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Items", () => {
  test("displays list of items", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/items");

    await expect(page.getByRole("heading", { name: /items/i })).toBeVisible();

    // Should display first test item
    await expect(page.getByText(fixtures.testItems[0].name)).toBeVisible();
  });

  test("can navigate to create new item", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/items");

    // Wait for the items page to fully load
    await expect(page.getByRole("heading", { name: /items/i })).toBeVisible();

    // Use data-testid for reliable selection and wait for it to be visible
    const addItemButton = page.getByTestId("add-item-button");
    await addItemButton.waitFor({ state: "visible" });
    await addItemButton.click();

    // Use longer timeout for navigation in CI
    await expect(page).toHaveURL(/.*\/items\/new/, { timeout: 10000 });
  });

  test("can view item details", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    const item = fixtures.testItems[0];
    await page.goto(`/items/${item.id}`);

    await expect(page.getByText(item.name)).toBeVisible();
  });

  test("can create item", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/items/new");

    await page.getByTestId("item-name-input").fill("Test Item");

    const submitButton = page.getByRole("button", { name: /create|save|add/i });
    await submitButton.click();

    await expect(page).toHaveURL(/.*\/items/);
  });

  test.describe("View Toggle", () => {
    test("displays grid view by default", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      await page.goto("/items");

      // Wait for items to load
      await expect(
        page.getByTestId(`item-card-${fixtures.testItems[0].id}`)
      ).toBeVisible();

      // Verify grid view is visible
      await expect(page.getByTestId("items-grid-view")).toBeVisible();

      // Verify table view is not visible
      await expect(page.getByTestId("items-table-view")).not.toBeVisible();

      // Verify grid button is active
      const gridButton = page.getByTestId("view-mode-grid");
      await expect(gridButton).toHaveClass(/bg-primary/);
    });

    test("can switch to table view", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      await page.goto("/items");

      // Wait for grid view to load
      await expect(
        page.getByTestId(`item-card-${fixtures.testItems[0].id}`)
      ).toBeVisible();

      // Click table view button
      const tableButton = page.getByTestId("view-mode-table");
      await tableButton.click();

      // Wait for table view to appear
      await expect(page.getByTestId("items-table-view")).toBeVisible();

      // Verify grid view is hidden
      await expect(page.getByTestId("items-grid-view")).not.toBeVisible();

      // Verify table button is active
      await expect(tableButton).toHaveClass(/bg-primary/);

      // Verify first item row is visible
      await expect(
        page.getByTestId(`item-row-${fixtures.testItems[0].id}`)
      ).toBeVisible();
    });

    test("both views display the same items", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      await page.goto("/items");

      // Wait for grid view to load
      await expect(
        page.getByTestId(`item-card-${fixtures.testItems[0].id}`)
      ).toBeVisible();

      // Count items in grid view
      const gridItems = page.getByTestId(/^item-card-/);
      const gridCount = await gridItems.count();

      // Switch to table view
      await page.getByTestId("view-mode-table").click();
      await expect(page.getByTestId("items-table-view")).toBeVisible();

      // Count items in table view
      const tableItems = page.getByTestId(/^item-row-/);
      const tableCount = await tableItems.count();

      // Verify same number of items
      expect(gridCount).toBe(tableCount);
      expect(gridCount).toBe(fixtures.testItems.length);

      // Verify all test items are present in table view
      for (const item of fixtures.testItems) {
        await expect(page.getByTestId(`item-row-${item.id}`)).toBeVisible();
      }
    });

    test("quick quantity buttons work in grid view", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      const testItem = fixtures.testItems[0];

      // Mock the quantity update endpoint BEFORE navigating
      await page.route(
        `**/api/v1/items/${testItem.id}/quantity`,
        async (route) => {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...testItem,
              quantity: body.quantity,
            }),
          });
        }
      );

      await page.goto("/items");

      const itemCard = page.getByTestId(`item-card-${testItem.id}`);

      // Wait for item card to be visible
      await expect(itemCard).toBeVisible();

      // Find and click the increment button - use more specific locator
      const incrementButton = itemCard.getByTitle(/increase/i);
      await expect(incrementButton).toBeVisible();

      // Set up promise before clicking
      const responsePromise = page.waitForResponse(
        `**/api/v1/items/${testItem.id}/quantity`
      );
      await incrementButton.click();

      // Wait for the API call
      await responsePromise;
    });

    test("quick quantity buttons work in table view", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      const testItem = fixtures.testItems[0];

      // Mock the quantity update endpoint BEFORE navigating
      await page.route(
        `**/api/v1/items/${testItem.id}/quantity`,
        async (route) => {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...testItem,
              quantity: body.quantity,
            }),
          });
        }
      );

      await page.goto("/items");

      // Switch to table view
      await page.getByTestId("view-mode-table").click();
      await expect(page.getByTestId("items-table-view")).toBeVisible();

      const itemRow = page.getByTestId(`item-row-${testItem.id}`);

      // Wait for item row to be visible
      await expect(itemRow).toBeVisible();

      // Find and click the decrement button
      const decrementButton = itemRow.getByTitle(/decrease/i);
      await expect(decrementButton).toBeVisible();

      // Set up promise before clicking
      const responsePromise = page.waitForResponse(
        `**/api/v1/items/${testItem.id}/quantity`
      );
      await decrementButton.click();

      // Wait for the API call
      await responsePromise;
    });

    test("low stock indicator is visible in grid view", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      await page.goto("/items");

      // Find the low stock item (item-3)
      const lowStockItem = fixtures.testItems.find((i) => i.is_low_stock);
      expect(lowStockItem).toBeDefined();

      const itemCard = page.getByTestId(`item-card-${lowStockItem!.id}`);
      await expect(itemCard).toBeVisible();

      // Verify low stock badge is visible
      const lowStockBadge = itemCard.getByText(/low stock/i);
      await expect(lowStockBadge).toBeVisible();
    });

    test("low stock indicator is visible in table view", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      await page.goto("/items");

      // Switch to table view
      await page.getByTestId("view-mode-table").click();
      await expect(page.getByTestId("items-table-view")).toBeVisible();

      // Find the low stock item (item-3)
      const lowStockItem = fixtures.testItems.find((i) => i.is_low_stock);
      expect(lowStockItem).toBeDefined();

      const itemRow = page.getByTestId(`item-row-${lowStockItem!.id}`);
      await expect(itemRow).toBeVisible();

      // Verify low stock indicator is visible
      const lowStockIndicator = itemRow.getByText(/low stock/i);
      await expect(lowStockIndicator).toBeVisible();
    });

    test("view preference persists after page refresh", async ({ page }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      await page.goto("/items");

      // Wait for grid view to load
      await expect(
        page.getByTestId(`item-card-${fixtures.testItems[0].id}`)
      ).toBeVisible();

      // Switch to table view
      await page.getByTestId("view-mode-table").click();
      await expect(page.getByTestId("items-table-view")).toBeVisible();

      // Verify localStorage was set
      const viewMode = await page.evaluate(() =>
        localStorage.getItem("items-view-mode")
      );
      expect(viewMode).toBe('"table"');

      // Refresh the page
      await page.reload();

      // Wait for table view to load after refresh
      await expect(page.getByTestId("items-table-view")).toBeVisible();

      // Verify table view is still active
      await expect(page.getByTestId("items-grid-view")).not.toBeVisible();
      await expect(page.getByTestId("view-mode-table")).toHaveClass(
        /bg-primary/
      );

      // Verify items are displayed
      await expect(
        page.getByTestId(`item-row-${fixtures.testItems[0].id}`)
      ).toBeVisible();
    });

    test("table view scrolls horizontally on mobile viewport", async ({
      page,
    }) => {
      await authenticateUser(page);
      await setupApiMocks(page);

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/items");

      // Switch to table view
      await page.getByTestId("view-mode-table").click();
      await expect(page.getByTestId("items-table-view")).toBeVisible();

      // Verify table container has overflow-x-auto class
      const tableContainer = page.getByTestId("items-table-view");
      await expect(tableContainer).toHaveClass(/overflow-x-auto/);

      // Verify table is scrollable by checking that content width exceeds container
      const scrollWidth = await tableContainer.evaluate((el) => el.scrollWidth);
      const clientWidth = await tableContainer.evaluate((el) => el.clientWidth);

      // Table should be wider than container on mobile
      expect(scrollWidth).toBeGreaterThan(clientWidth);
    });
  });
});
