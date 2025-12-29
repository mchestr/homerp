/**
 * MSW handlers for admin endpoints.
 *
 * Note: These handlers don't check admin status - they return success responses by default.
 * Tests that need to verify auth/permission behavior should use network.use() overrides
 * to return 403 Forbidden responses.
 */

import { http, HttpResponse } from "msw";
import {
  testAdminStats,
  testAdminUsers,
  testAdminPacks,
  testAdminFeedback,
  testAdminPricing,
  testAIModelSettings,
  testAdminApiKeys,
  testApiKeyCreatedResponse,
} from "../../fixtures/factories";

export const adminHandlers = [
  // Get admin stats
  http.get("**/api/v1/admin/stats", () => {
    return HttpResponse.json(testAdminStats);
  }),

  // Get users list
  http.get("**/api/v1/admin/users", () => {
    return HttpResponse.json({
      items: testAdminUsers,
      total: testAdminUsers.length,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
  }),

  // Get credit packs (admin)
  http.get("**/api/v1/admin/packs", () => {
    return HttpResponse.json(testAdminPacks);
  }),

  // Create credit pack
  http.post("**/api/v1/admin/packs", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: `pack-${Date.now()}`,
        ...body,
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // Get feedback list
  http.get("**/api/v1/admin/feedback", () => {
    return HttpResponse.json({
      items: testAdminFeedback,
      total: testAdminFeedback.length,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
  }),

  // Get webhooks
  http.get("**/api/v1/admin/webhooks", () => {
    return HttpResponse.json([]);
  }),

  // Get activity feed
  http.get("**/api/v1/admin/activity", () => {
    return HttpResponse.json({
      items: testAdminStats.recent_activity,
      total: testAdminStats.recent_activity.length,
      page: 1,
      limit: 15,
      total_pages: 1,
    });
  }),

  // Get revenue stats
  http.get("**/api/v1/admin/stats/revenue", () => {
    return HttpResponse.json({
      data: [
        { date: "2024-06-14", revenue_cents: 5000, transaction_count: 2 },
        { date: "2024-06-15", revenue_cents: 7500, transaction_count: 3 },
        { date: "2024-06-16", revenue_cents: 3000, transaction_count: 1 },
        { date: "2024-06-17", revenue_cents: 10000, transaction_count: 4 },
        { date: "2024-06-18", revenue_cents: 6000, transaction_count: 2 },
        { date: "2024-06-19", revenue_cents: 8500, transaction_count: 3 },
        { date: "2024-06-20", revenue_cents: 5000, transaction_count: 2 },
      ],
      total_revenue_cents: 250000,
      period_revenue_cents: 45000,
      period_label: "Last 7 days",
    });
  }),

  // Get signups stats
  http.get("**/api/v1/admin/stats/signups", () => {
    return HttpResponse.json({
      data: [
        { date: "2024-06-14", signups: 2 },
        { date: "2024-06-15", signups: 3 },
        { date: "2024-06-16", signups: 1 },
        { date: "2024-06-17", signups: 4 },
        { date: "2024-06-18", signups: 0 },
        { date: "2024-06-19", signups: 1 },
        { date: "2024-06-20", signups: 1 },
      ],
      total_users: 150,
      period_signups: 12,
      period_label: "Last 7 days",
    });
  }),

  // Get credits stats
  http.get("**/api/v1/admin/stats/credits", () => {
    return HttpResponse.json({
      data: [
        { date: "2024-06-14", purchased: 100, used: 50 },
        { date: "2024-06-15", purchased: 200, used: 75 },
        { date: "2024-06-16", purchased: 0, used: 30 },
        { date: "2024-06-17", purchased: 500, used: 100 },
        { date: "2024-06-18", purchased: 100, used: 45 },
        { date: "2024-06-19", purchased: 0, used: 60 },
        { date: "2024-06-20", purchased: 100, used: 40 },
      ],
      total_purchased: 10000,
      total_used: 7500,
      period_purchased: 1000,
      period_used: 400,
      period_label: "Last 7 days",
    });
  }),

  // Get pack stats
  http.get("**/api/v1/admin/stats/packs", () => {
    return HttpResponse.json({
      packs: [
        {
          pack_name: "Standard Pack",
          purchase_count: 50,
          revenue_cents: 100000,
          percentage: 40.0,
        },
        {
          pack_name: "Starter Pack",
          purchase_count: 100,
          revenue_cents: 75000,
          percentage: 30.0,
        },
        {
          pack_name: "Pro Pack",
          purchase_count: 15,
          revenue_cents: 75000,
          percentage: 30.0,
        },
      ],
      total_revenue_cents: 250000,
      period_label: "Last 7 days",
    });
  }),

  // Get pricing list
  http.get("**/api/v1/admin/pricing", () => {
    return HttpResponse.json(testAdminPricing);
  }),

  // Get single pricing
  http.get("**/api/v1/admin/pricing/:pricingId", ({ params }) => {
    const { pricingId } = params;
    const pricing = testAdminPricing.find((p) => p.id === pricingId);
    if (pricing) {
      return HttpResponse.json(pricing);
    }
    return HttpResponse.json(
      { detail: "Pricing configuration not found" },
      { status: 404 }
    );
  }),

  // Update pricing
  http.put(
    "**/api/v1/admin/pricing/:pricingId",
    async ({ params, request }) => {
      const { pricingId } = params;
      const body = (await request.json()) as Record<string, unknown>;
      const pricing = testAdminPricing.find((p) => p.id === pricingId);
      return HttpResponse.json({
        ...pricing,
        ...body,
        updated_at: new Date().toISOString(),
      });
    }
  ),

  // Get AI model settings
  http.get("**/api/v1/admin/ai-model-settings", () => {
    return HttpResponse.json(testAIModelSettings);
  }),

  // Get single AI model settings
  http.get("**/api/v1/admin/ai-model-settings/:settingsId", ({ params }) => {
    const { settingsId } = params;
    const settings = testAIModelSettings.find((s) => s.id === settingsId);
    if (settings) {
      return HttpResponse.json(settings);
    }
    return HttpResponse.json(
      { detail: "AI model settings not found" },
      { status: 404 }
    );
  }),

  // Update AI model settings
  http.put(
    "**/api/v1/admin/ai-model-settings/:settingsId",
    async ({ params, request }) => {
      const { settingsId } = params;
      const body = (await request.json()) as Record<string, unknown>;
      const settings = testAIModelSettings.find((s) => s.id === settingsId);
      return HttpResponse.json({
        ...settings,
        ...body,
        updated_at: new Date().toISOString(),
      });
    }
  ),

  // Get API keys
  http.get("**/api/v1/admin/apikeys", () => {
    return HttpResponse.json({
      items: testAdminApiKeys,
      total: testAdminApiKeys.length,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
  }),

  // Create API key
  http.post("**/api/v1/admin/apikeys", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        ...testApiKeyCreatedResponse,
        ...body,
      },
      { status: 201 }
    );
  }),

  // Update API key
  http.put("**/api/v1/admin/apikeys/:keyId", async ({ params, request }) => {
    const { keyId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const key = testAdminApiKeys.find((k) => k.id === keyId);
    return HttpResponse.json({
      ...key,
      ...body,
    });
  }),

  // Delete API key
  http.delete("**/api/v1/admin/apikeys/:keyId", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
