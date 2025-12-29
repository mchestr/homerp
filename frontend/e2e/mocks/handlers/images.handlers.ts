/**
 * MSW handlers for images endpoints.
 */

import { http, HttpResponse } from "msw";
import {
  testImageUpload,
  testClassificationResult,
} from "../../fixtures/factories";

// Data URL for a 1x1 transparent PNG (minimal test image for browser rendering)
// This is the smallest valid PNG that browsers can load without network requests
const dataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export const imagesHandlers = [
  // Upload image
  http.post("**/api/v1/images/upload", () => {
    return HttpResponse.json(testImageUpload);
  }),

  // Classify image
  http.post("**/api/v1/images/classify", () => {
    return HttpResponse.json(testClassificationResult);
  }),

  // Get classified images
  http.get("**/api/v1/images/classified", () => {
    return HttpResponse.json({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
    });
  }),

  // Get location images
  http.get("**/api/v1/images/location/:locationId", () => {
    return HttpResponse.json([]);
  }),

  // Attach image to location
  http.post(
    "**/api/v1/images/:imageId/attach-location/:locationId",
    ({ params }) => {
      const { imageId, locationId } = params;
      return HttpResponse.json({
        ...testImageUpload,
        id: imageId,
        location_id: locationId,
        item_id: null,
        is_primary: true,
      });
    }
  ),

  // Detach image from location
  http.post("**/api/v1/images/:imageId/detach-location", ({ params }) => {
    const { imageId } = params;
    return HttpResponse.json({
      ...testImageUpload,
      id: imageId,
      location_id: null,
      is_primary: false,
    });
  }),

  // Set primary image
  http.post("**/api/v1/images/:imageId/set-primary", ({ params }) => {
    const { imageId } = params;
    return HttpResponse.json({
      id: imageId,
      is_primary: true,
    });
  }),

  // Get signed URL for image
  http.get("**/api/v1/images/:imageId/signed-url", () => {
    return HttpResponse.json({
      url: dataUrl,
    });
  }),
];
