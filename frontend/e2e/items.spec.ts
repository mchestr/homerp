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

    // Target the "Add Item" button in the main content area (avoid sidebar "New Item" link)
    const newItemButton = page
      .getByRole("main")
      .getByRole("link", { name: "Add Item" });
    await newItemButton.click();

    await expect(page).toHaveURL(/.*\/items\/new/);
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
});
