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

    await page.getByTestId("add-location-button").click();

    const nameInput = page.getByTestId("location-name-input");
    await expect(nameInput).toBeVisible();

    await nameInput.fill("Storage Room");

    await page.getByTestId("location-submit-button").click();

    // Form should close after successful submission
    await expect(nameInput).not.toBeVisible();
    // Add button should reappear
    await expect(page.getByTestId("add-location-button")).toBeVisible();
  });
});
