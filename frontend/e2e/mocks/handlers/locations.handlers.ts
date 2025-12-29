/**
 * MSW handlers for locations endpoints.
 */

import { http, HttpResponse } from "msw";
import { testLocations, testLocationTree } from "../../fixtures/factories";

// Small transparent PNG for QR code responses
const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

export const locationsHandlers = [
  // Get location tree (must be before generic /:locationId)
  http.get("**/api/v1/locations/tree", () => {
    return HttpResponse.json(testLocationTree);
  }),

  // List locations
  http.get("**/api/v1/locations", () => {
    return HttpResponse.json(testLocations);
  }),

  // Create location
  http.post("**/api/v1/locations", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newLocation = {
      id: `loc-${Date.now()}`,
      ...body,
      path: body.name as string,
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json(newLocation, { status: 201 });
  }),

  // Get location with ancestors
  http.get("**/api/v1/locations/:locationId/with-ancestors", ({ params }) => {
    const { locationId } = params;
    const location = testLocations.find((l) => l.id === locationId);

    if (location) {
      // Build ancestors list based on parent_id
      const ancestors: typeof testLocations = [];
      let currentParentId = location.parent_id;
      while (currentParentId) {
        const parent = testLocations.find((l) => l.id === currentParentId);
        if (parent) {
          ancestors.unshift(parent);
          currentParentId = parent.parent_id;
        } else {
          break;
        }
      }

      return HttpResponse.json({
        ...location,
        ancestors,
      });
    }
    return HttpResponse.json({ detail: "Location not found" }, { status: 404 });
  }),

  // Get QR code signed URL
  http.get(
    "**/api/v1/locations/:locationId/qr/signed-url",
    ({ params, request }) => {
      const { locationId } = params;
      const url = new URL(request.url);
      const size = url.searchParams.get("size") || "10";

      return HttpResponse.json({
        url: `http://localhost:8000/api/v1/locations/${locationId}/qr?token=mock-token&size=${size}`,
      });
    }
  ),

  // Get QR code image
  http.get("**/api/v1/locations/:locationId/qr", () => {
    return new HttpResponse(transparentPng, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });
  }),

  // Get single location
  http.get("**/api/v1/locations/:locationId", ({ params }) => {
    const { locationId } = params;

    // Skip special paths
    if (locationId === "tree") {
      return;
    }

    const location = testLocations.find((l) => l.id === locationId);
    if (location) {
      return HttpResponse.json(location);
    }
    return HttpResponse.json({ detail: "Location not found" }, { status: 404 });
  }),

  // Update location
  http.put("**/api/v1/locations/:locationId", async ({ params, request }) => {
    const { locationId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const location = testLocations.find((l) => l.id === locationId);
    return HttpResponse.json({
      ...location,
      ...body,
    });
  }),

  // Delete location
  http.delete("**/api/v1/locations/:locationId", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
