/**
 * MSW handlers for gridfinity storage endpoints.
 */

import { http, HttpResponse } from "msw";
import { testGridfinityUnits } from "../../fixtures/factories";

export const gridfinityHandlers = [
  // List gridfinity units
  http.get("**/api/v1/gridfinity/units", () => {
    return HttpResponse.json(testGridfinityUnits);
  }),

  // Create gridfinity unit
  http.post("**/api/v1/gridfinity/units", async ({ request }) => {
    const body = (await request.json()) as {
      container_width_mm?: number;
      container_depth_mm?: number;
      [key: string]: unknown;
    };
    const newUnit = {
      id: `gf-unit-${Date.now()}`,
      ...body,
      grid_columns: Math.floor((body.container_width_mm || 252) / 42),
      grid_rows: Math.floor((body.container_depth_mm || 252) / 42),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(newUnit, { status: 201 });
  }),

  // Get single gridfinity unit
  http.get("**/api/v1/gridfinity/units/:unitId", ({ params }) => {
    const { unitId } = params;
    const unit = testGridfinityUnits.find((u) => u.id === unitId);
    if (unit) {
      return HttpResponse.json(unit);
    }
    return HttpResponse.json(
      { detail: "Gridfinity unit not found" },
      { status: 404 }
    );
  }),

  // Update gridfinity unit
  http.put("**/api/v1/gridfinity/units/:unitId", async ({ params, request }) => {
    const { unitId } = params;
    const body = (await request.json()) as {
      container_width_mm?: number;
      container_depth_mm?: number;
      [key: string]: unknown;
    };
    const unit = testGridfinityUnits.find((u) => u.id === unitId);
    return HttpResponse.json({
      ...unit,
      ...body,
      grid_columns: body.container_width_mm
        ? Math.floor(body.container_width_mm / 42)
        : unit?.grid_columns || 0,
      grid_rows: body.container_depth_mm
        ? Math.floor(body.container_depth_mm / 42)
        : unit?.grid_rows || 0,
      updated_at: new Date().toISOString(),
    });
  }),

  // Delete gridfinity unit
  http.delete("**/api/v1/gridfinity/units/:unitId", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
