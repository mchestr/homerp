/**
 * MSW handlers for items endpoints.
 */

import { http, HttpResponse } from "msw";
import {
  testItems,
  testItemDetail,
  testCategories,
  testLocations,
  testFacets,
  testSimilarItems,
} from "../../fixtures/factories";

export const itemsHandlers = [
  // List items with pagination
  http.get("**/api/v1/items", ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    return HttpResponse.json({
      items: testItems,
      total: testItems.length,
      page,
      limit,
      total_pages: Math.ceil(testItems.length / limit) || 1,
    });
  }),

  // Create item
  http.post("**/api/v1/items", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newItem = {
      ...testItemDetail,
      id: `item-${Date.now()}`,
      ...body,
      category: testCategories.find((c) => c.id === body.category_id) || null,
      location: testLocations.find((l) => l.id === body.location_id) || null,
    };
    return HttpResponse.json(newItem, { status: 201 });
  }),

  // Get facets
  http.get("**/api/v1/items/facets", () => {
    return HttpResponse.json(testFacets);
  }),

  // Get low stock items
  http.get("**/api/v1/items/low-stock", () => {
    const lowStock = testItems.filter((i) => i.is_low_stock);
    return HttpResponse.json(lowStock);
  }),

  // Get tags
  http.get("**/api/v1/items/tags", () => {
    const tags = testFacets.facets.find((f) => f.name === "tags")?.values || [];
    return HttpResponse.json(tags);
  }),

  // Find similar items (POST endpoint)
  http.post("**/api/v1/items/find-similar", () => {
    return HttpResponse.json(testSimilarItems);
  }),

  // Get single item
  http.get("**/api/v1/items/:itemId", ({ params }) => {
    const { itemId } = params;

    // Skip special paths
    if (
      itemId === "find-similar" ||
      itemId === "facets" ||
      itemId === "low-stock" ||
      itemId === "tags"
    ) {
      return;
    }

    const item = testItems.find((i) => i.id === itemId);
    if (item) {
      return HttpResponse.json({
        ...item,
        category_id: item.category?.id || null,
        location_id: item.location?.id || null,
        min_quantity: 1,
        attributes: item.attributes || {},
        ai_classification: {},
      });
    }
    return HttpResponse.json<{ detail: string }>(
      { detail: "Item not found" },
      { status: 404 }
    );
  }),

  // Update item
  http.put("**/api/v1/items/:itemId", async ({ params, request }) => {
    const { itemId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...testItemDetail,
      ...body,
      id: itemId,
    });
  }),

  // Delete item
  http.delete("**/api/v1/items/:itemId", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
