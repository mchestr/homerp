import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";

test.describe("Categories", () => {
  test("displays categories page", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/categories");

    await expect(
      page.getByRole("heading", { name: /categories/i })
    ).toBeVisible();
    await expect(page.getByText("Electronics")).toBeVisible();
  });

  test("can create new category", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/categories");

    const addButton = page.getByRole("button", { name: /add|new|create/i });
    await addButton.click();

    const nameInput = page.getByLabel(/name/i);
    await expect(nameInput).toBeVisible();

    await nameInput.fill("Test Category");

    const submitButton = page.getByRole("button", { name: /save|create|add/i });
    await submitButton.click();

    await expect(page.getByText("Test Category")).toBeVisible();
  });
});
