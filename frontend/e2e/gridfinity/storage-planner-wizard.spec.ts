import { test, expect, authenticateUser } from "../fixtures/test-setup";

test.describe("Storage Planner Create", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test("opens create dialog from Storage Planner page", async ({ page }) => {
    await page.goto("/gridfinity");

    // Verify the create button is visible
    const createButton = page.getByTestId("open-wizard-button");
    await expect(createButton).toBeVisible();

    // Click the create button
    await createButton.click();

    // Verify create dialog is open
    await expect(page.getByTestId("storage-planner-wizard")).toBeVisible();
  });

  test("navigates through wizard steps", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Step 1: Type Selection should be visible
    await expect(page.getByTestId("step-type-selection")).toBeVisible();

    // Select Gridfinity
    await page.getByTestId("storage-type-gridfinity").click();

    // Next button should be enabled after selection
    const nextButton = page.getByTestId("wizard-next-button");
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Step 2: Configuration should be visible
    await expect(page.getByTestId("step-configuration")).toBeVisible();
    await expect(page.getByTestId("step-type-selection")).not.toBeVisible();

    // Back button should navigate to previous step
    const backButton = page.getByTestId("wizard-back-button");
    await backButton.click();
    await expect(page.getByTestId("step-type-selection")).toBeVisible();

    // Navigate forward again
    await page.getByTestId("wizard-next-button").click();
    await expect(page.getByTestId("step-configuration")).toBeVisible();
  });

  test("selects Gridfinity storage type and shows appropriate fields", async ({
    page,
  }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Select Gridfinity type
    const gridfinityButton = page.getByTestId("storage-type-gridfinity");
    await expect(gridfinityButton).toBeVisible();
    await gridfinityButton.click();

    // Verify it's selected (should have different styling)
    await expect(gridfinityButton).toHaveClass(/border-primary/);

    // Proceed to configuration
    await page.getByTestId("wizard-next-button").click();

    // Verify Gridfinity-specific fields are visible
    await expect(page.getByTestId("gridfinity-name-input")).toBeVisible();
    await expect(
      page.getByTestId("gridfinity-description-input")
    ).toBeVisible();
    await expect(page.getByTestId("gridfinity-width-input")).toBeVisible();
    await expect(page.getByTestId("gridfinity-depth-input")).toBeVisible();
    await expect(page.getByTestId("gridfinity-height-input")).toBeVisible();
  });

  test("configures Gridfinity unit with valid data", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Select Gridfinity
    await page.getByTestId("storage-type-gridfinity").click();
    await page.getByTestId("wizard-next-button").click();

    // Fill in configuration data
    await page
      .getByTestId("gridfinity-name-input")
      .fill("Test Workshop Drawer");
    await page
      .getByTestId("gridfinity-description-input")
      .fill("A test drawer for organizing tools");
    await page.getByTestId("gridfinity-width-input").fill("252");
    await page.getByTestId("gridfinity-depth-input").fill("252");
    await page.getByTestId("gridfinity-height-input").fill("50");

    // Next button should be enabled with valid name
    await expect(page.getByTestId("wizard-next-button")).toBeEnabled();
    await page.getByTestId("wizard-next-button").click();

    // Step 3: Review should be visible
    await expect(page.getByTestId("step-review")).toBeVisible();
  });

  test("requires name field in Gridfinity configuration", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Select Gridfinity
    await page.getByTestId("storage-type-gridfinity").click();
    await page.getByTestId("wizard-next-button").click();

    // Without filling name, next button should be disabled
    await expect(page.getByTestId("wizard-next-button")).toBeDisabled();

    // Fill in name
    await page.getByTestId("gridfinity-name-input").fill("Test Unit");

    // Now next button should be enabled
    await expect(page.getByTestId("wizard-next-button")).toBeEnabled();
  });

  test("completes wizard and creates Gridfinity unit", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Step 1: Select Gridfinity
    await page.getByTestId("storage-type-gridfinity").click();
    await page.getByTestId("wizard-next-button").click();

    // Step 2: Configure
    await page.getByTestId("gridfinity-name-input").fill("My New Drawer");
    await page
      .getByTestId("gridfinity-description-input")
      .fill("Testing the wizard");
    await page.getByTestId("gridfinity-width-input").fill("336");
    await page.getByTestId("gridfinity-depth-input").fill("252");
    await page.getByTestId("gridfinity-height-input").fill("42");
    await page.getByTestId("wizard-next-button").click();

    // Step 3: Review - verify the data is displayed
    await expect(page.getByTestId("step-review")).toBeVisible();
    await expect(page.getByText("My New Drawer")).toBeVisible();
    await expect(page.getByText("Testing the wizard")).toBeVisible();
    await expect(page.getByText("336 x 252 x 42 mm")).toBeVisible();

    // Wait for the API call when creating
    const responsePromise = page.waitForResponse("**/api/v1/gridfinity/units");

    // Click create button
    const createButton = page.getByTestId("wizard-create-button");
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Wait for the POST request to complete
    await responsePromise;

    // Wizard should close and navigate to the new unit
    // Note: The wizard navigates to /gridfinity/[id] after successful creation
    await page.waitForURL(/\/gridfinity\/gf-unit-\d+/);
  });

  test("disables multiboard type selection (coming soon)", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Multiboard type should be visible but disabled
    const multiboardButton = page.getByTestId("storage-type-multiboard");
    await expect(multiboardButton).toBeVisible();
    await expect(multiboardButton).toBeDisabled();

    // Should show coming soon badge
    await expect(multiboardButton.getByText("Coming Soon")).toBeVisible();

    // Should have reduced opacity
    await expect(multiboardButton).toHaveClass(/opacity-60/);
  });

  test("disables tote-rack type selection (coming soon)", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Tote Rack type should be visible but disabled
    const toteRackButton = page.getByTestId("storage-type-toteRack");
    await expect(toteRackButton).toBeVisible();
    await expect(toteRackButton).toBeDisabled();

    // Should show coming soon badge
    await expect(toteRackButton.getByText("Coming Soon")).toBeVisible();

    // Should have reduced opacity
    await expect(toteRackButton).toHaveClass(/opacity-60/);
  });

  test("cancels wizard from first step", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Wizard should be open
    await expect(page.getByTestId("storage-planner-wizard")).toBeVisible();

    // On first step, back button should say "Cancel"
    const backButton = page.getByTestId("wizard-back-button");
    await expect(backButton).toBeVisible();

    // Click cancel/back button
    await backButton.click();

    // Wizard should close (dialog should not be visible)
    await expect(page.getByTestId("storage-planner-wizard")).not.toBeVisible();
  });

  test("cancels wizard from configuration step", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Select type and proceed
    await page.getByTestId("storage-type-gridfinity").click();
    await page.getByTestId("wizard-next-button").click();

    // Fill some data
    await page.getByTestId("gridfinity-name-input").fill("Test");
    await page.getByTestId("gridfinity-description-input").fill("Test desc");

    // Go back to type selection
    await page.getByTestId("wizard-back-button").click();
    await expect(page.getByTestId("step-type-selection")).toBeVisible();

    // Cancel from first step
    await page.getByTestId("wizard-back-button").click();
    await expect(page.getByTestId("storage-planner-wizard")).not.toBeVisible();
  });

  test("displays grid preview in configuration step", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Select Gridfinity and proceed to configuration
    await page.getByTestId("storage-type-gridfinity").click();
    await page.getByTestId("wizard-next-button").click();

    // Fill in name so we can see the preview
    await page.getByTestId("gridfinity-name-input").fill("Test");

    // Default dimensions (252x252) should show 6x6 grid
    await expect(
      page.getByTestId("step-configuration").getByText("6 x 6", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByTestId("step-configuration").getByText(/36.*cells/i)
    ).toBeVisible();

    // Change dimensions to get different grid size
    await page.getByTestId("gridfinity-width-input").fill("168");
    await page.getByTestId("gridfinity-depth-input").fill("126");

    // Should update to 4x3 grid (168/42 = 4, 126/42 = 3)
    await expect(
      page.getByTestId("step-configuration").getByText("4 x 3", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByTestId("step-configuration").getByText(/12.*cells/i)
    ).toBeVisible();
  });

  test("preserves form data when navigating back and forward", async ({
    page,
  }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Select Gridfinity
    await page.getByTestId("storage-type-gridfinity").click();
    await page.getByTestId("wizard-next-button").click();

    // Fill in configuration
    await page.getByTestId("gridfinity-name-input").fill("Preserved Name");
    await page
      .getByTestId("gridfinity-description-input")
      .fill("Preserved Description");
    await page.getByTestId("gridfinity-width-input").fill("420");

    // Navigate to review
    await page.getByTestId("wizard-next-button").click();
    await expect(page.getByTestId("step-review")).toBeVisible();

    // Navigate back to configuration
    await page.getByTestId("wizard-back-button").click();

    // Verify form data is still there
    await expect(page.getByTestId("gridfinity-name-input")).toHaveValue(
      "Preserved Name"
    );
    await expect(page.getByTestId("gridfinity-description-input")).toHaveValue(
      "Preserved Description"
    );
    await expect(page.getByTestId("gridfinity-width-input")).toHaveValue("420");

    // Navigate back to type selection
    await page.getByTestId("wizard-back-button").click();

    // Gridfinity should still be selected
    await expect(page.getByTestId("storage-type-gridfinity")).toHaveClass(
      /border-primary/
    );
  });

  test("shows progress indicator throughout wizard", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Step 1 - check progress text and bar
    await expect(page.getByText(/Step 1.*3/)).toBeVisible();

    // Select type and proceed
    await page.getByTestId("storage-type-gridfinity").click();
    await page.getByTestId("wizard-next-button").click();

    // Step 2 - progress should update
    await expect(page.getByText(/Step 2.*3/)).toBeVisible();

    // Fill name and proceed
    await page.getByTestId("gridfinity-name-input").fill("Test");
    await page.getByTestId("wizard-next-button").click();

    // Step 3 - progress should show final step
    await expect(page.getByText(/Step 3.*3/)).toBeVisible();
  });

  test("disables next button when no storage type selected", async ({
    page,
  }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Next button should be disabled when no type is selected
    await expect(page.getByTestId("wizard-next-button")).toBeDisabled();

    // Select a type
    await page.getByTestId("storage-type-gridfinity").click();

    // Next button should now be enabled
    await expect(page.getByTestId("wizard-next-button")).toBeEnabled();
  });

  test("displays all three storage type options", async ({ page }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // All three types should be visible
    await expect(page.getByTestId("storage-type-gridfinity")).toBeVisible();
    await expect(page.getByTestId("storage-type-multiboard")).toBeVisible();
    await expect(page.getByTestId("storage-type-toteRack")).toBeVisible();

    // Only Gridfinity should be enabled (not have coming soon badge)
    const gridfinityButton = page.getByTestId("storage-type-gridfinity");
    await expect(gridfinityButton.getByText("Coming Soon")).not.toBeVisible();
    await expect(gridfinityButton).toBeEnabled();

    // Multiboard and Tote Rack should be disabled
    await expect(page.getByTestId("storage-type-multiboard")).toBeDisabled();
    await expect(page.getByTestId("storage-type-toteRack")).toBeDisabled();
  });

  test("allows clearing dimension inputs to enter new values", async ({
    page,
  }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Select Gridfinity and proceed to configuration
    await page.getByTestId("storage-type-gridfinity").click();
    await page.getByTestId("wizard-next-button").click();

    // Fill in name
    await page.getByTestId("gridfinity-name-input").fill("Test");

    // Get the width input
    const widthInput = page.getByTestId("gridfinity-width-input");

    // Initial value should be 252 (default)
    await expect(widthInput).toHaveValue("252");

    // Clear the input completely - this should work without resetting to default
    await widthInput.fill("");

    // Input should show empty string (not reset to 42)
    await expect(widthInput).toHaveValue("");

    // Now type a new value
    await widthInput.fill("168");

    // Verify the new value is set
    await expect(widthInput).toHaveValue("168");

    // Test depth input similarly
    const depthInput = page.getByTestId("gridfinity-depth-input");
    await expect(depthInput).toHaveValue("252");

    // Clear and type new value
    await depthInput.fill("");
    await expect(depthInput).toHaveValue("");
    await depthInput.fill("126");
    await expect(depthInput).toHaveValue("126");

    // Test height input
    const heightInput = page.getByTestId("gridfinity-height-input");
    await expect(heightInput).toHaveValue("50");

    // Clear and type new value
    await heightInput.fill("");
    await expect(heightInput).toHaveValue("");
    await heightInput.fill("42");
    await expect(heightInput).toHaveValue("42");

    // Verify grid preview updates correctly
    await expect(
      page.getByTestId("step-configuration").getByText("4 x 3", { exact: true })
    ).toBeVisible();
  });

  test("restores minimum value on blur when dimension input is empty", async ({
    page,
  }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Select Gridfinity and proceed to configuration
    await page.getByTestId("storage-type-gridfinity").click();
    await page.getByTestId("wizard-next-button").click();

    // Fill in name
    await page.getByTestId("gridfinity-name-input").fill("Test");

    // Get the width input and clear it
    const widthInput = page.getByTestId("gridfinity-width-input");
    await widthInput.fill("");

    // Click elsewhere to blur the input
    await page.getByTestId("gridfinity-name-input").click();

    // Width should now have the minimum value (42)
    await expect(widthInput).toHaveValue("42");

    // Test with height (minimum is 7)
    const heightInput = page.getByTestId("gridfinity-height-input");
    await heightInput.fill("");
    await page.getByTestId("gridfinity-name-input").click();
    await expect(heightInput).toHaveValue("7");
  });

  test("restores minimum value on blur when dimension input is below minimum", async ({
    page,
  }) => {
    await page.goto("/gridfinity");
    await page.getByTestId("open-wizard-button").click();

    // Select Gridfinity and proceed to configuration
    await page.getByTestId("storage-type-gridfinity").click();
    await page.getByTestId("wizard-next-button").click();

    // Fill in name
    await page.getByTestId("gridfinity-name-input").fill("Test");

    // Test width below minimum (42) - enter 10
    const widthInput = page.getByTestId("gridfinity-width-input");
    await widthInput.fill("10");
    await page.getByTestId("gridfinity-name-input").click();
    await expect(widthInput).toHaveValue("42");

    // Test height below minimum (7) - enter 3
    const heightInput = page.getByTestId("gridfinity-height-input");
    await heightInput.fill("3");
    await page.getByTestId("gridfinity-name-input").click();
    await expect(heightInput).toHaveValue("7");
  });
});
