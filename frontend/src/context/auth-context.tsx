"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  authApi,
  billingApi,
  CreditBalance,
  User,
  UserSettingsUpdate,
} from "@/lib/api/api-client";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  creditBalance: CreditBalance | null;
};

type AuthContextType = AuthState & {
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  updateSettings: (settings: UserSettingsUpdate) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    creditBalance: null,
  });

  const refreshCredits = useCallback(async () => {
    try {
      const balance = await billingApi.getBalance();
      setState((prev) => ({
        ...prev,
        creditBalance: balance,
      }));
    } catch {
      // Silently fail - credits are not critical
    }
  }, []);

  const login = useCallback(async (token: string, user: User) => {
    localStorage.setItem("auth_token", token);
    setState({
      user,
      isLoading: false,
      isAuthenticated: true,
      creditBalance: null,
    });
    // Fetch credits after login
    try {
      const balance = await billingApi.getBalance();
      setState((prev) => ({
        ...prev,
        creditBalance: balance,
      }));
    } catch {
      // Silently fail
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      creditBalance: null,
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.getCurrentUser();
      setState((prev) => ({
        ...prev,
        user,
        isLoading: false,
        isAuthenticated: true,
      }));
      // Also refresh credits
      try {
        const balance = await billingApi.getBalance();
        setState((prev) => ({
          ...prev,
          creditBalance: balance,
        }));
      } catch {
        // Silently fail
      }
    } catch {
      logout();
    }
  }, [logout]);

  const updateSettings = useCallback(async (settings: UserSettingsUpdate) => {
    const updatedUser = await authApi.updateSettings(settings);
    setState((prev) => ({
      ...prev,
      user: updatedUser,
    }));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      refreshUser();
    } else {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        creditBalance: null,
      });
    }
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshUser,
        refreshCredits,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
