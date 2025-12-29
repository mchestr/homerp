import { test, expect, authenticateUser } from "../fixtures/test-setup";

test.describe("Location QR Code", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test("can open QR code modal from locations page tree view", async ({
    page,
  }) => {
    await page.goto("/locations");

    // Wait for locations to load
    await expect(page.getByText("Workshop")).toBeVisible();

    // Find and click QR code button for first location
    const qrButton = page.getByTestId("qr-button-loc-1");
    await qrButton.click();

    // Modal should be visible
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("QR Code")).toBeVisible();
    await expect(page.getByTestId("qr-code-image")).toBeVisible();
  });

  test("QR code modal shows location name", async ({ page }) => {
    await page.goto("/locations");

    // Wait for locations to load
    await expect(page.getByText("Workshop")).toBeVisible();

    // Click QR button
    const qrButton = page.getByTestId("qr-button-loc-1");
    await qrButton.click();

    // Modal should show location name
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Workshop")).toBeVisible();
  });

  test("can close QR code modal", async ({ page }) => {
    await page.goto("/locations");

    await expect(page.getByText("Workshop")).toBeVisible();

    // Open modal
    const qrButton = page.getByTestId("qr-button-loc-1");
    await qrButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Close modal by clicking X button
    await page.getByRole("dialog").getByRole("button").first().click();

    // Modal should be closed
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("can select different QR code sizes", async ({ page }) => {
    await page.goto("/locations");

    await expect(page.getByText("Workshop")).toBeVisible();

    // Open modal
    await page.getByTestId("qr-button-loc-1").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Click on Large size
    await page.getByRole("dialog").getByText("Large").click();

    // The Large button should now be selected (has primary styling)
    const largeButton = page.getByRole("dialog").getByText("Large");
    await expect(largeButton).toBeVisible();
  });

  test("has download and print buttons", async ({ page }) => {
    await page.goto("/locations");

    await expect(page.getByText("Workshop")).toBeVisible();

    // Open modal
    await page.getByTestId("qr-button-loc-1").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Check for download and print buttons
    await expect(
      page.getByRole("dialog").getByRole("button", { name: /download/i })
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: /print/i })
    ).toBeVisible();
  });
});

test.describe("Location Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test("displays location information", async ({ page }) => {
    await page.goto("/locations/loc-1");

    // Should show location name
    await expect(
      page.getByRole("heading", { name: /workshop/i })
    ).toBeVisible();
  });

  test("shows breadcrumb navigation", async ({ page }) => {
    await page.goto("/locations/loc-1");

    // Should have breadcrumb with Locations link (use main to exclude sidebar)
    await expect(
      page.getByRole("main").getByRole("link", { name: "Locations" })
    ).toBeVisible();
  });

  test("shows child location with parent in breadcrumb", async ({ page }) => {
    await page.goto("/locations/loc-2");

    // Should show breadcrumb with parent (use main to exclude sidebar)
    await expect(
      page.getByRole("main").getByRole("link", { name: "Locations" })
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", { name: "Workshop" })
    ).toBeVisible();
    // Use heading role since "Shelf A" appears in both breadcrumb and h1
    await expect(page.getByRole("heading", { name: "Shelf A" })).toBeVisible();
  });

  test("has QR Code button", async ({ page }) => {
    await page.goto("/locations/loc-1");

    await expect(page.getByTestId("generate-qr-button")).toBeVisible();
  });

  test("can open QR modal from detail page", async ({ page }) => {
    await page.goto("/locations/loc-1");

    // Click QR Code button
    await page.getByTestId("generate-qr-button").click();

    // Modal should be visible
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("qr-code-image")).toBeVisible();
  });

  test("shows not found for invalid location", async ({ page }) => {
    await page.goto("/locations/invalid-id");

    // Wait for loading to finish and error state to appear
    await expect(page.getByText("Loading...")).not.toBeVisible({
      timeout: 10000,
    });

    // Should show not found message (uses h2 heading)
    await expect(
      page.getByRole("heading", { name: /location not found/i })
    ).toBeVisible();
    // Back button is a button, not a link
    await expect(
      page.getByRole("button", { name: /back to locations/i })
    ).toBeVisible();
  });

  test("has Edit and Add Item buttons", async ({ page }) => {
    await page.goto("/locations/loc-1");

    // Should have action buttons
    await expect(page.getByRole("link", { name: /edit/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /add item/i })).toBeVisible();
  });
});

test.describe("Navigation from Locations Page", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test("can navigate to location detail from tree view", async ({ page }) => {
    await page.goto("/locations");

    await expect(page.getByText("Workshop")).toBeVisible();

    // Click the view details link
    await page.getByRole("link", { name: /view details/i }).first().click();

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/locations\/loc-1/);
  });
});
