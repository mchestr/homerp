"use client";

import { useQuery } from "@tanstack/react-query";
import {
  billingApi,
  type OperationCostsResponse,
} from "@/lib/api/api-client";

export type OperationType =
  | "image_classification"
  | "location_analysis"
  | "assistant_query"
  | "location_suggestion";

/**
 * Hook to fetch and cache operation costs from the backend.
 * Returns the cost for each operation type and helper functions.
 *
 * Cache Strategy:
 * - staleTime (5 min): How long data is considered fresh. Within this window,
 *   React Query returns cached data without refetching.
 * - gcTime (30 min): How long unused data stays in cache before garbage collection.
 * - Backend also sets Cache-Control: max-age=300 (5 min) for HTTP-level caching.
 *
 * Rationale: Pricing rarely changes, so aggressive caching reduces API calls.
 * The 5-minute stale time balances freshness with performance.
 *
 * Usage: Components should check isLoading and show appropriate loading state
 * for cost displays (e.g., "..." or skeleton) rather than showing potentially
 * incorrect fallback values.
 */
export function useOperationCosts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["billing", "costs"],
    queryFn: () => billingApi.getCosts(),
    staleTime: 5 * 60 * 1000, // 5 minutes - matches backend Cache-Control max-age
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer for background tabs
  });

  /**
   * Get the credit cost for a specific operation type.
   * Returns undefined if costs haven't loaded yet.
   */
  const getCost = (operationType: OperationType): number | undefined => {
    if (data?.costs && operationType in data.costs) {
      return data.costs[operationType];
    }
    return undefined;
  };

  return {
    costs: data?.costs,
    getCost,
    isLoading,
    error,
    data: data as OperationCostsResponse | undefined,
  };
}
