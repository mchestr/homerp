import { http, HttpResponse } from "msw";
import { test, expect } from "../fixtures/test-setup";
import { testCreditPacks, testOperationCosts } from "../fixtures/factories";

test.describe("Landing Page", () => {
  test("displays pricing section with credit packs from API", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for the pricing section to load
    await expect(
      page.getByRole("heading", { name: /pay-as-you-go pricing/i })
    ).toBeVisible();

    // Check that credit packs are displayed with correct values from fixtures
    await expect(page.getByText("25 credits")).toBeVisible();
    await expect(page.getByText("100 credits")).toBeVisible();
    await expect(page.getByText("500 credits")).toBeVisible();

    // Check prices are displayed correctly (formatted from cents)
    await expect(page.getByText("$3")).toBeVisible();
    await expect(page.getByText("$10")).toBeVisible();
    await expect(page.getByText("$40")).toBeVisible();
  });

  test("displays signup credits from API in free tier", async ({ page }) => {
    await page.goto("/");

    // Wait for the pricing section to load
    await expect(
      page.getByRole("heading", { name: /pay-as-you-go pricing/i })
    ).toBeVisible();

    // Check that signup credits are displayed (5 from testOperationCosts fixture)
    await expect(page.getByText(/5 free AI credits on signup/i)).toBeVisible();
  });

  test("shows loading skeleton while fetching pricing data", async ({
    page,
    network,
  }) => {
    // Set up slow response to catch loading state
    let resolveRoute: () => void;
    const routePromise = new Promise<void>((resolve) => {
      resolveRoute = resolve;
    });

    network.use(
      http.get("**/api/v1/billing/packs", async () => {
        await routePromise;
        return HttpResponse.json(testCreditPacks);
      })
    );

    // Navigate without waiting for network idle
    await page.goto("/", { waitUntil: "commit" });

    // Check for loading skeleton (animated pulse elements)
    const skeletonElements = page.locator(".animate-pulse");
    await expect(skeletonElements.first()).toBeVisible({ timeout: 5000 });

    // Now allow the route to complete
    resolveRoute!();
  });

  test("displays hero section with call to action", async ({ page }) => {
    await page.goto("/");

    // Check hero heading - "Your home inventory, organized by AI"
    await expect(
      page.getByRole("heading", {
        name: /your home inventory/i,
        level: 1,
      })
    ).toBeVisible();

    // Check CTA button
    await expect(
      page.getByRole("link", { name: /start free today/i }).first()
    ).toBeVisible();
  });

  test("displays features bento grid", async ({ page }) => {
    await page.goto("/");

    // Check for feature headings
    await expect(
      page.getByText(/AI-Powered Photo Classification/i)
    ).toBeVisible();
    await expect(page.getByText(/Hierarchical Organization/i)).toBeVisible();
    await expect(page.getByText(/QR Codes & Labels/i)).toBeVisible();
  });

  test("has working navigation to login", async ({ page }) => {
    await page.goto("/");

    // Click Start Free Today link and check navigation
    const getStartedLink = page
      .getByRole("link", { name: /start free today/i })
      .first();
    await getStartedLink.click();

    await expect(page).toHaveURL(/\/login/);
  });

  test("displays custom signup credits value when configured differently", async ({
    page,
    network,
  }) => {
    // Override the costs endpoint with a different signup_credits value
    network.use(
      http.get("**/api/v1/billing/costs", () => {
        return HttpResponse.json({
          ...testOperationCosts,
          signup_credits: 10, // Custom value
        });
      })
    );

    await page.goto("/");

    // Check that the custom signup credits value is displayed
    await expect(page.getByText(/10 free AI credits on signup/i)).toBeVisible();
  });
});

test.describe("Landing Page (Mobile)", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test("displays mobile-optimized layout without horizontal scroll", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for page to fully load
    await expect(
      page.getByRole("heading", { name: /your home inventory/i })
    ).toBeVisible();

    // Check no horizontal scrolling on page
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(376); // 375 + 1px tolerance
  });

  test("displays hero section with proper mobile layout", async ({ page }) => {
    await page.goto("/");

    // Check hero heading is visible
    await expect(
      page.getByRole("heading", {
        name: /your home inventory/i,
        level: 1,
      })
    ).toBeVisible();

    // Check CTA buttons are visible
    await expect(
      page.getByRole("link", { name: /start free today/i }).first()
    ).toBeVisible();
  });

  test("displays pricing section correctly on mobile", async ({ page }) => {
    await page.goto("/");

    // Wait for pricing section to load
    await expect(
      page.getByRole("heading", { name: /pay-as-you-go pricing/i })
    ).toBeVisible();

    // Check pricing content is visible
    await expect(page.getByText(/Free Tier/i)).toBeVisible();
    await expect(page.getByText(/AI Credit Packs/i)).toBeVisible();
  });

  test("touch targets are adequately sized", async ({ page }) => {
    await page.goto("/");

    // Get the primary CTA button
    const ctaButton = page
      .getByRole("link", { name: /start free today/i })
      .first();
    await expect(ctaButton).toBeVisible();

    // Check button height is at least 44px (Apple's minimum touch target)
    const boundingBox = await ctaButton.boundingBox();
    expect(boundingBox).not.toBeNull();
    expect(boundingBox!.height).toBeGreaterThanOrEqual(44);
  });
});
