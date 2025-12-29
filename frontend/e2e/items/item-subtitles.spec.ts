import { http, HttpResponse } from "msw";
import { test, expect, authenticateUser } from "../fixtures/test-setup";
import { testItems, testCategories, testLocations } from "../fixtures/factories";

test.describe("Item Subtitles", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test.describe("Grid View", () => {
    test("displays subtitle when item has specifications", async ({ page }) => {
      await page.goto("/items");

      // Verify grid view is active
      await expect(page.getByTestId("items-grid-view")).toBeVisible();

      // Item with specifications and attribute template should show subtitle
      const resistorCard = page.getByTestId("item-card-item-2");
      await expect(resistorCard).toBeVisible();

      // Verify subtitle is displayed with attributes following template order
      const resistorSubtitle = resistorCard.getByTestId("item-subtitle");
      await expect(resistorSubtitle).toBeVisible();
      await expect(resistorSubtitle).toHaveText("5V, SMD");
    });

    test("displays subtitle with different attribute template", async ({
      page,
    }) => {
      await page.goto("/items");

      // PLA Filament has a different category with different attribute template
      const filamentCard = page.getByTestId("item-card-item-4");
      await expect(filamentCard).toBeVisible();

      // Verify subtitle follows the filament category's template order (type, color, diameter)
      const filamentSubtitle = filamentCard.getByTestId("item-subtitle");
      await expect(filamentSubtitle).toBeVisible();
      await expect(filamentSubtitle).toHaveText("PLA, Blue");
    });

    test("does not display subtitle when item has no specifications", async ({
      page,
    }) => {
      await page.goto("/items");

      // Arduino Uno has no specifications
      const arduinoCard = page.getByTestId("item-card-item-1");
      await expect(arduinoCard).toBeVisible();

      // Verify no subtitle is displayed
      const subtitle = arduinoCard.getByTestId("item-subtitle");
      await expect(subtitle).not.toBeVisible();
    });

    test("respects maxAttributes limit", async ({ page }) => {
      await page.goto("/items");

      // Verify that only 2 attributes are shown (maxAttributes=2 in grid view)
      const resistorCard = page.getByTestId("item-card-item-2");
      const resistorSubtitle = resistorCard.getByTestId("item-subtitle");
      await expect(resistorSubtitle).toBeVisible();

      // Should show "voltage, package" (first 2 attributes from template)
      const subtitleText = await resistorSubtitle.textContent();
      expect(subtitleText).toBe("5V, SMD");

      // Count commas to verify only 2 attributes (1 comma between them)
      const commaCount = (subtitleText?.match(/,/g) || []).length;
      expect(commaCount).toBe(1);
    });
  });

  test.describe("List View", () => {
    test("displays subtitle when item has specifications", async ({ page }) => {
      await page.goto("/items");

      // Switch to list view
      await page.getByTestId("view-mode-list").click();
      await expect(page.getByTestId("items-list-view")).toBeVisible();

      // Item with specifications should show subtitle
      const resistorRow = page.getByTestId("item-row-item-2");
      await expect(resistorRow).toBeVisible();

      // Verify subtitle is displayed
      const resistorSubtitle = resistorRow.getByTestId("item-subtitle");
      await expect(resistorSubtitle).toBeVisible();
      await expect(resistorSubtitle).toHaveText("5V, SMD");
    });

    test("displays subtitle with attribute template order", async ({
      page,
    }) => {
      await page.goto("/items");

      // Switch to list view
      await page.getByTestId("view-mode-list").click();

      // PLA Filament should follow its template order
      const filamentRow = page.getByTestId("item-row-item-4");
      const filamentSubtitle = filamentRow.getByTestId("item-subtitle");
      await expect(filamentSubtitle).toBeVisible();
      await expect(filamentSubtitle).toHaveText("PLA, Blue");
    });

    test("does not display subtitle when item has no specifications", async ({
      page,
    }) => {
      await page.goto("/items");

      // Switch to list view
      await page.getByTestId("view-mode-list").click();

      // Arduino Uno has no specifications
      const arduinoRow = page.getByTestId("item-row-item-1");
      await expect(arduinoRow).toBeVisible();

      // Verify no subtitle is displayed
      const subtitle = arduinoRow.getByTestId("item-subtitle");
      await expect(subtitle).not.toBeVisible();
    });

    test("subtitle works in selection mode", async ({ page }) => {
      await page.goto("/items");

      // Switch to list view
      await page.getByTestId("view-mode-list").click();

      // Enter selection mode
      await page.getByTestId("enter-selection-mode").click();

      // Verify subtitle is still visible in selection mode
      const resistorRow = page.getByTestId("item-row-item-2");
      const resistorSubtitle = resistorRow.getByTestId("item-subtitle");
      await expect(resistorSubtitle).toBeVisible();
      await expect(resistorSubtitle).toHaveText("5V, SMD");
    });
  });

  test.describe("View Mode Persistence", () => {
    test("subtitles remain visible after switching between views", async ({
      page,
    }) => {
      await page.goto("/items");

      // Verify subtitle in grid view
      const gridCard = page.getByTestId("item-card-item-2");
      await expect(gridCard.getByTestId("item-subtitle")).toBeVisible();
      await expect(gridCard.getByTestId("item-subtitle")).toHaveText("5V, SMD");

      // Switch to list view
      await page.getByTestId("view-mode-list").click();
      await expect(page.getByTestId("items-list-view")).toBeVisible();

      // Verify subtitle in list view
      const listRow = page.getByTestId("item-row-item-2");
      await expect(listRow.getByTestId("item-subtitle")).toBeVisible();
      await expect(listRow.getByTestId("item-subtitle")).toHaveText("5V, SMD");

      // Switch back to grid view
      await page.getByTestId("view-mode-grid").click();
      await expect(page.getByTestId("items-grid-view")).toBeVisible();

      // Verify subtitle still present
      await expect(gridCard.getByTestId("item-subtitle")).toBeVisible();
      await expect(gridCard.getByTestId("item-subtitle")).toHaveText("5V, SMD");
    });
  });

  test.describe("Items Panel", () => {
    test("displays subtitle in items panel when category is selected", async ({
      page,
      network,
    }) => {
      // Mock items panel endpoint with category filter
      network.use(
        http.get("**/api/v1/items", ({ request }) => {
          const url = new URL(request.url);
          const categoryId = url.searchParams.get("category_id");

          // Filter items by category
          let filteredItems = testItems;
          if (categoryId) {
            filteredItems = testItems.filter(
              (item) => item.category?.id === categoryId
            );
          }

          return HttpResponse.json({
            items: filteredItems,
            total: filteredItems.length,
            page: 1,
            limit: 8,
            total_pages: 1,
          });
        })
      );

      // Navigate to categories page which has an items panel
      await page.goto("/categories");

      // Wait for page to load
      await expect(
        page.getByRole("heading", { name: /categories/i })
      ).toBeVisible();

      // Click on Components category to show items in panel
      const componentsCategory = page.getByText("Components");
      if (await componentsCategory.isVisible()) {
        await componentsCategory.click();

        // Wait for items panel to load and subtitle to appear
        const panelSubtitle = page.getByTestId("item-subtitle").first();
        await expect(panelSubtitle).toBeVisible({ timeout: 2000 });
        await expect(panelSubtitle).toContainText(/V|SMD|THT/);
      }
    });
  });

  test.describe("Mobile Viewport", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("displays subtitles correctly on mobile", async ({ page }) => {
      await page.goto("/items");

      // Verify grid view on mobile
      await expect(page.getByTestId("items-grid-view")).toBeVisible();

      // Check subtitle is visible and truncates correctly on mobile
      const resistorCard = page.getByTestId("item-card-item-2");
      const subtitle = resistorCard.getByTestId("item-subtitle");
      await expect(subtitle).toBeVisible();
      await expect(subtitle).toHaveText("5V, SMD");

      // Verify truncation is applied
      await expect(subtitle).toHaveCSS("text-overflow", "ellipsis");
    });

    test("subtitle works in list view on mobile", async ({ page }) => {
      await page.goto("/items");

      // Switch to list view
      await page.getByTestId("view-mode-list").click();
      await expect(page.getByTestId("items-list-view")).toBeVisible();

      // Verify subtitle is visible on mobile
      const resistorRow = page.getByTestId("item-row-item-2");
      const subtitle = resistorRow.getByTestId("item-subtitle");
      await expect(subtitle).toBeVisible();
      await expect(subtitle).toHaveText("5V, SMD");
    });
  });

  test.describe("Edge Cases", () => {
    test("handles items with partial specifications", async ({
      page,
      network,
    }) => {
      // Add a mock route with an item that has only one specification
      network.use(
        http.get("**/api/v1/items", () => {
          const partialSpecItem = {
            id: "item-partial",
            name: "Partial Specs Item",
            quantity: 1,
            quantity_unit: "pcs",
            is_low_stock: false,
            tags: [],
            category: testCategories[1],
            location: testLocations[0],
            primary_image_url: null,
            attributes: {
              specifications: [{ key: "voltage", value: "3.3V" }],
            },
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          };

          return HttpResponse.json({
            items: [partialSpecItem, ...testItems],
            total: testItems.length + 1,
            page: 1,
            limit: 20,
            total_pages: 1,
          });
        })
      );

      await page.goto("/items");

      // Verify subtitle shows only available attributes
      const partialCard = page.getByTestId("item-card-item-partial");
      if (await partialCard.isVisible()) {
        const subtitle = partialCard.getByTestId("item-subtitle");
        await expect(subtitle).toBeVisible();
        await expect(subtitle).toHaveText("3.3V");
      }
    });

    test("handles category without attribute template", async ({ page }) => {
      await page.goto("/items");

      // Arduino (item-1) has no attribute template in its category
      const arduinoCard = page.getByTestId("item-card-item-1");
      await expect(arduinoCard).toBeVisible();

      // Should not show subtitle since it has no specifications
      const subtitle = arduinoCard.getByTestId("item-subtitle");
      await expect(subtitle).not.toBeVisible();
    });

    test("handles empty specifications object", async ({ page }) => {
      await page.goto("/items");

      // Arduino has empty attributes object
      const arduinoCard = page.getByTestId("item-card-item-1");
      const subtitle = arduinoCard.getByTestId("item-subtitle");
      await expect(subtitle).not.toBeVisible();
    });
  });
});
