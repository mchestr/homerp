/**
 * Billing factory for generating test billing/credit data.
 */

export interface CreditBalance {
  purchased_credits: number;
  free_credits: number;
  total_credits: number;
  next_free_reset_at: string;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string;
  is_best_value: boolean;
}

export interface AdminCreditPack extends CreditPack {
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  is_refunded: boolean;
  created_at: string;
  credit_pack: CreditPack | null;
}

export interface OperationCosts {
  costs: Record<string, number>;
  items: Array<{
    operation_type: string;
    credits: number;
    display_name: string;
  }>;
  signup_credits: number;
}

export interface PaginatedTransactions {
  items: CreditTransaction[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export function createCreditBalance(
  overrides: Partial<CreditBalance> = {}
): CreditBalance {
  return {
    purchased_credits: 10,
    free_credits: 5,
    total_credits: 15,
    next_free_reset_at: "2025-02-01T00:00:00Z",
    ...overrides,
  };
}

export function createCreditPack(
  overrides: Partial<CreditPack> = {}
): CreditPack {
  return {
    id: `pack-${Date.now()}`,
    name: "Test Pack",
    credits: 50,
    price_cents: 500,
    stripe_price_id: "price_test",
    is_best_value: false,
    ...overrides,
  };
}

// Pre-built fixtures
export const testCreditBalance: CreditBalance = {
  purchased_credits: 10,
  free_credits: 5,
  total_credits: 15,
  next_free_reset_at: "2025-02-01T00:00:00Z",
};

export const testCreditBalanceZero: CreditBalance = {
  purchased_credits: 0,
  free_credits: 0,
  total_credits: 0,
  next_free_reset_at: "2025-02-01T00:00:00Z",
};

export const testCreditPacks: CreditPack[] = [
  {
    id: "pack-1",
    name: "Starter Pack",
    credits: 25,
    price_cents: 300,
    stripe_price_id: "price_starter",
    is_best_value: false,
  },
  {
    id: "pack-2",
    name: "Standard Pack",
    credits: 100,
    price_cents: 1000,
    stripe_price_id: "price_standard",
    is_best_value: true,
  },
  {
    id: "pack-3",
    name: "Pro Pack",
    credits: 500,
    price_cents: 4000,
    stripe_price_id: "price_pro",
    is_best_value: false,
  },
];

export const testAdminPacks: AdminCreditPack[] = [
  {
    id: "pack-1",
    name: "Starter Pack",
    credits: 25,
    price_cents: 300,
    stripe_price_id: "price_starter",
    is_best_value: false,
    is_active: true,
    sort_order: 1,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "pack-2",
    name: "Standard Pack",
    credits: 100,
    price_cents: 1000,
    stripe_price_id: "price_standard",
    is_best_value: true,
    is_active: true,
    sort_order: 2,
    created_at: "2024-01-01T00:00:00Z",
  },
];

export const testCreditTransactions: CreditTransaction[] = [
  {
    id: "trans-1",
    amount: 100,
    transaction_type: "purchase",
    description: "Purchased Standard Pack",
    is_refunded: false,
    created_at: "2024-06-01T00:00:00Z",
    credit_pack: testCreditPacks[1],
  },
  {
    id: "trans-2",
    amount: -1,
    transaction_type: "usage",
    description: "AI Classification",
    is_refunded: false,
    created_at: "2024-06-15T00:00:00Z",
    credit_pack: null,
  },
];

export const testOperationCosts: OperationCosts = {
  costs: {
    image_classification: 1,
    assistant_query: 1,
    location_suggestion: 1,
  },
  items: [
    {
      operation_type: "image_classification",
      credits: 1,
      display_name: "Image Classification",
    },
    {
      operation_type: "assistant_query",
      credits: 1,
      display_name: "AI Assistant Query",
    },
    {
      operation_type: "location_suggestion",
      credits: 1,
      display_name: "Location Suggestion",
    },
  ],
  signup_credits: 5,
};
