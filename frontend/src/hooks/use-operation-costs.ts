"use client";

import { useQuery } from "@tanstack/react-query";
import { getOperationCostsApiV1BillingCostsGetOptions } from "@/lib/api/@tanstack/react-query.gen";
import type { OperationCostsResponse } from "@/lib/api/types.gen";

export type OperationType =
  | "image_classification"
  | "location_analysis"
  | "assistant_query"
  | "location_suggestion";

/**
 * Default costs as fallback while loading or if fetch fails.
 *
 * SYNC WARNING: These values must match the backend database defaults in
 * `backend/src/billing/pricing_service.py`. If pricing changes in production,
 * update these fallbacks to minimize incorrect cost display during initial load.
 */
const DEFAULT_COSTS: Record<OperationType, number> = {
  image_classification: 1,
  location_analysis: 1,
  assistant_query: 1,
  location_suggestion: 1,
};

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
 */
export function useOperationCosts() {
  const { data, isLoading, error } = useQuery({
    ...getOperationCostsApiV1BillingCostsGetOptions(),
    staleTime: 5 * 60 * 1000, // 5 minutes - matches backend Cache-Control max-age
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer for background tabs
  });

  /**
   * Get the credit cost for a specific operation type.
   * Falls back to default if data is not loaded.
   */
  const getCost = (operationType: OperationType): number => {
    if (data?.costs && operationType in data.costs) {
      return data.costs[operationType];
    }
    return DEFAULT_COSTS[operationType];
  };

  /**
   * Get all operation costs as a map.
   */
  const costs = data?.costs ?? DEFAULT_COSTS;

  return {
    costs,
    getCost,
    isLoading,
    error,
    data: data as OperationCostsResponse | undefined,
  };
}
