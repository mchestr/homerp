/**
 * MSW handlers for notifications and profile endpoints.
 */

import { http, HttpResponse } from "msw";
import {
  testNotificationPreferences,
  testDeclutterCost,
  testDeclutterRecommendations,
} from "../../fixtures/factories";

export const notificationsHandlers = [
  // Get notification preferences
  http.get("**/api/v1/notifications/preferences", () => {
    return HttpResponse.json(testNotificationPreferences);
  }),

  // Update notification preferences
  http.put("**/api/v1/notifications/preferences", async ({ request }) => {
    const updates = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...testNotificationPreferences,
      ...updates,
    });
  }),

  // Profile/Declutter endpoints
  http.get("**/api/v1/profile/recommendations/cost", () => {
    return HttpResponse.json(testDeclutterCost);
  }),

  http.get("**/api/v1/profile/recommendations", () => {
    return HttpResponse.json(testDeclutterRecommendations);
  }),

  http.post("**/api/v1/profile/recommendations", () => {
    return HttpResponse.json({
      recommendations: testDeclutterRecommendations,
      total_generated: testDeclutterRecommendations.length,
      credits_used: 1,
    });
  }),
];
