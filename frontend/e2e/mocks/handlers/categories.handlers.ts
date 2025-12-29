/**
 * MSW handlers for categories endpoints.
 */

import { http, HttpResponse } from "msw";
import { testCategories, testCategoryTree } from "../../fixtures/factories";

export const categoriesHandlers = [
  // Get category tree (must be before generic /:categoryId)
  http.get("**/api/v1/categories/tree", () => {
    return HttpResponse.json(testCategoryTree);
  }),

  // List categories
  http.get("**/api/v1/categories", () => {
    return HttpResponse.json(testCategories);
  }),

  // Create category
  http.post("**/api/v1/categories", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newCategory = {
      id: `cat-${Date.now()}`,
      ...body,
      path: body.name as string,
      attribute_template: body.attribute_template || { fields: [] },
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json(newCategory, { status: 201 });
  }),

  // Get category template
  http.get("**/api/v1/categories/:categoryId/template", () => {
    return HttpResponse.json({
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
    });
  }),

  // Get single category
  http.get("**/api/v1/categories/:categoryId", ({ params }) => {
    const { categoryId } = params;

    // Skip special paths
    if (categoryId === "tree") {
      return;
    }

    const category = testCategories.find((c) => c.id === categoryId);
    if (category) {
      return HttpResponse.json(category);
    }
    return HttpResponse.json({ detail: "Category not found" }, { status: 404 });
  }),

  // Update category
  http.put("**/api/v1/categories/:categoryId", async ({ params, request }) => {
    const { categoryId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const category = testCategories.find((c) => c.id === categoryId);
    return HttpResponse.json({
      ...category,
      ...body,
    });
  }),

  // Delete category
  http.delete("**/api/v1/categories/:categoryId", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
