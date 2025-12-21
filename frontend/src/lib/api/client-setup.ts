/**
 * Client Configuration for @hey-api/openapi-ts Generated Client
 *
 * This module configures the auto-generated API client with:
 * - Dynamic base URL from environment variables
 * - Auth token from localStorage
 * - Inventory context header for shared inventory access
 *
 * IMPORTANT: This module must be imported early in the app (e.g., in providers.tsx)
 * to ensure configuration happens before any API calls.
 */

import { client } from "./client.gen";

// =============================================================================
// Base URL Configuration
// =============================================================================

/**
 * Get the API base URL from environment variables or runtime config.
 * In production Docker, window.__ENV__ is set by __env.js at container startup.
 */
function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = (window as unknown as { __ENV__?: { API_URL?: string } })
      .__ENV__?.API_URL;
    if (envUrl) return envUrl;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

// Configure client defaults
client.setConfig({
  baseUrl: getApiBaseUrl(),
});

// =============================================================================
// Inventory Context (for shared inventory access)
// =============================================================================

let _inventoryContextId: string | null = null;

export function setInventoryContext(ownerId: string | null): void {
  _inventoryContextId = ownerId;
}

export function getInventoryContext(): string | null {
  return _inventoryContextId;
}

// =============================================================================
// Request Interceptor - Auth & Headers
// =============================================================================

client.interceptors.request.use((request) => {
  // Add auth token from localStorage
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // Add inventory context header when viewing a shared inventory
  if (_inventoryContextId && _inventoryContextId.trim() !== "") {
    request.headers.set("X-Inventory-Context", _inventoryContextId);
  }

  return request;
});

// =============================================================================
// Re-export configured client
// =============================================================================

export { client };
