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

    // Wait for categories to load
    await expect(page.getByText("Electronics")).toBeVisible();
  });

  test("can create new category", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/categories");

    const addButton = page.getByRole("button", { name: "Add Category" });
    await addButton.click();

    const nameInput = page.getByTestId("category-name-input");
    await expect(nameInput).toBeVisible();

    await nameInput.fill("Test Category");

    const submitButton = page.getByTestId("category-submit-button");
    await submitButton.click();

    // Form should close after successful submission
    await expect(nameInput).not.toBeVisible();
    // Add Category button should reappear
    await expect(addButton).toBeVisible();
  });
});
