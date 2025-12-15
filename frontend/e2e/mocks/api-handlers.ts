import { Page } from "@playwright/test";
import * as fixtures from "../fixtures/test-data";

/**
 * API mock handlers for e2e tests.
 * Intercepts backend API calls and returns mock data.
 */

type MockOptions = {
  user?: typeof fixtures.testUser | typeof fixtures.adminUser;
  creditBalance?: typeof fixtures.testCreditBalance;
  items?: typeof fixtures.testItems;
  gridfinityUnits?: typeof fixtures.testGridfinityUnits;
  collaborationContext?:
    | typeof fixtures.testCollaborationContext
    | typeof fixtures.testCollaborationContextViewer
    | typeof fixtures.testCollaborationContextEmpty;
};

/**
 * Sets up all API mocks for a test page.
 * Call this at the beginning of each test.
 */
export async function setupApiMocks(page: Page, options: MockOptions = {}) {
  const {
    user = fixtures.testUser,
    creditBalance = fixtures.testCreditBalance,
    items = fixtures.testItems,
    gridfinityUnits = fixtures.testGridfinityUnits,
    collaborationContext = fixtures.testCollaborationContextEmpty,
  } = options;

  // Auth endpoints
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });

  // Collaboration endpoints
  await page.route("**/api/v1/collaboration/context", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(collaborationContext),
    });
  });

  // OAuth providers - must be before generic auth routes
  await page.route("**/api/v1/auth/providers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "google", name: "Google", icon: "google" }]),
    });
  });

  await page.route("**/api/v1/auth/google*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authorization_url:
          "https://accounts.google.com/o/oauth2/auth?mock=true",
      }),
    });
  });

  // Items endpoints
  await page.route("**/api/v1/items?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: items,
        total: items.length,
        page: 1,
        limit: 20,
        total_pages: 1,
      }),
    });
  });

  await page.route("**/api/v1/items", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: items,
          total: items.length,
          page: 1,
          limit: 20,
          total_pages: 1,
        }),
      });
    } else if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const newItem = {
        ...fixtures.testItemDetail,
        id: `item-${Date.now()}`,
        ...body,
        category:
          fixtures.testCategories.find((c) => c.id === body.category_id) ||
          null,
        location:
          fixtures.testLocations.find((l) => l.id === body.location_id) || null,
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newItem),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/v1/items/facets*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtures.testFacets),
    });
  });

  await page.route("**/api/v1/items/low-stock", async (route) => {
    const lowStock = items.filter((i) => i.is_low_stock);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(lowStock),
    });
  });

  await page.route("**/api/v1/items/tags*", async (route) => {
    const tags =
      fixtures.testFacets.facets.find((f) => f.name === "tags")?.values || [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(tags),
    });
  });

  await page.route(/\/api\/v1\/items\/[^/]+$/, async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const itemId = url.split("/").pop();

    // Skip "find-similar" - it's handled by a more specific route registered after this
    if (itemId === "find-similar") {
      await route.fallback();
      return;
    }

    const item = items.find((i) => i.id === itemId);

    if (method === "GET") {
      if (item) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...item,
            category_id: item.category?.id || null,
            location_id: item.location?.id || null,
            min_quantity: 1,
            attributes: {},
            ai_classification: {},
          }),
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Item not found" }),
        });
      }
    } else if (method === "PUT") {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...fixtures.testItemDetail,
          ...body,
          id: itemId,
        }),
      });
    } else if (method === "DELETE") {
      await route.fulfill({
        status: 204,
      });
    } else {
      await route.continue();
    }
  });

  // Find similar items endpoint - registered LAST for items routes (LIFO priority)
  await page.route("**/api/v1/items/find-similar", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtures.testSimilarItems),
    });
  });

  // Categories endpoints - use regex to match exact path
  await page.route(/\/api\/v1\/categories$/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixtures.testCategories),
      });
    } else if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const newCategory = {
        id: `cat-${Date.now()}`,
        ...body,
        path: body.name,
        attribute_template: body.attribute_template || { fields: [] },
        created_at: new Date().toISOString(),
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newCategory),
      });
    } else {
      await route.continue();
    }
  });

  await page.route(/\/api\/v1\/categories\/[^/]+\/template$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fields: [
          { name: "voltage", label: "Voltage", type: "number", unit: "V" },
          {
            name: "package",
            label: "Package",
            type: "select",
            options: ["SMD", "THT"],
          },
        ],
        inherited_from: ["Electronics"],
      }),
    });
  });

  await page.route(/\/api\/v1\/categories\/[^/]+$/, async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const catId = url.split("/").pop();

    // Skip "tree" - it's handled by a more specific route registered after this
    if (catId === "tree") {
      await route.fallback();
      return;
    }

    const category = fixtures.testCategories.find((c) => c.id === catId);

    if (method === "GET") {
      if (category) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(category),
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Category not found" }),
        });
      }
    } else if (method === "PUT") {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...category,
          ...body,
        }),
      });
    } else if (method === "DELETE") {
      await route.fulfill({ status: 204 });
    } else {
      await route.continue();
    }
  });

  // Tree route - registered LAST so it has highest priority (LIFO)
  await page.route("**/api/v1/categories/tree", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtures.testCategoryTree),
    });
  });

  // Locations endpoints - use regex to match exact path
  await page.route(/\/api\/v1\/locations$/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixtures.testLocations),
      });
    } else if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const newLocation = {
        id: `loc-${Date.now()}`,
        ...body,
        path: body.name,
        created_at: new Date().toISOString(),
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newLocation),
      });
    } else {
      await route.continue();
    }
  });

  await page.route(/\/api\/v1\/locations\/[^/]+$/, async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const locId = url.split("/").pop();

    // Skip "tree" - it's handled by a more specific route registered after this
    if (locId === "tree") {
      await route.fallback();
      return;
    }

    const location = fixtures.testLocations.find((l) => l.id === locId);

    if (method === "GET") {
      if (location) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(location),
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Location not found" }),
        });
      }
    } else if (method === "PUT") {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...location,
          ...body,
        }),
      });
    } else if (method === "DELETE") {
      await route.fulfill({ status: 204 });
    } else {
      await route.continue();
    }
  });

  // Tree route - registered LAST so it has highest priority (LIFO)
  await page.route("**/api/v1/locations/tree", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtures.testLocationTree),
    });
  });

  // QR code endpoint - returns a small transparent PNG for testing
  await page.route(/\/api\/v1\/locations\/[^/]+\/qr/, async (route) => {
    // Return a 1x1 transparent PNG for testing
    const transparentPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: transparentPng,
    });
  });

  // With ancestors endpoint - use glob pattern for consistency
  await page.route("**/api/v1/locations/*/with-ancestors", async (route) => {
    const url = route.request().url();
    const parts = url.split("/");
    const locId = parts[parts.length - 2]; // Get ID before /with-ancestors

    const location = fixtures.testLocations.find((l) => l.id === locId);

    if (location) {
      // Build ancestors list based on parent_id
      const ancestors: typeof fixtures.testLocations = [];
      let currentParentId = location.parent_id;
      while (currentParentId) {
        const parent = fixtures.testLocations.find(
          (l) => l.id === currentParentId
        );
        if (parent) {
          ancestors.unshift(parent);
          currentParentId = parent.parent_id;
        } else {
          break;
        }
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...location,
          ancestors,
        }),
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Location not found" }),
      });
    }
  });

  // Billing endpoints
  await page.route("**/api/v1/billing/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(creditBalance),
    });
  });

  await page.route("**/api/v1/billing/packs", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtures.testCreditPacks),
    });
  });

  await page.route("**/api/v1/billing/transactions*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: fixtures.testCreditTransactions,
        total: fixtures.testCreditTransactions.length,
        page: 1,
        limit: 20,
        total_pages: 1,
      }),
    });
  });

  await page.route("**/api/v1/billing/checkout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        checkout_url: "https://checkout.stripe.com/mock-session",
      }),
    });
  });

  await page.route("**/api/v1/billing/portal", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        portal_url: "https://billing.stripe.com/mock-portal",
      }),
    });
  });

  // Images endpoints
  await page.route("**/api/v1/images/upload", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtures.testImageUpload),
    });
  });

  await page.route("**/api/v1/images/classified*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
      }),
    });
  });

  await page.route(/\/api\/v1\/images\/[^/]+\/signed-url$/, async (route) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: `${apiUrl}/uploads/mock-signed-url.jpg?token=mock-token`,
      }),
    });
  });

  // Admin endpoints (will be restricted to admin users in tests)
  await page.route("**/api/v1/admin/stats", async (route) => {
    if (user.is_admin) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixtures.testAdminStats),
      });
    } else {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Admin access required" }),
      });
    }
  });

  await page.route("**/api/v1/admin/users*", async (route) => {
    if (user.is_admin) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: fixtures.testAdminUsers,
          total: fixtures.testAdminUsers.length,
          page: 1,
          limit: 20,
          total_pages: 1,
        }),
      });
    } else {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Admin access required" }),
      });
    }
  });

  await page.route("**/api/v1/admin/packs", async (route) => {
    if (user.is_admin) {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(fixtures.testAdminPacks),
        });
      } else if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: `pack-${Date.now()}`,
            ...body,
            created_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    } else {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Admin access required" }),
      });
    }
  });

  await page.route("**/api/v1/admin/feedback*", async (route) => {
    if (user.is_admin) {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: fixtures.testAdminFeedback,
            total: fixtures.testAdminFeedback.length,
            page: 1,
            limit: 20,
            total_pages: 1,
          }),
        });
      } else {
        await route.continue();
      }
    } else {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Admin access required" }),
      });
    }
  });

  await page.route("**/api/v1/admin/webhooks*", async (route) => {
    if (user.is_admin) {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    } else {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Admin access required" }),
      });
    }
  });

  // Gridfinity endpoints
  await page.route("**/api/v1/gridfinity/units", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(gridfinityUnits),
      });
    } else if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const newUnit = {
        id: `gf-unit-${Date.now()}`,
        ...body,
        grid_columns: Math.floor(body.container_width_mm / 42),
        grid_rows: Math.floor(body.container_depth_mm / 42),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newUnit),
      });
    } else {
      await route.continue();
    }
  });

  await page.route(/\/api\/v1\/gridfinity\/units\/[^/]+$/, async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const unitId = url.split("/").pop();
    const unit = gridfinityUnits.find((u) => u.id === unitId);

    if (method === "GET") {
      if (unit) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(unit),
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Gridfinity unit not found" }),
        });
      }
    } else if (method === "PUT") {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...unit,
          ...body,
          grid_columns: body.container_width_mm
            ? Math.floor(body.container_width_mm / 42)
            : unit?.grid_columns || 0,
          grid_rows: body.container_depth_mm
            ? Math.floor(body.container_depth_mm / 42)
            : unit?.grid_rows || 0,
          updated_at: new Date().toISOString(),
        }),
      });
    } else if (method === "DELETE") {
      await route.fulfill({ status: 204 });
    } else {
      await route.continue();
    }
  });
}

/**
 * Sets up AI classification mock with configurable behavior.
 */
export async function setupClassificationMock(
  page: Page,
  options: {
    shouldSucceed?: boolean;
    hasCredits?: boolean;
    response?: typeof fixtures.testClassificationResult;
  } = {}
) {
  const {
    shouldSucceed = true,
    hasCredits = true,
    response = fixtures.testClassificationResult,
  } = options;

  await page.route("**/api/v1/images/classify", async (route) => {
    if (!hasCredits) {
      await route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({
          detail:
            "Insufficient credits. Please purchase more credits to continue.",
        }),
      });
      return;
    }

    if (shouldSucceed) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: "Failed to classify image. Please try again.",
        }),
      });
    }
  });
}

/**
 * Simulates authenticated state by setting localStorage token.
 */
export async function authenticateUser(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "mock-jwt-token");
  });
}

/**
 * Clears authentication state.
 */
export async function clearAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("auth_token");
  });
}
