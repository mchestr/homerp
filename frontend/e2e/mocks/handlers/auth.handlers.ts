/**
 * MSW handlers for authentication endpoints.
 */

import { http, HttpResponse } from "msw";
import { testUser } from "../../fixtures/factories";

export const authHandlers = [
  // Get current user
  http.get("**/api/v1/auth/me", () => {
    return HttpResponse.json(testUser);
  }),

  // Get OAuth providers
  http.get("**/api/v1/auth/providers", () => {
    return HttpResponse.json([
      { id: "google", name: "Google", icon: "google" },
    ]);
  }),

  // Initiate Google OAuth
  http.get("**/api/v1/auth/google", () => {
    return HttpResponse.json({
      authorization_url: "https://accounts.google.com/o/oauth2/auth?mock=true",
    });
  }),

  // Google OAuth callback
  http.get("**/api/v1/auth/callback/google", () => {
    return HttpResponse.json({
      token: { access_token: "mock-jwt-token", expires_in: 86400 },
      user: testUser,
    });
  }),
];
