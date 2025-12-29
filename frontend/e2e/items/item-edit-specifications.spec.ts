import { http, HttpResponse } from "msw";
import { test, expect, authenticateUser } from "../fixtures/test-setup";
import { testItemDetail } from "../fixtures/factories";

test.describe("Item Edit - Specifications", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test.describe("Editing item with existing specifications", () => {
    test("displays existing specifications in edit form", async ({
      page,
      network,
    }) => {
      // Mock item with specifications
      const itemWithSpecs = {
        ...testItemDetail,
        id: "item-with-specs",
        name: "Arduino Uno",
        attributes: {
          specifications: [
            { key: "voltage", value: "5V" },
            { key: "frequency", value: "16MHz" },
            { key: "memory", value: "32KB" },
          ],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-with-specs", () => {
          return HttpResponse.json(itemWithSpecs);
        })
      );

      await page.goto("/items/item-with-specs");

      // Wait for page to load and enter edit mode
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify existing specifications are displayed (using index-based selectors)
      await expect(page.getByTestId("specification-key-0")).toBeVisible();
      await expect(page.getByTestId("specification-key-0")).toHaveValue(
        "voltage"
      );
      await expect(page.getByTestId("specification-value-0")).toHaveValue("5V");

      await expect(page.getByTestId("specification-key-1")).toBeVisible();
      await expect(page.getByTestId("specification-key-1")).toHaveValue(
        "frequency"
      );
      await expect(page.getByTestId("specification-value-1")).toHaveValue(
        "16MHz"
      );

      await expect(page.getByTestId("specification-key-2")).toBeVisible();
      await expect(page.getByTestId("specification-key-2")).toHaveValue(
        "memory"
      );
      await expect(page.getByTestId("specification-value-2")).toHaveValue(
        "32KB"
      );
    });

    test("can add a new specification to existing ones", async ({
      page,
      network,
    }) => {
      const itemWithSpecs = {
        ...testItemDetail,
        id: "item-with-specs",
        name: "Arduino Uno",
        attributes: {
          specifications: [{ key: "voltage", value: "5V" }],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-with-specs", () => {
          return HttpResponse.json(itemWithSpecs);
        }),
        http.put("**/api/v1/items/item-with-specs", async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            ...itemWithSpecs,
            ...(body as object),
          });
        })
      );

      await page.goto("/items/item-with-specs");
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify existing specification (index 0)
      await expect(page.getByTestId("specification-key-0")).toBeVisible();

      // Add new specification
      await page.getByTestId("add-specification-button").click();

      // The new field will be at index 1
      await expect(page.getByTestId("specification-key-1")).toBeVisible();

      // Fill in the new specification
      await page.getByTestId("specification-key-1").fill("current");
      await page.getByTestId("specification-value-1").fill("40mA");

      // Save changes
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-with-specs"
      );
      await page.getByTestId("save-button").click();
      const response = await responsePromise;

      // Verify request body contains both old and new specifications
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications).toEqual(
        expect.arrayContaining([
          { key: "voltage", value: "5V" },
          { key: "current", value: "40mA" },
        ])
      );

      // Verify navigation to item detail page
      await expect(page).toHaveURL("/items/item-with-specs");
    });

    test("can edit an existing specification key and value", async ({
      page,
      network,
    }) => {
      const itemWithSpecs = {
        ...testItemDetail,
        id: "item-with-specs",
        name: "Arduino Uno",
        attributes: {
          specifications: [{ key: "voltage", value: "5V" }],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-with-specs", () => {
          return HttpResponse.json(itemWithSpecs);
        }),
        http.put("**/api/v1/items/item-with-specs", async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            ...itemWithSpecs,
            ...(body as object),
          });
        })
      );

      await page.goto("/items/item-with-specs");
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Edit the key (at index 0)
      await page.getByTestId("specification-key-0").fill("operating_voltage");

      // Edit the value (at index 0)
      await page.getByTestId("specification-value-0").fill("5.0V");

      // Save changes
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-with-specs"
      );
      await page.getByTestId("save-button").click();
      const response = await responsePromise;

      // Verify request body contains updated specification
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications).toEqual([
        { key: "operating_voltage", value: "5.0V" },
      ]);

      await expect(page).toHaveURL("/items/item-with-specs");
    });

    test("can remove a specification", async ({ page, network }) => {
      const itemWithSpecs = {
        ...testItemDetail,
        id: "item-with-specs",
        name: "Arduino Uno",
        attributes: {
          specifications: [
            { key: "voltage", value: "5V" },
            { key: "current", value: "40mA" },
            { key: "frequency", value: "16MHz" },
          ],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-with-specs", () => {
          return HttpResponse.json(itemWithSpecs);
        }),
        http.put("**/api/v1/items/item-with-specs", async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            ...itemWithSpecs,
            ...(body as object),
          });
        })
      );

      await page.goto("/items/item-with-specs");
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify all specifications are present
      await expect(page.getByTestId("specification-key-0")).toBeVisible();
      await expect(page.getByTestId("specification-key-1")).toBeVisible();
      await expect(page.getByTestId("specification-key-2")).toBeVisible();

      // Remove the "current" specification (index 1)
      await page.getByTestId("remove-specification-1").click();

      // Verify only 2 specifications remain
      await expect(page.getByTestId("specification-key-0")).toBeVisible();
      await expect(page.getByTestId("specification-key-1")).toBeVisible();
      await expect(page.getByTestId("specification-key-2")).not.toBeVisible();

      // Save changes
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-with-specs"
      );
      await page.getByTestId("save-button").click();
      const response = await responsePromise;

      // Verify request body does not contain removed specification
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications).toEqual([
        { key: "voltage", value: "5V" },
        { key: "frequency", value: "16MHz" },
      ]);
      expect(
        requestBody.attributes.specifications.find(
          (spec: { key: string }) => spec.key === "current"
        )
      ).toBeUndefined();

      await expect(page).toHaveURL("/items/item-with-specs");
    });

    test("specifications persist after save", async ({ page, network }) => {
      const itemWithSpecs = {
        ...testItemDetail,
        id: "item-with-specs",
        name: "Arduino Uno",
        attributes: {
          specifications: [{ key: "voltage", value: "5V" }],
        },
      };

      let savedSpecs = [{ key: "voltage", value: "5V" }];

      network.use(
        http.get("**/api/v1/items/item-with-specs", () => {
          return HttpResponse.json({
            ...itemWithSpecs,
            attributes: {
              specifications: savedSpecs,
            },
          });
        }),
        http.put("**/api/v1/items/item-with-specs", async ({ request }) => {
          const body = (await request.json()) as {
            attributes: { specifications: { key: string; value: string }[] };
          };
          savedSpecs = body.attributes.specifications;
          return HttpResponse.json({
            ...itemWithSpecs,
            ...body,
          });
        })
      );

      await page.goto("/items/item-with-specs");
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Add a new specification
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-1")).toBeVisible();

      await page.getByTestId("specification-key-1").fill("frequency");
      await page.getByTestId("specification-value-1").fill("16MHz");

      // Save
      await page.getByTestId("save-button").click();
      await expect(page).toHaveURL("/items/item-with-specs");

      // Navigate back to item page and enter edit mode
      await page.goto("/items/item-with-specs");
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify both specifications are present
      await expect(page.getByTestId("specification-key-0")).toBeVisible();
      await expect(page.getByTestId("specification-value-0")).toHaveValue("5V");
      await expect(page.getByTestId("specification-key-1")).toBeVisible();
      await expect(page.getByTestId("specification-value-1")).toHaveValue(
        "16MHz"
      );
    });
  });

  test.describe("Reordering specifications with drag and drop", () => {
    test("can drag specification to a different position", async ({
      page,
      network,
    }) => {
      const itemWithSpecs = {
        ...testItemDetail,
        id: "item-reorder",
        name: "Test Item",
        attributes: {
          specifications: [
            { key: "voltage", value: "5V" },
            { key: "current", value: "40mA" },
            { key: "frequency", value: "16MHz" },
          ],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-reorder", () => {
          return HttpResponse.json(itemWithSpecs);
        }),
        http.put("**/api/v1/items/item-reorder", async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            ...itemWithSpecs,
            ...(body as object),
          });
        })
      );

      await page.goto("/items/item-reorder");
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify initial order: voltage, current, frequency
      await expect(page.getByTestId("specification-key-0")).toHaveValue(
        "voltage"
      );
      await expect(page.getByTestId("specification-key-1")).toHaveValue(
        "current"
      );
      await expect(page.getByTestId("specification-key-2")).toHaveValue(
        "frequency"
      );

      // Drag "current" (index 1) to the top (index 0)
      const sourceRow = page.getByTestId("specification-row-1");
      const targetRow = page.getByTestId("specification-row-0");

      await sourceRow.dragTo(targetRow);

      // Verify new order: current, voltage, frequency
      await expect(page.getByTestId("specification-key-0")).toHaveValue(
        "current"
      );
      await expect(page.getByTestId("specification-key-1")).toHaveValue(
        "voltage"
      );
      await expect(page.getByTestId("specification-key-2")).toHaveValue(
        "frequency"
      );
    });

    test("can drag specification down", async ({ page, network }) => {
      const itemWithSpecs = {
        ...testItemDetail,
        id: "item-reorder",
        name: "Test Item",
        attributes: {
          specifications: [
            { key: "voltage", value: "5V" },
            { key: "current", value: "40mA" },
            { key: "frequency", value: "16MHz" },
          ],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-reorder", () => {
          return HttpResponse.json(itemWithSpecs);
        }),
        http.put("**/api/v1/items/item-reorder", async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            ...itemWithSpecs,
            ...(body as object),
          });
        })
      );

      await page.goto("/items/item-reorder");
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify initial order: voltage, current, frequency
      await expect(page.getByTestId("specification-key-0")).toHaveValue(
        "voltage"
      );
      await expect(page.getByTestId("specification-key-1")).toHaveValue(
        "current"
      );
      await expect(page.getByTestId("specification-key-2")).toHaveValue(
        "frequency"
      );

      // Drag "voltage" (index 0) to the bottom (index 2)
      const sourceRow = page.getByTestId("specification-row-0");
      const targetRow = page.getByTestId("specification-row-2");

      await sourceRow.dragTo(targetRow);

      // Verify new order: current, frequency, voltage
      await expect(page.getByTestId("specification-key-0")).toHaveValue(
        "current"
      );
      await expect(page.getByTestId("specification-key-1")).toHaveValue(
        "frequency"
      );
      await expect(page.getByTestId("specification-key-2")).toHaveValue(
        "voltage"
      );
    });

    test("displays drag handle on each specification row", async ({
      page,
      network,
    }) => {
      const itemWithSpecs = {
        ...testItemDetail,
        id: "item-reorder",
        name: "Test Item",
        attributes: {
          specifications: [
            { key: "voltage", value: "5V" },
            { key: "current", value: "40mA" },
          ],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-reorder", () => {
          return HttpResponse.json(itemWithSpecs);
        })
      );

      await page.goto("/items/item-reorder");
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify drag handles are visible
      await expect(page.getByTestId("drag-handle-0")).toBeVisible();
      await expect(page.getByTestId("drag-handle-1")).toBeVisible();
    });

    test("reordering persists after save", async ({ page, network }) => {
      const itemWithSpecs = {
        ...testItemDetail,
        id: "item-reorder",
        name: "Test Item",
        attributes: {
          specifications: [
            { key: "voltage", value: "5V" },
            { key: "current", value: "40mA" },
            { key: "frequency", value: "16MHz" },
          ],
        },
      };

      let savedSpecs = [
        { key: "voltage", value: "5V" },
        { key: "current", value: "40mA" },
        { key: "frequency", value: "16MHz" },
      ];

      network.use(
        http.get("**/api/v1/items/item-reorder", () => {
          return HttpResponse.json({
            ...itemWithSpecs,
            attributes: {
              specifications: savedSpecs,
            },
          });
        }),
        http.put("**/api/v1/items/item-reorder", async ({ request }) => {
          const body = (await request.json()) as {
            attributes: { specifications: { key: string; value: string }[] };
          };
          savedSpecs = body.attributes.specifications;
          return HttpResponse.json({
            ...itemWithSpecs,
            ...body,
          });
        })
      );

      await page.goto("/items/item-reorder");
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Drag "current" to the top
      const sourceRow = page.getByTestId("specification-row-1");
      const targetRow = page.getByTestId("specification-row-0");
      await sourceRow.dragTo(targetRow);

      // Verify new order in UI
      await expect(page.getByTestId("specification-key-0")).toHaveValue(
        "current"
      );
      await expect(page.getByTestId("specification-key-1")).toHaveValue(
        "voltage"
      );

      // Save
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-reorder"
      );
      await page.getByTestId("save-button").click();
      const response = await responsePromise;

      // Verify the order in the saved data (array order)
      const requestBody = response.request().postDataJSON();
      const specs = requestBody.attributes.specifications;
      expect(specs[0]).toEqual({ key: "current", value: "40mA" });
      expect(specs[1]).toEqual({ key: "voltage", value: "5V" });
      expect(specs[2]).toEqual({ key: "frequency", value: "16MHz" });

      await expect(page).toHaveURL("/items/item-reorder");

      // Navigate back to item page and enter edit mode to verify order persisted
      await page.goto("/items/item-reorder");
      await expect(
        page.getByRole("heading", { name: itemWithSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      await expect(page.getByTestId("specification-key-0")).toHaveValue(
        "current"
      );
      await expect(page.getByTestId("specification-key-1")).toHaveValue(
        "voltage"
      );
      await expect(page.getByTestId("specification-key-2")).toHaveValue(
        "frequency"
      );
    });
  });

  test.describe("Editing item without specifications", () => {
    test("displays empty state when no specifications exist", async ({
      page,
      network,
    }) => {
      const itemWithoutSpecs = {
        ...testItemDetail,
        id: "item-without-specs",
        name: "LED Strip",
        attributes: {},
      };

      network.use(
        http.get("**/api/v1/items/item-without-specs", () => {
          return HttpResponse.json(itemWithoutSpecs);
        })
      );

      await page.goto("/items/item-without-specs");
      await expect(
        page.getByRole("heading", { name: itemWithoutSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify empty state is shown (no specification fields visible)
      const specFields = page.locator('[data-testid^="specification-key-"]');
      await expect(specFields).toHaveCount(0);

      // Verify add button is visible
      await expect(page.getByTestId("add-specification-button")).toBeVisible();
    });

    test("can add first specification to item without specifications", async ({
      page,
      network,
    }) => {
      const itemWithoutSpecs = {
        ...testItemDetail,
        id: "item-without-specs",
        name: "LED Strip",
        attributes: {},
      };

      network.use(
        http.get("**/api/v1/items/item-without-specs", () => {
          return HttpResponse.json(itemWithoutSpecs);
        }),
        http.put("**/api/v1/items/item-without-specs", async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            ...itemWithoutSpecs,
            ...(body as object),
          });
        })
      );

      await page.goto("/items/item-without-specs");
      await expect(
        page.getByRole("heading", { name: itemWithoutSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Add first specification
      await page.getByTestId("add-specification-button").click();

      // The new field will be at index 0
      await expect(page.getByTestId("specification-key-0")).toBeVisible();

      // Fill in the specification
      await page.getByTestId("specification-key-0").fill("color");
      await page.getByTestId("specification-value-0").fill("RGB");

      // Save changes
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-without-specs"
      );
      await page.getByTestId("save-button").click();
      const response = await responsePromise;

      // Verify request body contains the new specification
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications).toEqual([
        { key: "color", value: "RGB" },
      ]);

      await expect(page).toHaveURL("/items/item-without-specs");
    });

    test("first specification persists after save", async ({
      page,
      network,
    }) => {
      const itemWithoutSpecs = {
        ...testItemDetail,
        id: "item-without-specs",
        name: "LED Strip",
        attributes: {},
      };

      let savedSpecs: Array<{ key: string; value: unknown }> = [];

      network.use(
        http.get("**/api/v1/items/item-without-specs", () => {
          return HttpResponse.json({
            ...itemWithoutSpecs,
            attributes: {
              specifications: savedSpecs,
            },
          });
        }),
        http.put("**/api/v1/items/item-without-specs", async ({ request }) => {
          const body = (await request.json()) as {
            attributes: {
              specifications: Array<{ key: string; value: unknown }>;
            };
          };
          savedSpecs = body.attributes.specifications;
          return HttpResponse.json({
            ...itemWithoutSpecs,
            ...body,
          });
        })
      );

      await page.goto("/items/item-without-specs");
      await expect(
        page.getByRole("heading", { name: itemWithoutSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Add first specification
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-0")).toBeVisible();

      await page.getByTestId("specification-key-0").fill("length");
      await page.getByTestId("specification-value-0").fill("5m");

      // Save
      await page.getByTestId("save-button").click();
      await expect(page).toHaveURL("/items/item-without-specs");

      // Navigate back to item page and enter edit mode
      await page.goto("/items/item-without-specs");
      await expect(
        page.getByRole("heading", { name: itemWithoutSpecs.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify specification persisted
      await expect(page.getByTestId("specification-key-0")).toBeVisible();
      await expect(page.getByTestId("specification-value-0")).toHaveValue("5m");
    });
  });

  test.describe("Data type parsing", () => {
    test("stores text values as strings", async ({ page, network }) => {
      const item = {
        ...testItemDetail,
        id: "item-datatypes",
        name: "Test Item",
        attributes: {},
      };

      network.use(
        http.get("**/api/v1/items/item-datatypes", () => {
          return HttpResponse.json(item);
        }),
        http.put("**/api/v1/items/item-datatypes", async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            ...item,
            ...(body as object),
          });
        })
      );

      await page.goto("/items/item-datatypes");
      await expect(
        page.getByRole("heading", { name: item.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Add text specification
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-0")).toBeVisible();

      await page.getByTestId("specification-key-0").fill("color");
      await page.getByTestId("specification-value-0").fill("red");

      // Save
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-datatypes"
      );
      await page.getByTestId("save-button").click();
      const response = await responsePromise;

      // Verify value is stored as string
      const requestBody = response.request().postDataJSON();
      const colorSpec = requestBody.attributes.specifications.find(
        (spec: { key: string }) => spec.key === "color"
      );
      expect(colorSpec.value).toBe("red");
      expect(typeof colorSpec.value).toBe("string");

      await expect(page).toHaveURL("/items/item-datatypes");
    });

    test("stores numeric values as numbers", async ({ page, network }) => {
      const item = {
        ...testItemDetail,
        id: "item-datatypes",
        name: "Test Item",
        attributes: {},
      };

      network.use(
        http.get("**/api/v1/items/item-datatypes", () => {
          return HttpResponse.json(item);
        }),
        http.put("**/api/v1/items/item-datatypes", async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            ...item,
            ...(body as object),
          });
        })
      );

      await page.goto("/items/item-datatypes");
      await expect(
        page.getByRole("heading", { name: item.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Add numeric specifications (integer and decimal)
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-0")).toBeVisible();

      await page.getByTestId("specification-key-0").fill("quantity");
      await page.getByTestId("specification-value-0").fill("100");

      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-1")).toBeVisible();

      await page.getByTestId("specification-key-1").fill("voltage");
      await page.getByTestId("specification-value-1").fill("5.5");

      // Save
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-datatypes"
      );
      await page.getByTestId("save-button").click();
      const response = await responsePromise;

      // Verify values are stored as numbers
      const requestBody = response.request().postDataJSON();
      const quantitySpec = requestBody.attributes.specifications.find(
        (spec: { key: string }) => spec.key === "quantity"
      );
      const voltageSpec = requestBody.attributes.specifications.find(
        (spec: { key: string }) => spec.key === "voltage"
      );
      expect(quantitySpec.value).toBe(100);
      expect(typeof quantitySpec.value).toBe("number");
      expect(voltageSpec.value).toBe(5.5);
      expect(typeof voltageSpec.value).toBe("number");

      await expect(page).toHaveURL("/items/item-datatypes");
    });

    test("stores boolean values as booleans", async ({ page, network }) => {
      const item = {
        ...testItemDetail,
        id: "item-datatypes",
        name: "Test Item",
        attributes: {},
      };

      network.use(
        http.get("**/api/v1/items/item-datatypes", () => {
          return HttpResponse.json(item);
        }),
        http.put("**/api/v1/items/item-datatypes", async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            ...item,
            ...(body as object),
          });
        })
      );

      await page.goto("/items/item-datatypes");
      await expect(
        page.getByRole("heading", { name: item.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Add boolean specifications
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-0")).toBeVisible();

      await page.getByTestId("specification-key-0").fill("waterproof");
      await page.getByTestId("specification-value-0").fill("true");

      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-1")).toBeVisible();

      await page.getByTestId("specification-key-1").fill("rechargeable");
      await page.getByTestId("specification-value-1").fill("false");

      // Save
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-datatypes"
      );
      await page.getByTestId("save-button").click();
      const response = await responsePromise;

      // Verify values are stored as booleans
      const requestBody = response.request().postDataJSON();
      const waterproofSpec = requestBody.attributes.specifications.find(
        (spec: { key: string }) => spec.key === "waterproof"
      );
      const rechargeableSpec = requestBody.attributes.specifications.find(
        (spec: { key: string }) => spec.key === "rechargeable"
      );
      expect(waterproofSpec.value).toBe(true);
      expect(typeof waterproofSpec.value).toBe("boolean");
      expect(rechargeableSpec.value).toBe(false);
      expect(typeof rechargeableSpec.value).toBe("boolean");

      await expect(page).toHaveURL("/items/item-datatypes");
    });

    test("displays boolean and numeric values correctly when loading", async ({
      page,
      network,
    }) => {
      const item = {
        ...testItemDetail,
        id: "item-datatypes",
        name: "Test Item",
        attributes: {
          specifications: [
            { key: "waterproof", value: true },
            { key: "voltage", value: 5.5 },
            { key: "count", value: 100 },
            { key: "active", value: false },
          ],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-datatypes", () => {
          return HttpResponse.json(item);
        })
      );

      await page.goto("/items/item-datatypes");
      await expect(
        page.getByRole("heading", { name: item.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify values are displayed correctly (using index-based selectors)
      await expect(page.getByTestId("specification-value-0")).toHaveValue(
        "true"
      );
      await expect(page.getByTestId("specification-value-1")).toHaveValue(
        "5.5"
      );
      await expect(page.getByTestId("specification-value-2")).toHaveValue(
        "100"
      );
      await expect(page.getByTestId("specification-value-3")).toHaveValue(
        "false"
      );
    });
  });

  test.describe("Duplicate key validation", () => {
    test("shows error for duplicate keys (case-insensitive)", async ({
      page,
      network,
    }) => {
      const item = {
        ...testItemDetail,
        id: "item-duplicate-keys",
        name: "Test Item",
        attributes: {
          specifications: [{ key: "voltage", value: "5V" }],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-duplicate-keys", () => {
          return HttpResponse.json(item);
        })
      );

      await page.goto("/items/item-duplicate-keys");
      await expect(
        page.getByRole("heading", { name: item.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Verify initial spec exists
      await expect(page.getByTestId("specification-key-0")).toHaveValue(
        "voltage"
      );

      // Add a new specification with duplicate key
      await page.getByTestId("add-specification-button").click();

      // Wait for the new row to appear with a visible and enabled input
      const newKeyInput = page.getByTestId("specification-key-1");
      await expect(newKeyInput).toBeVisible();
      await expect(newKeyInput).toBeEditable();

      // Clear the auto-generated key and set to "VOLTAGE" (case-insensitive match)
      await newKeyInput.clear();
      await newKeyInput.fill("VOLTAGE");

      // Verify both fields show error styling
      await expect(page.getByTestId("specification-key-0")).toHaveClass(
        /border-destructive/
      );
      await expect(page.getByTestId("specification-key-1")).toHaveClass(
        /border-destructive/
      );

      // Verify error message appears for both
      await expect(page.getByTestId("duplicate-key-error-0")).toBeVisible();
      await expect(page.getByTestId("duplicate-key-error-1")).toBeVisible();
    });

    test("error disappears when key is made unique", async ({
      page,
      network,
    }) => {
      const item = {
        ...testItemDetail,
        id: "item-duplicate-keys",
        name: "Test Item",
        attributes: {
          specifications: [
            { key: "voltage", value: "5V" },
            { key: "Voltage", value: "3.3V" }, // Duplicate key (case-insensitive)
          ],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-duplicate-keys", () => {
          return HttpResponse.json(item);
        })
      );

      await page.goto("/items/item-duplicate-keys");
      await expect(
        page.getByRole("heading", { name: item.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Wait for specs to load - should have 2 with duplicate keys
      await expect(
        page.locator('[data-testid^="specification-key-"]')
      ).toHaveCount(2);

      // Verify error is shown for duplicates
      await expect(page.getByTestId("duplicate-key-error-0")).toBeVisible();
      await expect(page.getByTestId("duplicate-key-error-1")).toBeVisible();

      // Change one key to make it unique
      const key1Input = page.getByTestId("specification-key-1");
      await key1Input.clear();
      await key1Input.fill("current");

      // Wait for error to disappear
      await expect(page.getByTestId("duplicate-key-error-0")).not.toBeVisible();
      await expect(page.getByTestId("duplicate-key-error-1")).not.toBeVisible();

      // Verify inputs no longer have error styling
      await expect(page.getByTestId("specification-key-0")).not.toHaveClass(
        /border-destructive/
      );
      await expect(page.getByTestId("specification-key-1")).not.toHaveClass(
        /border-destructive/
      );
    });

    test("multiple duplicates are all highlighted", async ({
      page,
      network,
    }) => {
      const item = {
        ...testItemDetail,
        id: "item-duplicate-keys",
        name: "Test Item",
        attributes: {
          specifications: [
            { key: "voltage", value: "5V" },
            { key: "Voltage", value: "3.3V" },
            { key: "VOLTAGE", value: "12V" }, // Three case-insensitive duplicates
          ],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-duplicate-keys", () => {
          return HttpResponse.json(item);
        })
      );

      await page.goto("/items/item-duplicate-keys");
      await expect(
        page.getByRole("heading", { name: item.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Wait for all specs to load
      await expect(
        page.locator('[data-testid^="specification-key-"]')
      ).toHaveCount(3);

      // Verify all three have error styling
      await expect(page.getByTestId("specification-key-0")).toHaveClass(
        /border-destructive/
      );
      await expect(page.getByTestId("specification-key-1")).toHaveClass(
        /border-destructive/
      );
      await expect(page.getByTestId("specification-key-2")).toHaveClass(
        /border-destructive/
      );

      // Verify all three have error messages
      await expect(page.getByTestId("duplicate-key-error-0")).toBeVisible();
      await expect(page.getByTestId("duplicate-key-error-1")).toBeVisible();
      await expect(page.getByTestId("duplicate-key-error-2")).toBeVisible();
    });

    test("whitespace-only keys do not trigger duplicate error", async ({
      page,
      network,
    }) => {
      const item = {
        ...testItemDetail,
        id: "item-duplicate-keys",
        name: "Test Item",
        attributes: {},
      };

      network.use(
        http.get("**/api/v1/items/item-duplicate-keys", () => {
          return HttpResponse.json(item);
        })
      );

      await page.goto("/items/item-duplicate-keys");
      await expect(
        page.getByRole("heading", { name: item.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Add two specifications
      await page.getByTestId("add-specification-button").click();
      await page.getByTestId("add-specification-button").click();

      // Set both to whitespace
      await page.getByTestId("specification-key-0").fill("   ");
      await page.getByTestId("specification-key-1").fill("  ");

      // Verify no error messages for whitespace-only keys
      await expect(page.getByTestId("duplicate-key-error-0")).not.toBeVisible();
      await expect(page.getByTestId("duplicate-key-error-1")).not.toBeVisible();
    });
  });

  test.describe("Multiple operations in one edit", () => {
    test("can add, edit, and remove specifications in a single save", async ({
      page,
      network,
    }) => {
      const item = {
        ...testItemDetail,
        id: "item-multi-ops",
        name: "Multi-Op Test",
        attributes: {
          specifications: [
            { key: "voltage", value: "5V" },
            { key: "current", value: "40mA" },
            { key: "frequency", value: "16MHz" },
          ],
        },
      };

      network.use(
        http.get("**/api/v1/items/item-multi-ops", () => {
          return HttpResponse.json(item);
        }),
        http.put("**/api/v1/items/item-multi-ops", async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            ...item,
            ...(body as object),
          });
        })
      );

      await page.goto("/items/item-multi-ops");
      await expect(
        page.getByRole("heading", { name: item.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // 1. Remove one specification (index 1 - "current")
      await page.getByTestId("remove-specification-1").click();
      // Now we only have 2 items
      await expect(page.getByTestId("specification-key-2")).not.toBeVisible();

      // 2. Edit one specification (index 0 - "voltage")
      await page.getByTestId("specification-value-0").fill("3.3V");

      // 3. Add a new specification
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-2")).toBeVisible();

      await page.getByTestId("specification-key-2").fill("memory");
      await page.getByTestId("specification-value-2").fill("32KB");

      // Save
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-multi-ops"
      );
      await page.getByTestId("save-button").click();
      const response = await responsePromise;

      // Verify all changes in request body
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications).toEqual([
        { key: "voltage", value: "3.3V" }, // edited
        { key: "frequency", value: "16MHz" }, // unchanged
        { key: "memory", value: "32KB" }, // added
      ]);
      // Verify current was removed
      expect(
        requestBody.attributes.specifications.find(
          (spec: { key: string }) => spec.key === "current"
        )
      ).toBeUndefined();

      await expect(page).toHaveURL("/items/item-multi-ops");
    });
  });

  test.describe("Cancel and navigation", () => {
    test("cancel button navigates back to item detail without saving", async ({
      page,
      network,
    }) => {
      const item = {
        ...testItemDetail,
        id: "item-cancel",
        name: "Cancel Test",
        attributes: {
          specifications: [{ key: "voltage", value: "5V" }],
        },
      };

      let updateCalled = false;

      network.use(
        http.get("**/api/v1/items/item-cancel", () => {
          return HttpResponse.json(item);
        }),
        http.put("**/api/v1/items/item-cancel", () => {
          updateCalled = true;
          return HttpResponse.json(item);
        })
      );

      await page.goto("/items/item-cancel");
      await expect(
        page.getByRole("heading", { name: item.name })
      ).toBeVisible();
      await page.getByTestId("edit-button").click();

      // Make changes
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-1")).toBeVisible();

      await page.getByTestId("specification-key-1").fill("test");
      await page.getByTestId("specification-value-1").fill("value");

      // Click cancel
      await page.getByTestId("cancel-button").click();

      // Verify navigated to item detail without saving
      await expect(page).toHaveURL("/items/item-cancel");
      expect(updateCalled).toBe(false);
    });
  });
});
