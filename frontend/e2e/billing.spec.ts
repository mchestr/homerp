import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Billing", () => {
  test("displays credit balance and packs", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/settings/billing");

    // Should show credit balance section
    await expect(
      page.getByRole("heading", { name: "Credit Balance" })
    ).toBeVisible();

    // Should show at least one credit pack
    await expect(
      page.getByText(fixtures.testCreditPacks[0].name)
    ).toBeVisible();
  });

  test("shows transaction history", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/settings/billing");

    // Should show past transactions
    await expect(
      page.getByText(fixtures.testCreditTransactions[0].description)
    ).toBeVisible();
  });

  test("purchase button is available", async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);

    await page.goto("/settings/billing");

    const purchaseButton = page
      .getByRole("button", { name: /purchase|buy/i })
      .first();
    await expect(purchaseButton).toBeVisible();
  });
});
