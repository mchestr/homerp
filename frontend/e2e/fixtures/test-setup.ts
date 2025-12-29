import { test as base, expect, Page } from "@playwright/test";
import { createNetworkFixture, type NetworkFixture } from "@msw/playwright";
import { handlers } from "../mocks/handlers";

/**
 * Extended test fixture with MSW network mocking.
 * Provides automatic API mocking for all E2E tests.
 */
interface TestFixtures {
  network: NetworkFixture;
}

export const test = base.extend<TestFixtures>({
  network: createNetworkFixture({
    initialHandlers: handlers,
  }),
});

export { expect };

/**
 * Sets up authenticated state by adding JWT token to localStorage.
 * Call this in beforeEach for tests that require authentication.
 */
export async function authenticateUser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "mock-jwt-token");
  });
}

/**
 * Clears authentication state from localStorage.
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem("auth_token");
  });
}
