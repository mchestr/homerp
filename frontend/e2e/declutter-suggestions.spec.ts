import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Declutter Suggestions", () => {
  test("slider max is capped to total items when user has fewer items than max", async ({
    page,
  }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      declutterCost: fixtures.testDeclutterCostFewItems,
    });

    await page.goto("/declutter-suggestions");

    // Wait for the cost info card to load
    await expect(page.getByTestId("cost-info-card")).toBeVisible();

    // Check that the slider exists
    const slider = page.getByTestId("items-slider");
    await expect(slider).toBeVisible();

    // The slider max should be capped to total_items (15)
    // Check the max label shows 15 instead of 200
    await expect(page.getByText("15").first()).toBeVisible();

    // The total items display should show 15
    await expect(
      page.getByText(fixtures.testDeclutterCostFewItems.total_items.toString())
    ).toBeVisible();
  });

  test("slider max is 200 when user has more than 200 items", async ({
    page,
  }) => {
    await authenticateUser(page);
    await setupApiMocks(page, {
      declutterCost: {
        ...fixtures.testDeclutterCost,
        total_items: 500,
        items_to_analyze: 50,
      },
    });

    await page.goto("/declutter-suggestions");

    // Wait for the cost info card to load
    await expect(page.getByTestId("cost-info-card")).toBeVisible();

    // The slider max should be 200 (not 500)
    await expect(page.getByText("200")).toBeVisible();
  });

  test("displays cost info and recommendations", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/declutter-suggestions");

    // Should show cost info card
    await expect(page.getByTestId("cost-info-card")).toBeVisible();

    // Should show total items count
    await expect(
      page.getByText(fixtures.testDeclutterCost.total_items.toString())
    ).toBeVisible();

    // Should show existing recommendations
    await expect(
      page.getByText(fixtures.testDeclutterRecommendations[0].item_name)
    ).toBeVisible();
  });

  test("generate button is visible when user has profile and credits", async ({
    page,
  }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/declutter-suggestions");

    // Wait for page to load
    await expect(page.getByTestId("cost-info-card")).toBeVisible();

    // Generate button should be visible
    await expect(page.getByTestId("generate-button")).toBeVisible();
  });
});
