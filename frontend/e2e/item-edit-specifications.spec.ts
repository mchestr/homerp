import { test, expect } from "@playwright/test";
import { setupApiMocks, authenticateUser } from "./mocks/api-handlers";
import * as fixtures from "./fixtures/test-data";

test.describe("Item Edit - Specifications", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await setupApiMocks(page);
  });

  test.describe("Editing item with existing specifications", () => {
    test("displays existing specifications in edit form", async ({ page }) => {
      // Mock item with specifications
      const itemWithSpecs = {
        ...fixtures.testItemDetail,
        id: "item-with-specs",
        name: "Arduino Uno",
        attributes: {
          specifications: {
            voltage: "5V",
            frequency: "16MHz",
            memory: "32KB",
          },
        },
      };

      await page.route("**/api/v1/items/item-with-specs", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemWithSpecs),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-with-specs/edit");

      // Wait for page to load
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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

    test("can add a new specification to existing ones", async ({ page }) => {
      const itemWithSpecs = {
        ...fixtures.testItemDetail,
        id: "item-with-specs",
        name: "Arduino Uno",
        attributes: {
          specifications: {
            voltage: "5V",
          },
        },
      };

      await page.route("**/api/v1/items/item-with-specs", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemWithSpecs),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithSpecs,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-with-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
      await page.getByRole("button", { name: /save changes/i }).click();
      const response = await responsePromise;

      // Verify request body contains both old and new specifications
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications).toHaveProperty("voltage");
      expect(requestBody.attributes.specifications).toHaveProperty(
        "current",
        "40mA"
      );

      // Verify navigation to item detail page
      await expect(page).toHaveURL("/items/item-with-specs");
    });

    test("can edit an existing specification key and value", async ({
      page,
    }) => {
      const itemWithSpecs = {
        ...fixtures.testItemDetail,
        id: "item-with-specs",
        name: "Arduino Uno",
        attributes: {
          specifications: {
            voltage: "5V",
          },
        },
      };

      await page.route("**/api/v1/items/item-with-specs", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemWithSpecs),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithSpecs,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-with-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

      // Edit the key (at index 0)
      await page.getByTestId("specification-key-0").fill("operating_voltage");

      // Edit the value (at index 0)
      await page.getByTestId("specification-value-0").fill("5.0V");

      // Save changes
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-with-specs"
      );
      await page.getByRole("button", { name: /save changes/i }).click();
      const response = await responsePromise;

      // Verify request body contains updated specification
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications).toHaveProperty(
        "operating_voltage",
        "5.0V"
      );
      expect(requestBody.attributes.specifications).not.toHaveProperty(
        "voltage"
      );

      await expect(page).toHaveURL("/items/item-with-specs");
    });

    test("can remove a specification", async ({ page }) => {
      const itemWithSpecs = {
        ...fixtures.testItemDetail,
        id: "item-with-specs",
        name: "Arduino Uno",
        attributes: {
          specifications: {
            voltage: "5V",
            current: "40mA",
            frequency: "16MHz",
          },
        },
      };

      await page.route("**/api/v1/items/item-with-specs", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemWithSpecs),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithSpecs,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-with-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
      await page.getByRole("button", { name: /save changes/i }).click();
      const response = await responsePromise;

      // Verify request body does not contain removed specification
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications).toHaveProperty(
        "voltage",
        "5V"
      );
      expect(requestBody.attributes.specifications).toHaveProperty(
        "frequency",
        "16MHz"
      );
      expect(requestBody.attributes.specifications).not.toHaveProperty(
        "current"
      );

      await expect(page).toHaveURL("/items/item-with-specs");
    });

    test("specifications persist after save", async ({ page }) => {
      const itemWithSpecs = {
        ...fixtures.testItemDetail,
        id: "item-with-specs",
        name: "Arduino Uno",
        attributes: {
          specifications: {
            voltage: "5V",
          },
        },
      };

      let savedSpecs = { voltage: "5V" };

      await page.route("**/api/v1/items/item-with-specs", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithSpecs,
              attributes: {
                specifications: savedSpecs,
              },
            }),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          savedSpecs = body.attributes.specifications;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithSpecs,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-with-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

      // Add a new specification
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-1")).toBeVisible();

      await page.getByTestId("specification-key-1").fill("frequency");
      await page.getByTestId("specification-value-1").fill("16MHz");

      // Save
      await page.getByRole("button", { name: /save changes/i }).click();
      await expect(page).toHaveURL("/items/item-with-specs");

      // Navigate back to edit page
      await page.goto("/items/item-with-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
    test("can drag specification to a different position", async ({ page }) => {
      const itemWithSpecs = {
        ...fixtures.testItemDetail,
        id: "item-reorder",
        name: "Test Item",
        attributes: {
          specifications: {
            voltage: "5V",
            current: "40mA",
            frequency: "16MHz",
          },
        },
      };

      await page.route("**/api/v1/items/item-reorder", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemWithSpecs),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithSpecs,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-reorder/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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

    test("can drag specification down", async ({ page }) => {
      const itemWithSpecs = {
        ...fixtures.testItemDetail,
        id: "item-reorder",
        name: "Test Item",
        attributes: {
          specifications: {
            voltage: "5V",
            current: "40mA",
            frequency: "16MHz",
          },
        },
      };

      await page.route("**/api/v1/items/item-reorder", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemWithSpecs),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithSpecs,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-reorder/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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

    test("displays drag handle on each specification row", async ({ page }) => {
      const itemWithSpecs = {
        ...fixtures.testItemDetail,
        id: "item-reorder",
        name: "Test Item",
        attributes: {
          specifications: {
            voltage: "5V",
            current: "40mA",
          },
        },
      };

      await page.route("**/api/v1/items/item-reorder", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemWithSpecs),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-reorder/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

      // Verify drag handles are visible
      await expect(page.getByTestId("drag-handle-0")).toBeVisible();
      await expect(page.getByTestId("drag-handle-1")).toBeVisible();
    });

    test("reordering persists after save", async ({ page }) => {
      const itemWithSpecs = {
        ...fixtures.testItemDetail,
        id: "item-reorder",
        name: "Test Item",
        attributes: {
          specifications: {
            voltage: "5V",
            current: "40mA",
            frequency: "16MHz",
          },
        },
      };

      let savedSpecs = {
        voltage: "5V",
        current: "40mA",
        frequency: "16MHz",
      };

      await page.route("**/api/v1/items/item-reorder", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithSpecs,
              attributes: {
                specifications: savedSpecs,
              },
            }),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          savedSpecs = body.attributes.specifications;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithSpecs,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-reorder/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
      await page.getByRole("button", { name: /save changes/i }).click();
      const response = await responsePromise;

      // Verify the order in the saved data
      const requestBody = response.request().postDataJSON();
      const specKeys = Object.keys(requestBody.attributes.specifications);
      expect(specKeys[0]).toBe("current");
      expect(specKeys[1]).toBe("voltage");
      expect(specKeys[2]).toBe("frequency");

      await expect(page).toHaveURL("/items/item-reorder");

      // Navigate back and verify order persisted
      await page.goto("/items/item-reorder/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
    }) => {
      const itemWithoutSpecs = {
        ...fixtures.testItemDetail,
        id: "item-without-specs",
        name: "LED Strip",
        attributes: {},
      };

      await page.route("**/api/v1/items/item-without-specs", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemWithoutSpecs),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-without-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

      // Verify empty state is shown (no specification fields visible)
      const specFields = page.locator('[data-testid^="specification-key-"]');
      await expect(specFields).toHaveCount(0);

      // Verify add button is visible
      await expect(page.getByTestId("add-specification-button")).toBeVisible();
    });

    test("can add first specification to item without specifications", async ({
      page,
    }) => {
      const itemWithoutSpecs = {
        ...fixtures.testItemDetail,
        id: "item-without-specs",
        name: "LED Strip",
        attributes: {},
      };

      await page.route("**/api/v1/items/item-without-specs", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemWithoutSpecs),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithoutSpecs,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-without-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
      await page.getByRole("button", { name: /save changes/i }).click();
      const response = await responsePromise;

      // Verify request body contains the new specification
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications).toEqual({ color: "RGB" });

      await expect(page).toHaveURL("/items/item-without-specs");
    });

    test("first specification persists after save", async ({ page }) => {
      const itemWithoutSpecs = {
        ...fixtures.testItemDetail,
        id: "item-without-specs",
        name: "LED Strip",
        attributes: {},
      };

      let savedSpecs = {};

      await page.route("**/api/v1/items/item-without-specs", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithoutSpecs,
              attributes: {
                specifications: savedSpecs,
              },
            }),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          savedSpecs = body.attributes.specifications;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...itemWithoutSpecs,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-without-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

      // Add first specification
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-0")).toBeVisible();

      await page.getByTestId("specification-key-0").fill("length");
      await page.getByTestId("specification-value-0").fill("5m");

      // Save
      await page.getByRole("button", { name: /save changes/i }).click();
      await expect(page).toHaveURL("/items/item-without-specs");

      // Navigate back to edit page
      await page.goto("/items/item-without-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

      // Verify specification persisted
      await expect(page.getByTestId("specification-key-0")).toBeVisible();
      await expect(page.getByTestId("specification-value-0")).toHaveValue("5m");
    });
  });

  test.describe("Data type parsing", () => {
    test("stores text values as strings", async ({ page }) => {
      const item = {
        ...fixtures.testItemDetail,
        id: "item-datatypes",
        name: "Test Item",
        attributes: {},
      };

      await page.route("**/api/v1/items/item-datatypes", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...item,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-datatypes/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

      // Add text specification
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-0")).toBeVisible();

      await page.getByTestId("specification-key-0").fill("color");
      await page.getByTestId("specification-value-0").fill("red");

      // Save
      const responsePromise = page.waitForResponse(
        "**/api/v1/items/item-datatypes"
      );
      await page.getByRole("button", { name: /save changes/i }).click();
      const response = await responsePromise;

      // Verify value is stored as string
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications.color).toBe("red");
      expect(typeof requestBody.attributes.specifications.color).toBe("string");

      await expect(page).toHaveURL("/items/item-datatypes");
    });

    test("stores numeric values as numbers", async ({ page }) => {
      const item = {
        ...fixtures.testItemDetail,
        id: "item-datatypes",
        name: "Test Item",
        attributes: {},
      };

      await page.route("**/api/v1/items/item-datatypes", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...item,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-datatypes/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
      await page.getByRole("button", { name: /save changes/i }).click();
      const response = await responsePromise;

      // Verify values are stored as numbers
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications.quantity).toBe(100);
      expect(typeof requestBody.attributes.specifications.quantity).toBe(
        "number"
      );
      expect(requestBody.attributes.specifications.voltage).toBe(5.5);
      expect(typeof requestBody.attributes.specifications.voltage).toBe(
        "number"
      );

      await expect(page).toHaveURL("/items/item-datatypes");
    });

    test("stores boolean values as booleans", async ({ page }) => {
      const item = {
        ...fixtures.testItemDetail,
        id: "item-datatypes",
        name: "Test Item",
        attributes: {},
      };

      await page.route("**/api/v1/items/item-datatypes", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...item,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-datatypes/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
      await page.getByRole("button", { name: /save changes/i }).click();
      const response = await responsePromise;

      // Verify values are stored as booleans
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications.waterproof).toBe(true);
      expect(typeof requestBody.attributes.specifications.waterproof).toBe(
        "boolean"
      );
      expect(requestBody.attributes.specifications.rechargeable).toBe(false);
      expect(typeof requestBody.attributes.specifications.rechargeable).toBe(
        "boolean"
      );

      await expect(page).toHaveURL("/items/item-datatypes");
    });

    test("displays boolean and numeric values correctly when loading", async ({
      page,
    }) => {
      const item = {
        ...fixtures.testItemDetail,
        id: "item-datatypes",
        name: "Test Item",
        attributes: {
          specifications: {
            waterproof: true,
            voltage: 5.5,
            count: 100,
            active: false,
          },
        },
      };

      await page.route("**/api/v1/items/item-datatypes", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-datatypes/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
    }) => {
      const item = {
        ...fixtures.testItemDetail,
        id: "item-duplicate-keys",
        name: "Test Item",
        attributes: {
          specifications: {
            voltage: "5V",
          },
        },
      };

      await page.route("**/api/v1/items/item-duplicate-keys", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-duplicate-keys/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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

    test("error disappears when key is made unique", async ({ page }) => {
      const item = {
        ...fixtures.testItemDetail,
        id: "item-duplicate-keys",
        name: "Test Item",
        attributes: {
          specifications: {
            voltage: "5V",
            Voltage: "3.3V", // Duplicate key (case-insensitive)
          },
        },
      };

      await page.route("**/api/v1/items/item-duplicate-keys", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-duplicate-keys/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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

    test("multiple duplicates are all highlighted", async ({ page }) => {
      const item = {
        ...fixtures.testItemDetail,
        id: "item-duplicate-keys",
        name: "Test Item",
        attributes: {
          specifications: {
            voltage: "5V",
            Voltage: "3.3V",
            VOLTAGE: "12V", // Three case-insensitive duplicates
          },
        },
      };

      await page.route("**/api/v1/items/item-duplicate-keys", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-duplicate-keys/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
    }) => {
      const item = {
        ...fixtures.testItemDetail,
        id: "item-duplicate-keys",
        name: "Test Item",
        attributes: {},
      };

      await page.route("**/api/v1/items/item-duplicate-keys", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-duplicate-keys/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
    }) => {
      const item = {
        ...fixtures.testItemDetail,
        id: "item-multi-ops",
        name: "Multi-Op Test",
        attributes: {
          specifications: {
            voltage: "5V",
            current: "40mA",
            frequency: "16MHz",
          },
        },
      };

      await page.route("**/api/v1/items/item-multi-ops", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...item,
              ...body,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-multi-ops/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

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
      await page.getByRole("button", { name: /save changes/i }).click();
      const response = await responsePromise;

      // Verify all changes in request body
      const requestBody = response.request().postDataJSON();
      expect(requestBody.attributes.specifications).toEqual({
        voltage: "3.3V", // edited
        frequency: "16MHz", // unchanged
        memory: "32KB", // added
        // current removed
      });
      expect(requestBody.attributes.specifications).not.toHaveProperty(
        "current"
      );

      await expect(page).toHaveURL("/items/item-multi-ops");
    });
  });

  test.describe("Cancel and navigation", () => {
    test("cancel button navigates back to item detail without saving", async ({
      page,
    }) => {
      const item = {
        ...fixtures.testItemDetail,
        id: "item-cancel",
        name: "Cancel Test",
        attributes: {
          specifications: {
            voltage: "5V",
          },
        },
      };

      let updateCalled = false;

      await page.route("**/api/v1/items/item-cancel", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else if (route.request().method() === "PUT") {
          updateCalled = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/items/item-cancel/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

      // Make changes
      await page.getByTestId("add-specification-button").click();
      await expect(page.getByTestId("specification-key-1")).toBeVisible();

      await page.getByTestId("specification-key-1").fill("test");
      await page.getByTestId("specification-value-1").fill("value");

      // Click cancel
      await page.getByRole("button", { name: /cancel/i }).click();

      // Verify navigated to item detail without saving
      await expect(page).toHaveURL("/items/item-cancel");
      expect(updateCalled).toBe(false);
    });
  });
});
