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
    const costCard = page.getByTestId("cost-info-card");
    await expect(costCard).toBeVisible();

    // Check that the slider exists
    const slider = page.getByTestId("items-slider");
    await expect(slider).toBeVisible();

    // The slider max should be capped to total_items (15)
    // The max label is in a div with class "text-xs text-muted-foreground" below the slider
    // Look for the slider range labels (10 and 15) within the card
    await expect(costCard.getByText("10")).toBeVisible();
    // The max should be 15 (total_items), not 200
    await expect(costCard.locator(".text-xs").getByText("15")).toBeVisible();
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
    const costCard = page.getByTestId("cost-info-card");
    await expect(costCard).toBeVisible();

    // Should show total items count in the stats grid (bold text)
    await expect(
      costCard
        .locator(".text-2xl.font-bold")
        .getByText(fixtures.testDeclutterCost.total_items.toString())
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
