/**
 * User factory for generating test user data.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  oauth_provider: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser extends User {
  credit_balance: number;
  free_credits_remaining: number;
}

let userCounter = 0;

export function createUser(overrides: Partial<User> = {}): User {
  userCounter++;
  return {
    id: `user-${userCounter}`,
    email: `user${userCounter}@example.com`,
    name: `Test User ${userCounter}`,
    avatar_url: null,
    oauth_provider: "google",
    is_admin: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createAdminUser(overrides: Partial<User> = {}): User {
  return createUser({
    name: "Admin User",
    email: "admin@example.com",
    is_admin: true,
    ...overrides,
  });
}

export function createAdminUserWithCredits(
  overrides: Partial<AdminUser> = {}
): AdminUser {
  const user = createAdminUser(overrides);
  return {
    ...user,
    credit_balance: 50,
    free_credits_remaining: 5,
    ...overrides,
  };
}

export function resetUserFactory(): void {
  userCounter = 0;
}

// Pre-built fixtures for common scenarios
export const testUser = createUser({
  id: "test-user-123",
  email: "test@example.com",
  name: "Test User",
});

export const adminUser = createAdminUser({
  id: "admin-user-456",
  email: "admin@example.com",
  name: "Admin User",
});

export const sharedInventoryOwner = {
  id: "shared-owner-789",
  email: "shared@example.com",
  name: "Shared Owner",
  avatar_url: null,
};
