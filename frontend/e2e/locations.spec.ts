import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";

test.describe("Locations", () => {
  test("displays locations page", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/locations");

    await expect(
      page.getByRole("heading", { name: /locations/i })
    ).toBeVisible();
    await expect(page.getByText("Workshop")).toBeVisible();
  });

  test("can create new location", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/locations");

    const addButton = page.getByRole("button", { name: /add|new|create/i });
    await addButton.click();

    const nameInput = page.getByLabel(/name/i);
    await expect(nameInput).toBeVisible();

    await nameInput.fill("Storage Room");

    const submitButton = page.getByRole("button", { name: /save|create|add/i });
    await submitButton.click();

    await expect(page.getByText("Storage Room")).toBeVisible();
  });
});
