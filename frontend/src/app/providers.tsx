"use client";

// IMPORTANT: Import client-setup first to configure the API client before any API calls
import "@/lib/api/client-setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { InventoryProvider } from "@/context/inventory-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
          },
        },
      })
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <InventoryProvider>{children}</InventoryProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
