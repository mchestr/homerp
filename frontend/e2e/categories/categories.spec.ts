import { test, expect, authenticateUser } from "../fixtures/test-setup";

test.describe("Categories", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test("displays categories page", async ({ page }) => {
    await page.goto("/categories");

    await expect(
      page.getByRole("heading", { name: /categories/i })
    ).toBeVisible();

    // Wait for categories to load (from testCategoryTree fixture)
    await expect(page.getByText("Electronics")).toBeVisible();
  });

  test("can create new category", async ({ page }) => {
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
