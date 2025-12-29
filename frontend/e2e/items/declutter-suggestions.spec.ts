import { http, HttpResponse } from "msw";
import { test, expect, authenticateUser } from "../fixtures/test-setup";
import {
  testDeclutterCost,
  testDeclutterCostFewItems,
  testDeclutterRecommendations,
} from "../fixtures/factories";

import type { NetworkFixture } from "@msw/playwright";

// Helper to set up declutter handlers with correct URLs
function setupDeclutterHandlers(
  network: NetworkFixture,
  costData: typeof testDeclutterCost
) {
  network.use(
    // Cost endpoint
    http.get("**/api/v1/profile/recommendations/cost", () => {
      return HttpResponse.json(costData);
    }),
    // List recommendations endpoint - returns direct array
    http.get("**/api/v1/profile/recommendations", () => {
      return HttpResponse.json(testDeclutterRecommendations);
    }),
    // Generate recommendations endpoint
    http.post("**/api/v1/profile/recommendations/generate", () => {
      return HttpResponse.json({
        recommendations: testDeclutterRecommendations,
        total_generated: testDeclutterRecommendations.length,
        credits_used: 1,
      });
    })
  );
}

test.describe("Declutter Suggestions", () => {
  test.describe("with few items (slider capped)", () => {
    test.beforeEach(async ({ page, network }) => {
      await authenticateUser(page);
      setupDeclutterHandlers(network, testDeclutterCostFewItems);
    });

    test("slider max is capped to total items when user has fewer items than max", async ({
      page,
    }) => {
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
  });

  test.describe("with many items (slider at 200)", () => {
    test.beforeEach(async ({ page, network }) => {
      await authenticateUser(page);
      setupDeclutterHandlers(network, {
        ...testDeclutterCost,
        total_items: 500,
        items_to_analyze: 50,
      });
    });

    test("slider max is 200 when user has more than 200 items", async ({
      page,
    }) => {
      await page.goto("/declutter-suggestions");

      // Wait for the cost info card to load
      await expect(page.getByTestId("cost-info-card")).toBeVisible();

      // The slider max should be 200 (not 500)
      await expect(page.getByText("200")).toBeVisible();
    });
  });

  test.describe("with default data", () => {
    test.beforeEach(async ({ page, network }) => {
      await authenticateUser(page);
      setupDeclutterHandlers(network, testDeclutterCost);
    });

    test("displays cost info and recommendations", async ({ page }) => {
      await page.goto("/declutter-suggestions");

      // Should show cost info card
      const costCard = page.getByTestId("cost-info-card");
      await expect(costCard).toBeVisible();

      // Should show total items count in the stats grid (bold text)
      await expect(
        costCard
          .locator(".text-2xl.font-bold")
          .getByText(testDeclutterCost.total_items.toString())
      ).toBeVisible();

      // Should show existing recommendations
      await expect(
        page.getByText(testDeclutterRecommendations[0].item_name)
      ).toBeVisible();
    });

    test("generate button is visible when user has profile and credits", async ({
      page,
    }) => {
      await page.goto("/declutter-suggestions");

      // Wait for page to load
      await expect(page.getByTestId("cost-info-card")).toBeVisible();

      // Generate button should be visible
      await expect(page.getByTestId("generate-button")).toBeVisible();
    });
  });
});
