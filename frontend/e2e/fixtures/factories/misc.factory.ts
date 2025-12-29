/**
 * Miscellaneous factories for declutter, notifications, facets, etc.
 */

import { Category, testCategories } from "./category.factory";
import { Location, testLocations } from "./location.factory";

// Declutter types
export interface DeclutterCost {
  total_items: number;
  items_to_analyze: number;
  credits_required: number;
  items_per_credit: number;
  has_sufficient_credits: boolean;
  user_credit_balance: number;
  has_profile: boolean;
}

// Matches PurgeRecommendationWithItem API type
export interface DeclutterRecommendation {
  id: string;
  user_id: string;
  item_id: string;
  reason: string;
  confidence: string; // API returns string
  factors?: { [key: string]: unknown };
  status: string;
  user_feedback: string | null;
  created_at: string;
  resolved_at: string | null;
  item_name: string;
  item_quantity: number;
  item_quantity_unit: string;
  item_price: string | null; // API returns string | null
  item_category_name: string | null;
  item_location_name: string | null;
  last_used_at: string | null;
}

// Notification types
export interface NotificationPreferences {
  email_notifications_enabled: boolean;
  low_stock_email_enabled: boolean;
}

// Facets types
export interface FacetValue {
  value: string;
  count: number;
}

export interface Facet {
  name: string;
  label: string;
  values: FacetValue[];
}

export interface FacetsResponse {
  facets: Facet[];
  total_items: number;
}

// Similar items types
export interface SimilarItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  quantity_unit: string;
  similarity_score: number;
  match_reasons: string[];
  category: Category | null;
  location: Location | null;
  primary_image_url: string | null;
}

export interface SimilarItemsResponse {
  similar_items: SimilarItem[];
  total_searched: number;
}

// Factory functions
export function createDeclutterCost(
  overrides: Partial<DeclutterCost> = {}
): DeclutterCost {
  return {
    total_items: 25,
    items_to_analyze: 25,
    credits_required: 1,
    items_per_credit: 50,
    has_sufficient_credits: true,
    user_credit_balance: 15,
    has_profile: true,
    ...overrides,
  };
}

export function createNotificationPreferences(
  overrides: Partial<NotificationPreferences> = {}
): NotificationPreferences {
  return {
    email_notifications_enabled: true,
    low_stock_email_enabled: true,
    ...overrides,
  };
}

// Pre-built fixtures
export const testDeclutterCost: DeclutterCost = {
  total_items: 25,
  items_to_analyze: 25,
  credits_required: 1,
  items_per_credit: 50,
  has_sufficient_credits: true,
  user_credit_balance: 15,
  has_profile: true,
};

export const testDeclutterCostFewItems: DeclutterCost = {
  total_items: 15,
  items_to_analyze: 15,
  credits_required: 1,
  items_per_credit: 50,
  has_sufficient_credits: true,
  user_credit_balance: 15,
  has_profile: true,
};

export const testDeclutterRecommendations: DeclutterRecommendation[] = [
  {
    id: "rec-1",
    user_id: "test-user-123",
    item_id: "item-2",
    reason:
      "You have 100 of these resistors but haven't used them in over 6 months.",
    confidence: "0.85",
    factors: {
      unused_duration: true,
      high_quantity: true,
      low_value: true,
      not_matching_interests: false,
    },
    status: "pending",
    user_feedback: null,
    created_at: "2024-06-01T00:00:00Z",
    resolved_at: null,
    item_name: "Resistor 10k",
    item_quantity: 100,
    item_quantity_unit: "pcs",
    item_price: "0.01",
    item_category_name: "Components",
    item_location_name: "Shelf A",
    last_used_at: null,
  },
];

export const testNotificationPreferences: NotificationPreferences = {
  email_notifications_enabled: true,
  low_stock_email_enabled: true,
};

export const testNotificationPreferencesDisabled: NotificationPreferences = {
  email_notifications_enabled: false,
  low_stock_email_enabled: false,
};

export const testFacets: FacetsResponse = {
  facets: [
    {
      name: "category",
      label: "Category",
      values: [
        { value: "Electronics", count: 5 },
        { value: "Components", count: 3 },
      ],
    },
    {
      name: "location",
      label: "Location",
      values: [
        { value: "Workshop", count: 8 },
        { value: "Shelf A", count: 5 },
      ],
    },
    {
      name: "tags",
      label: "Tags",
      values: [
        { value: "resistor", count: 10 },
        { value: "capacitor", count: 5 },
        { value: "microcontroller", count: 3 },
      ],
    },
  ],
  total_items: 100,
};

export const testSimilarItems: SimilarItemsResponse = {
  similar_items: [
    {
      id: "similar-1",
      name: "Arduino Uno Clone",
      description: "Compatible Arduino clone",
      quantity: 2,
      quantity_unit: "pcs",
      similarity_score: 0.85,
      match_reasons: ["Similar name", "Same category"],
      category: testCategories[0],
      location: testLocations[0],
      primary_image_url: "/api/v1/images/img-similar-1/file",
    },
    {
      id: "similar-2",
      name: "Arduino Nano",
      description: "Smaller Arduino board",
      quantity: 5,
      quantity_unit: "pcs",
      similarity_score: 0.65,
      match_reasons: ["Similar category"],
      category: testCategories[0],
      location: testLocations[1],
      primary_image_url: "/api/v1/images/img-similar-2/file",
    },
  ],
  total_searched: 50,
};
