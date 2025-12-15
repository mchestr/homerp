"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/context/auth-context";
import {
  apiRequest,
  setInventoryContext as setApiInventoryContext,
} from "@/lib/api/api-client";

type CollaboratorRole = "viewer" | "editor";

interface CollaboratorUserInfo {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
}

interface SharedInventory {
  id: string;
  owner_id: string;
  role: CollaboratorRole;
  status: "pending" | "accepted" | "declined";
  accepted_at: string | null;
  owner: CollaboratorUserInfo;
}

interface InventoryContextData {
  own_inventory: CollaboratorUserInfo;
  shared_inventories: SharedInventory[];
  pending_invitations: unknown[];
}

export interface SelectedInventory {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  isOwn: boolean;
  role?: CollaboratorRole;
}

interface InventoryContextState {
  selectedInventory: SelectedInventory | null;
  sharedInventories: SharedInventory[];
  isLoading: boolean;
}

interface InventoryContextType extends InventoryContextState {
  selectInventory: (inventory: SelectedInventory) => void;
  selectOwnInventory: () => void;
  refreshInventories: () => Promise<void>;
  getInventoryContextHeader: () => string | null;
  isViewingSharedInventory: boolean;
  canEdit: boolean;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

const STORAGE_KEY = "selected_inventory_id";

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<InventoryContextState>({
    selectedInventory: null,
    sharedInventories: [],
    isLoading: true,
  });

  const refreshInventories = useCallback(async () => {
    if (!isAuthenticated) {
      setApiInventoryContext(null);
      setState({
        selectedInventory: null,
        sharedInventories: [],
        isLoading: false,
      });
      return;
    }

    try {
      const data = await apiRequest<InventoryContextData>(
        "/api/v1/collaboration/context",
        { skipInventoryContext: true }
      );

      const acceptedShared = data.shared_inventories.filter(
        (inv) => inv.status === "accepted"
      );

      // Check if we have a stored selection (with SSR safety check)
      const storedId =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      let selectedInventory: SelectedInventory | null = null;

      if (storedId && storedId !== user?.id) {
        // Try to find the stored shared inventory
        const stored = acceptedShared.find((inv) => inv.owner_id === storedId);
        if (stored) {
          selectedInventory = {
            id: stored.owner_id,
            name: stored.owner.name,
            email: stored.owner.email,
            avatar_url: stored.owner.avatar_url,
            isOwn: false,
            role: stored.role,
          };
        }
      }

      // Default to own inventory if no valid stored selection
      if (!selectedInventory && user) {
        selectedInventory = {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
          isOwn: true,
        };
      }

      // Set the API client's inventory context
      setApiInventoryContext(
        selectedInventory?.isOwn ? null : (selectedInventory?.id ?? null)
      );

      setState({
        selectedInventory,
        sharedInventories: acceptedShared,
        isLoading: false,
      });
    } catch (error) {
      // If collaboration endpoint fails, just use own inventory
      console.error("Failed to fetch collaboration context:", error);
      setApiInventoryContext(null);
      if (user) {
        setState({
          selectedInventory: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar_url: user.avatar_url,
            isOwn: true,
          },
          sharedInventories: [],
          isLoading: false,
        });
      }
    }
  }, [isAuthenticated, user]);

  const selectInventory = useCallback((inventory: SelectedInventory) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, inventory.id);
    }
    // Update the API client's inventory context
    setApiInventoryContext(inventory.isOwn ? null : inventory.id);
    setState((prev) => ({
      ...prev,
      selectedInventory: inventory,
    }));
  }, []);

  const selectOwnInventory = useCallback(() => {
    if (user) {
      const ownInventory: SelectedInventory = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        isOwn: true,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, user.id);
      }
      // Clear the API client's inventory context when switching to own inventory
      setApiInventoryContext(null);
      setState((prev) => ({
        ...prev,
        selectedInventory: ownInventory,
      }));
    }
  }, [user]);

  const getInventoryContextHeader = useCallback((): string | null => {
    if (!state.selectedInventory || state.selectedInventory.isOwn) {
      return null;
    }
    return state.selectedInventory.id;
  }, [state.selectedInventory]);

  // Load inventories when auth state changes
  useEffect(() => {
    refreshInventories();
  }, [refreshInventories]);

  // Cleanup API context on unmount
  useEffect(() => {
    return () => {
      setApiInventoryContext(null);
    };
  }, []);

  // Update own inventory when user changes
  useEffect(() => {
    if (user && state.selectedInventory?.isOwn) {
      setState((prev) => ({
        ...prev,
        selectedInventory: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
          isOwn: true,
        },
      }));
    }
  }, [user, state.selectedInventory?.isOwn]);

  const isViewingSharedInventory = !state.selectedInventory?.isOwn;
  const canEdit =
    state.selectedInventory?.isOwn ||
    state.selectedInventory?.role === "editor";

  return (
    <InventoryContext.Provider
      value={{
        ...state,
        selectInventory,
        selectOwnInventory,
        refreshInventories,
        getInventoryContextHeader,
        isViewingSharedInventory,
        canEdit,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
}
