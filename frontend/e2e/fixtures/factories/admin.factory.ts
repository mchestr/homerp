/**
 * Admin factory for generating test admin panel data.
 */

export interface ActivityItem {
  id: string;
  type: "signup" | "feedback" | "purchase";
  title: string;
  description: string;
  user_email: string;
  user_name: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface AdminStats {
  total_users: number;
  total_items: number;
  total_revenue_cents: number;
  active_credit_packs: number;
  total_credits_purchased: number;
  total_credits_used: number;
  recent_signups_7d: number;
  pending_feedback_count: number;
  recent_activity: ActivityItem[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_admin: boolean;
  credit_balance: number;
  free_credits_remaining: number;
  created_at: string;
}

export interface AdminFeedback {
  id: string;
  subject: string;
  message: string;
  feedback_type: string;
  status: string;
  user_id: string;
  user_email: string;
  user_name: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminPricing {
  id: string;
  operation_type: string;
  credits_per_operation: number;
  display_name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminAIModelSettings {
  id: string;
  operation_type: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  display_name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface AdminApiKeyCreated extends AdminApiKey {
  key: string;
}

// Pre-built fixtures
export const testAdminStats: AdminStats = {
  total_users: 150,
  total_items: 5000,
  total_revenue_cents: 250000,
  active_credit_packs: 3,
  total_credits_purchased: 10000,
  total_credits_used: 7500,
  recent_signups_7d: 12,
  pending_feedback_count: 3,
  recent_activity: [
    {
      id: "activity-1",
      type: "signup",
      title: "New user registered",
      description: "Welcome to HomERP!",
      user_email: "newuser@example.com",
      user_name: "New User",
      timestamp: "2024-06-20T10:30:00Z",
      metadata: {},
    },
    {
      id: "activity-2",
      type: "feedback",
      title: "Bug report submitted",
      description: "Unable to upload images",
      user_email: "user@example.com",
      user_name: "John Doe",
      timestamp: "2024-06-20T09:15:00Z",
      metadata: { status: "pending" },
    },
    {
      id: "activity-3",
      type: "purchase",
      title: "Credit pack purchased",
      description: "Standard Pack - 100 credits",
      user_email: "buyer@example.com",
      user_name: "Jane Smith",
      timestamp: "2024-06-19T14:22:00Z",
      metadata: { pack_name: "Standard Pack", credits: 100 },
    },
  ],
};

export const testAdminUsers: AdminUser[] = [
  {
    id: "user-1",
    email: "user1@example.com",
    name: "User One",
    avatar_url: null,
    is_admin: false,
    credit_balance: 50,
    free_credits_remaining: 5,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-2",
    email: "user2@example.com",
    name: "User Two",
    avatar_url: null,
    is_admin: false,
    credit_balance: 10,
    free_credits_remaining: 0,
    created_at: "2024-02-01T00:00:00Z",
  },
];

export const testAdminFeedback: AdminFeedback[] = [
  {
    id: "feedback-1",
    subject: "Cannot upload images",
    message: "I'm getting an error when trying to upload images to items.",
    feedback_type: "bug",
    status: "pending",
    user_id: "user-1",
    user_email: "user1@example.com",
    user_name: "User One",
    admin_notes: null,
    created_at: "2024-06-20T10:00:00Z",
    updated_at: "2024-06-20T10:00:00Z",
  },
  {
    id: "feedback-2",
    subject: "Feature request: bulk import",
    message: "Would love to see a CSV import feature for items.",
    feedback_type: "feature",
    status: "in_progress",
    user_id: "user-2",
    user_email: "user2@example.com",
    user_name: "User Two",
    admin_notes: "Working on this for v2",
    created_at: "2024-06-15T14:30:00Z",
    updated_at: "2024-06-18T09:00:00Z",
  },
  {
    id: "feedback-3",
    subject: "How to use AI classification?",
    message: "I'm not sure how to use the AI classification feature.",
    feedback_type: "question",
    status: "resolved",
    user_id: "user-1",
    user_email: "user1@example.com",
    user_name: "User One",
    admin_notes: "Sent documentation link",
    created_at: "2024-06-10T08:00:00Z",
    updated_at: "2024-06-10T12:00:00Z",
  },
];

export const testAdminPricing: AdminPricing[] = [
  {
    id: "pricing-1",
    operation_type: "image_classification",
    credits_per_operation: 1,
    display_name: "Image Classification",
    description: "AI-powered image classification and metadata extraction",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "pricing-2",
    operation_type: "location_suggestion",
    credits_per_operation: 1,
    display_name: "Location Suggestions",
    description: "AI-powered location organization suggestions",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "pricing-3",
    operation_type: "declutter_analysis",
    credits_per_operation: 1,
    display_name: "Declutter Analysis",
    description: "AI analysis of items to identify declutter opportunities",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "pricing-4",
    operation_type: "category_suggestion",
    credits_per_operation: 0,
    display_name: "Category Suggestions",
    description: "AI-powered category suggestions for items",
    is_active: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

export const testAIModelSettings: AdminAIModelSettings[] = [
  {
    id: "ai-settings-1",
    operation_type: "image_classification",
    model_name: "gpt-4o",
    temperature: 0.3,
    max_tokens: 2000,
    display_name: "Image Classification",
    description: "AI-powered image analysis and metadata extraction",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-06-15T10:30:00Z",
  },
  {
    id: "ai-settings-2",
    operation_type: "location_suggestion",
    model_name: "gpt-4o-mini",
    temperature: 0.5,
    max_tokens: 1500,
    display_name: "Location Suggestions",
    description: "AI-powered location organization recommendations",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-06-10T14:20:00Z",
  },
  {
    id: "ai-settings-3",
    operation_type: "assistant_query",
    model_name: "gpt-4o",
    temperature: 0.7,
    max_tokens: 3000,
    display_name: "AI Assistant",
    description: "AI-powered assistant for inventory queries",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-06-12T09:15:00Z",
  },
  {
    id: "ai-settings-4",
    operation_type: "location_analysis",
    model_name: "gpt-4o",
    temperature: 0.4,
    max_tokens: 2500,
    display_name: "Location Analysis",
    description: "AI analysis of location images",
    is_active: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-05-20T16:45:00Z",
  },
];

export const testAdminApiKeys: AdminApiKey[] = [
  {
    id: "key-1",
    name: "GitHub Actions",
    key_prefix: "homerp_live_abc",
    scopes: ["feedback:read", "feedback:write"],
    is_active: true,
    last_used_at: "2024-06-15T10:30:00Z",
    expires_at: "2025-12-31T23:59:59Z",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "key-2",
    name: "Monitoring Service",
    key_prefix: "homerp_live_xyz",
    scopes: ["admin:*"],
    is_active: true,
    last_used_at: null,
    expires_at: null,
    created_at: "2024-03-15T00:00:00Z",
  },
  {
    id: "key-3",
    name: "Deprecated Integration",
    key_prefix: "homerp_live_old",
    scopes: ["feedback:read"],
    is_active: false,
    last_used_at: "2024-02-01T08:00:00Z",
    expires_at: "2024-06-01T00:00:00Z",
    created_at: "2023-12-01T00:00:00Z",
  },
];

export const testApiKeyCreatedResponse: AdminApiKeyCreated = {
  id: "key-new-123",
  name: "New Test API Key",
  key: "homerp_live_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  key_prefix: "homerp_live_aBc",
  scopes: ["feedback:read", "feedback:write"],
  is_active: true,
  last_used_at: null,
  expires_at: "2025-12-31T23:59:59Z",
  created_at: new Date().toISOString(),
};
