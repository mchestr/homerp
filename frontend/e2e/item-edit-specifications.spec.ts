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

      // Verify existing specifications are displayed
      await expect(page.getByTestId("specification-key-voltage")).toBeVisible();
      await expect(page.getByTestId("specification-key-voltage")).toHaveValue(
        "voltage"
      );
      await expect(page.getByTestId("specification-value-voltage")).toHaveValue(
        "5V"
      );

      await expect(
        page.getByTestId("specification-key-frequency")
      ).toBeVisible();
      await expect(page.getByTestId("specification-key-frequency")).toHaveValue(
        "frequency"
      );
      await expect(
        page.getByTestId("specification-value-frequency")
      ).toHaveValue("16MHz");

      await expect(page.getByTestId("specification-key-memory")).toBeVisible();
      await expect(page.getByTestId("specification-key-memory")).toHaveValue(
        "memory"
      );
      await expect(page.getByTestId("specification-value-memory")).toHaveValue(
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

      // Verify existing specification
      await expect(page.getByTestId("specification-key-voltage")).toBeVisible();

      // Add new specification
      await page.getByTestId("add-specification-button").click();

      // Find the newly added specification field (it will have a timestamp-based key)
      const newSpecFields = page.locator(
        '[data-testid^="specification-key-spec_"]'
      );
      await expect(newSpecFields).toHaveCount(1);

      const newSpecKey = await newSpecFields.getAttribute("data-testid");
      const specKeyName = newSpecKey!.replace("specification-key-", "");

      // Fill in the new specification key first
      await page
        .getByTestId(`specification-key-${specKeyName}`)
        .fill("current");

      // After changing the key, the data-testid updates to use the new key value
      // Wait for the value field with the new key to be visible
      await expect(
        page.getByTestId("specification-value-current")
      ).toBeVisible();
      await page.getByTestId("specification-value-current").fill("40mA");

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

      // Edit the key
      await page
        .getByTestId("specification-key-voltage")
        .fill("operating_voltage");

      // Edit the value
      await page
        .getByTestId("specification-value-operating_voltage")
        .fill("5.0V");

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
      await expect(page.getByTestId("specification-key-voltage")).toBeVisible();
      await expect(page.getByTestId("specification-key-current")).toBeVisible();
      await expect(
        page.getByTestId("specification-key-frequency")
      ).toBeVisible();

      // Remove the "current" specification
      await page.getByTestId("remove-specification-current").click();

      // Verify specification is removed from UI
      await expect(
        page.getByTestId("specification-key-current")
      ).not.toBeVisible();
      await expect(page.getByTestId("specification-key-voltage")).toBeVisible();
      await expect(
        page.getByTestId("specification-key-frequency")
      ).toBeVisible();

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
      const newSpecFields = page.locator(
        '[data-testid^="specification-key-spec_"]'
      );
      const newSpecKey = await newSpecFields.getAttribute("data-testid");
      const specKeyName = newSpecKey!.replace("specification-key-", "");

      await page
        .getByTestId(`specification-key-${specKeyName}`)
        .fill("frequency");
      await expect(
        page.getByTestId("specification-value-frequency")
      ).toBeVisible();
      await page.getByTestId("specification-value-frequency").fill("16MHz");

      // Save
      await page.getByRole("button", { name: /save changes/i }).click();
      await expect(page).toHaveURL("/items/item-with-specs");

      // Navigate back to edit page
      await page.goto("/items/item-with-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

      // Verify both specifications are present
      await expect(page.getByTestId("specification-key-voltage")).toBeVisible();
      await expect(page.getByTestId("specification-value-voltage")).toHaveValue(
        "5V"
      );
      await expect(
        page.getByTestId("specification-key-frequency")
      ).toBeVisible();
      await expect(
        page.getByTestId("specification-value-frequency")
      ).toHaveValue("16MHz");
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

      // Find the newly added specification field
      const newSpecFields = page.locator(
        '[data-testid^="specification-key-spec_"]'
      );
      await expect(newSpecFields).toHaveCount(1);

      const newSpecKey = await newSpecFields.getAttribute("data-testid");
      const specKeyName = newSpecKey!.replace("specification-key-", "");

      // Fill in the specification
      await page.getByTestId(`specification-key-${specKeyName}`).fill("color");
      await expect(page.getByTestId("specification-value-color")).toBeVisible();
      await page.getByTestId("specification-value-color").fill("RGB");

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
      const newSpecFields = page.locator(
        '[data-testid^="specification-key-spec_"]'
      );
      const newSpecKey = await newSpecFields.getAttribute("data-testid");
      const specKeyName = newSpecKey!.replace("specification-key-", "");

      await page.getByTestId(`specification-key-${specKeyName}`).fill("length");
      await expect(
        page.getByTestId("specification-value-length")
      ).toBeVisible();
      await page.getByTestId("specification-value-length").fill("5m");

      // Save
      await page.getByRole("button", { name: /save changes/i }).click();
      await expect(page).toHaveURL("/items/item-without-specs");

      // Navigate back to edit page
      await page.goto("/items/item-without-specs/edit");
      await expect(
        page.getByRole("heading", { name: /edit item/i })
      ).toBeVisible();

      // Verify specification persisted
      await expect(page.getByTestId("specification-key-length")).toBeVisible();
      await expect(page.getByTestId("specification-value-length")).toHaveValue(
        "5m"
      );
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
      const newSpecFields = page.locator(
        '[data-testid^="specification-key-spec_"]'
      );
      const newSpecKey = await newSpecFields.getAttribute("data-testid");
      const specKeyName = newSpecKey!.replace("specification-key-", "");

      await page.getByTestId(`specification-key-${specKeyName}`).fill("color");
      await expect(page.getByTestId("specification-value-color")).toBeVisible();
      await page.getByTestId("specification-value-color").fill("red");

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
      const integerFields = page
        .locator('[data-testid^="specification-key-spec_"]')
        .first();
      const integerKey = await integerFields.getAttribute("data-testid");
      const integerKeyName = integerKey!.replace("specification-key-", "");

      await page
        .getByTestId(`specification-key-${integerKeyName}`)
        .fill("quantity");
      await expect(
        page.getByTestId("specification-value-quantity")
      ).toBeVisible();
      await page.getByTestId("specification-value-quantity").fill("100");

      await page.getByTestId("add-specification-button").click();
      const decimalFields = page
        .locator('[data-testid^="specification-key-spec_"]')
        .last();
      const decimalKey = await decimalFields.getAttribute("data-testid");
      const decimalKeyName = decimalKey!.replace("specification-key-", "");

      await page
        .getByTestId(`specification-key-${decimalKeyName}`)
        .fill("voltage");
      await expect(
        page.getByTestId("specification-value-voltage")
      ).toBeVisible();
      await page.getByTestId("specification-value-voltage").fill("5.5");

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
      const trueFields = page
        .locator('[data-testid^="specification-key-spec_"]')
        .first();
      const trueKey = await trueFields.getAttribute("data-testid");
      const trueKeyName = trueKey!.replace("specification-key-", "");

      await page
        .getByTestId(`specification-key-${trueKeyName}`)
        .fill("waterproof");
      await expect(
        page.getByTestId("specification-value-waterproof")
      ).toBeVisible();
      await page.getByTestId("specification-value-waterproof").fill("true");

      await page.getByTestId("add-specification-button").click();
      const falseFields = page
        .locator('[data-testid^="specification-key-spec_"]')
        .last();
      const falseKey = await falseFields.getAttribute("data-testid");
      const falseKeyName = falseKey!.replace("specification-key-", "");

      await page
        .getByTestId(`specification-key-${falseKeyName}`)
        .fill("rechargeable");
      await expect(
        page.getByTestId("specification-value-rechargeable")
      ).toBeVisible();
      await page.getByTestId("specification-value-rechargeable").fill("false");

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

      // Verify values are displayed correctly
      await expect(
        page.getByTestId("specification-value-waterproof")
      ).toHaveValue("true");
      await expect(page.getByTestId("specification-value-voltage")).toHaveValue(
        "5.5"
      );
      await expect(page.getByTestId("specification-value-count")).toHaveValue(
        "100"
      );
      await expect(page.getByTestId("specification-value-active")).toHaveValue(
        "false"
      );
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

      // 1. Remove one specification
      await page.getByTestId("remove-specification-current").click();
      await expect(
        page.getByTestId("specification-key-current")
      ).not.toBeVisible();

      // 2. Edit one specification
      await page.getByTestId("specification-value-voltage").fill("3.3V");

      // 3. Add a new specification
      await page.getByTestId("add-specification-button").click();
      const newSpecFields = page.locator(
        '[data-testid^="specification-key-spec_"]'
      );
      const newSpecKey = await newSpecFields.getAttribute("data-testid");
      const specKeyName = newSpecKey!.replace("specification-key-", "");

      await page.getByTestId(`specification-key-${specKeyName}`).fill("memory");
      await expect(
        page.getByTestId("specification-value-memory")
      ).toBeVisible();
      await page.getByTestId("specification-value-memory").fill("32KB");

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
      const newSpecFields = page.locator(
        '[data-testid^="specification-key-spec_"]'
      );
      const newSpecKey = await newSpecFields.getAttribute("data-testid");
      const specKeyName = newSpecKey!.replace("specification-key-", "");

      await page.getByTestId(`specification-key-${specKeyName}`).fill("test");
      await expect(page.getByTestId("specification-value-test")).toBeVisible();
      await page.getByTestId("specification-value-test").fill("value");

      // Click cancel
      await page.getByRole("button", { name: /cancel/i }).click();

      // Verify navigated to item detail without saving
      await expect(page).toHaveURL("/items/item-cancel");
      expect(updateCalled).toBe(false);
    });
  });
});
