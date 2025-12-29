/**
 * Collaboration factory for generating test collaboration/sharing data.
 */

import { testUser, sharedInventoryOwner } from "./user.factory";

export interface InventoryOwner {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface SharedInventory {
  id: string;
  owner_id: string;
  role: "editor" | "viewer";
  status: "pending" | "accepted" | "rejected";
  accepted_at: string | null;
  owner: InventoryOwner;
}

export interface CollaborationContext {
  own_inventory: InventoryOwner;
  shared_inventories: SharedInventory[];
  pending_invitations: SharedInventory[];
}

export function createCollaborationContext(
  overrides: Partial<CollaborationContext> = {}
): CollaborationContext {
  return {
    own_inventory: {
      id: testUser.id,
      name: testUser.name,
      email: testUser.email,
      avatar_url: testUser.avatar_url,
    },
    shared_inventories: [],
    pending_invitations: [],
    ...overrides,
  };
}

export function createSharedInventory(
  overrides: Partial<SharedInventory> = {}
): SharedInventory {
  return {
    id: `collab-${Date.now()}`,
    owner_id: sharedInventoryOwner.id,
    role: "editor",
    status: "accepted",
    accepted_at: "2024-01-15T00:00:00Z",
    owner: sharedInventoryOwner,
    ...overrides,
  };
}

// Pre-built fixtures
export const testCollaborationContext: CollaborationContext = {
  own_inventory: {
    id: testUser.id,
    name: testUser.name,
    email: testUser.email,
    avatar_url: testUser.avatar_url,
  },
  shared_inventories: [
    {
      id: "collab-1",
      owner_id: sharedInventoryOwner.id,
      role: "editor",
      status: "accepted",
      accepted_at: "2024-01-15T00:00:00Z",
      owner: sharedInventoryOwner,
    },
  ],
  pending_invitations: [],
};

export const testCollaborationContextViewer: CollaborationContext = {
  own_inventory: {
    id: testUser.id,
    name: testUser.name,
    email: testUser.email,
    avatar_url: testUser.avatar_url,
  },
  shared_inventories: [
    {
      id: "collab-2",
      owner_id: sharedInventoryOwner.id,
      role: "viewer",
      status: "accepted",
      accepted_at: "2024-01-15T00:00:00Z",
      owner: sharedInventoryOwner,
    },
  ],
  pending_invitations: [],
};

export const testCollaborationContextEmpty: CollaborationContext = {
  own_inventory: {
    id: testUser.id,
    name: testUser.name,
    email: testUser.email,
    avatar_url: testUser.avatar_url,
  },
  shared_inventories: [],
  pending_invitations: [],
};
