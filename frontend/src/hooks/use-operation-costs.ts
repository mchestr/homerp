"use client";

import { useQuery } from "@tanstack/react-query";
import { getOperationCostsApiV1BillingCostsGetOptions } from "@/lib/api/@tanstack/react-query.gen";
import type { OperationCostsResponse } from "@/lib/api/types.gen";

export type OperationType =
  | "image_classification"
  | "location_analysis"
  | "assistant_query"
  | "location_suggestion";

// Default costs as fallback (matching backend defaults)
const DEFAULT_COSTS: Record<OperationType, number> = {
  image_classification: 1,
  location_analysis: 1,
  assistant_query: 1,
  location_suggestion: 1,
};

/**
 * Hook to fetch and cache operation costs from the backend.
 * Returns the cost for each operation type and helper functions.
 */
export function useOperationCosts() {
  const { data, isLoading, error } = useQuery({
    ...getOperationCostsApiV1BillingCostsGetOptions(),
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
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
