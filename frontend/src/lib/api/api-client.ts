// Runtime-configurable API URL
// In production Docker, window.__ENV__ is set by __env.js at container startup
function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = (window as unknown as { __ENV__?: { API_URL?: string } })
      .__ENV__?.API_URL;
    if (envUrl) return envUrl;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const token = await getAuthToken();

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.detail || `Request failed with status ${response.status}`
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function uploadFile(
  endpoint: string,
  file: File
): Promise<unknown> {
  const token = await getAuthToken();

  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.detail || `Upload failed with status ${response.status}`
    );
  }

  return response.json();
}

// Auth API
export const authApi = {
  getGoogleAuthUrl: (redirectUri: string) =>
    apiRequest<{ authorization_url: string }>(
      `/api/v1/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`
    ),

  handleGoogleCallback: (code: string, redirectUri: string) =>
    apiRequest<{
      token: { access_token: string; expires_in: number };
      user: User;
    }>(
      `/api/v1/auth/callback/google?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`
    ),

  getCurrentUser: () => apiRequest<User>("/api/v1/auth/me"),

  refreshToken: () =>
    apiRequest<{ access_token: string; expires_in: number }>(
      "/api/v1/auth/refresh",
      { method: "POST" }
    ),

  updateSettings: (settings: UserSettingsUpdate) =>
    apiRequest<User>("/api/v1/auth/settings", {
      method: "PATCH",
      body: settings,
    }),
};

// Items API
export const itemsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    category_id?: string;
    include_subcategories?: boolean;
    location_id?: string;
    include_sublocations?: boolean;
    no_category?: boolean;
    no_location?: boolean;
    search?: string;
    tags?: string[];
    attributes?: Record<string, string>;
    low_stock?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.category_id)
      searchParams.set("category_id", params.category_id);
    if (params?.include_subcategories === false)
      searchParams.set("include_subcategories", "false");
    if (params?.location_id)
      searchParams.set("location_id", params.location_id);
    if (params?.include_sublocations === false)
      searchParams.set("include_sublocations", "false");
    if (params?.no_category) searchParams.set("no_category", "true");
    if (params?.no_location) searchParams.set("no_location", "true");
    if (params?.search) searchParams.set("search", params.search);
    if (params?.tags) {
      params.tags.forEach((tag) => searchParams.append("tags", tag));
    }
    if (params?.attributes) {
      Object.entries(params.attributes).forEach(([key, value]) => {
        searchParams.append("attr", `${key}:${value}`);
      });
    }
    if (params?.low_stock) searchParams.set("low_stock", "true");
    const query = searchParams.toString();
    return apiRequest<PaginatedResponse<ItemListItem>>(
      `/api/v1/items${query ? `?${query}` : ""}`
    );
  },

  get: (id: string) => apiRequest<ItemDetail>(`/api/v1/items/${id}`),

  create: (data: ItemCreate) =>
    apiRequest<ItemDetail>("/api/v1/items", { method: "POST", body: data }),

  update: (id: string, data: ItemUpdate) =>
    apiRequest<ItemDetail>(`/api/v1/items/${id}`, {
      method: "PUT",
      body: data,
    }),

  updateQuantity: (id: string, quantity: number) =>
    apiRequest<ItemDetail>(`/api/v1/items/${id}/quantity`, {
      method: "PATCH",
      body: { quantity },
    }),

  delete: (id: string) =>
    apiRequest<void>(`/api/v1/items/${id}`, { method: "DELETE" }),

  search: (q: string, limit?: number) => {
    const params = new URLSearchParams({ q });
    if (limit) params.set("limit", limit.toString());
    return apiRequest<ItemListItem[]>(`/api/v1/items/search?${params}`);
  },

  lowStock: () => apiRequest<ItemListItem[]>("/api/v1/items/low-stock"),

  facets: (params?: {
    category_id?: string;
    include_subcategories?: boolean;
    location_id?: string;
    include_sublocations?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.category_id)
      searchParams.set("category_id", params.category_id);
    if (params?.include_subcategories === false)
      searchParams.set("include_subcategories", "false");
    if (params?.location_id)
      searchParams.set("location_id", params.location_id);
    if (params?.include_sublocations === false)
      searchParams.set("include_sublocations", "false");
    const query = searchParams.toString();
    return apiRequest<FacetedSearchResponse>(
      `/api/v1/items/facets${query ? `?${query}` : ""}`
    );
  },

  tags: (limit?: number) => {
    const params = limit ? `?limit=${limit}` : "";
    return apiRequest<FacetValue[]>(`/api/v1/items/tags${params}`);
  },

  dashboardStats: (days: number = 30) =>
    apiRequest<DashboardStatsResponse>(
      `/api/v1/items/stats/dashboard?days=${days}`
    ),

  // Check-in/out operations
  checkOut: (id: string, data: CheckInOutCreate = {}) =>
    apiRequest<CheckInOutResponse>(`/api/v1/items/${id}/check-out`, {
      method: "POST",
      body: data,
    }),

  checkIn: (id: string, data: CheckInOutCreate = {}) =>
    apiRequest<CheckInOutResponse>(`/api/v1/items/${id}/check-in`, {
      method: "POST",
      body: data,
    }),

  getHistory: (id: string, page = 1, limit = 20) =>
    apiRequest<PaginatedResponse<CheckInOutResponse>>(
      `/api/v1/items/${id}/history?page=${page}&limit=${limit}`
    ),

  getUsageStats: (id: string) =>
    apiRequest<ItemUsageStats>(`/api/v1/items/${id}/usage-stats`),

  getMostUsed: (limit = 5) =>
    apiRequest<MostUsedItem[]>(`/api/v1/items/stats/most-used?limit=${limit}`),

  getRecentlyUsed: (limit = 5) =>
    apiRequest<RecentlyUsedItem[]>(
      `/api/v1/items/stats/recently-used?limit=${limit}`
    ),

  findSimilar: (data: FindSimilarRequest) =>
    apiRequest<FindSimilarResponse>("/api/v1/items/find-similar", {
      method: "POST",
      body: data,
    }),

  batchUpdate: (data: BatchUpdateRequest) =>
    apiRequest<BatchUpdateResponse>("/api/v1/items/batch", {
      method: "PATCH",
      body: data,
    }),
};

// Categories API
export const categoriesApi = {
  list: () => apiRequest<Category[]>("/api/v1/categories"),

  tree: () => apiRequest<CategoryTreeNode[]>("/api/v1/categories/tree"),

  get: (id: string) => apiRequest<Category>(`/api/v1/categories/${id}`),

  getTemplate: (id: string) =>
    apiRequest<MergedAttributeTemplate>(`/api/v1/categories/${id}/template`),

  getDescendants: (id: string) =>
    apiRequest<Category[]>(`/api/v1/categories/${id}/descendants`),

  create: (data: CategoryCreate) =>
    apiRequest<Category>("/api/v1/categories", { method: "POST", body: data }),

  createFromPath: (path: string) =>
    apiRequest<Category>("/api/v1/categories/from-path", {
      method: "POST",
      body: { path },
    }),

  update: (id: string, data: CategoryUpdate) =>
    apiRequest<Category>(`/api/v1/categories/${id}`, {
      method: "PUT",
      body: data,
    }),

  move: (id: string, newParentId: string | null) =>
    apiRequest<Category>(`/api/v1/categories/${id}/move`, {
      method: "PATCH",
      body: { new_parent_id: newParentId },
    }),

  delete: (id: string) =>
    apiRequest<void>(`/api/v1/categories/${id}`, { method: "DELETE" }),
};

// Locations API
export const locationsApi = {
  list: () => apiRequest<Location[]>("/api/v1/locations"),

  tree: () => apiRequest<LocationTreeNode[]>("/api/v1/locations/tree"),

  get: (id: string) => apiRequest<Location>(`/api/v1/locations/${id}`),

  getWithAncestors: (id: string) =>
    apiRequest<LocationWithAncestors>(`/api/v1/locations/${id}/with-ancestors`),

  getQrCodeUrl: (id: string, size?: number) => {
    const params = size ? `?size=${size}` : "";
    return `${getApiBaseUrl()}/api/v1/locations/${id}/qr${params}`;
  },

  getDescendants: (id: string) =>
    apiRequest<Location[]>(`/api/v1/locations/${id}/descendants`),

  create: (data: LocationCreate) =>
    apiRequest<Location>("/api/v1/locations", { method: "POST", body: data }),

  update: (id: string, data: LocationUpdate) =>
    apiRequest<Location>(`/api/v1/locations/${id}`, {
      method: "PUT",
      body: data,
    }),

  move: (id: string, newParentId: string | null) =>
    apiRequest<Location>(`/api/v1/locations/${id}/move`, {
      method: "PATCH",
      body: { new_parent_id: newParentId },
    }),

  delete: (id: string) =>
    apiRequest<void>(`/api/v1/locations/${id}`, { method: "DELETE" }),

  analyzeImage: (imageId: string) =>
    apiRequest<LocationAnalysisResponse>("/api/v1/locations/analyze-image", {
      method: "POST",
      body: { image_id: imageId },
    }),

  createBulk: (data: LocationBulkCreate) =>
    apiRequest<LocationBulkCreateResponse>("/api/v1/locations/bulk", {
      method: "POST",
      body: data,
    }),
};

// Images API
export const imagesApi = {
  upload: (file: File) =>
    uploadFile("/api/v1/images/upload", file) as Promise<ImageUpload>,

  classify: (imageId: string, customPrompt?: string) =>
    apiRequest<ClassificationResponse>("/api/v1/images/classify", {
      method: "POST",
      body: { image_id: imageId, custom_prompt: customPrompt || null },
    }),

  get: (id: string) => apiRequest<Image>(`/api/v1/images/${id}`),

  getSignedUrl: (id: string, thumbnail?: boolean) =>
    apiRequest<{ url: string }>(
      `/api/v1/images/${id}/signed-url${thumbnail ? "?thumbnail=true" : ""}`
    ),

  delete: (id: string) =>
    apiRequest<void>(`/api/v1/images/${id}`, { method: "DELETE" }),

  attachToItem: (imageId: string, itemId: string, isPrimary?: boolean) =>
    apiRequest<Image>(
      `/api/v1/images/${imageId}/attach/${itemId}${isPrimary ? "?is_primary=true" : ""}`,
      { method: "POST" }
    ),

  listClassified: (page = 1, limit = 12, search?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.set("search", search);
    return apiRequest<PaginatedResponse<Image>>(
      `/api/v1/images/classified?${params}`
    );
  },
};

// Types
export type User = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  currency: string;
  language: string;
  created_at: string;
  updated_at: string;
};

export type UserSettingsUpdate = {
  currency?: string;
  language?: string;
};

export type AttributeField = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  options?: string[];
  required?: boolean;
  default?: string | number | boolean;
  unit?: string;
};

export type AttributeTemplate = {
  fields: AttributeField[];
};

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  parent_id: string | null;
  path: string;
  attribute_template: AttributeTemplate;
  created_at: string;
};

export type CategoryTreeNode = {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  path: string;
  attribute_template: AttributeTemplate;
  item_count: number;
  total_value: number;
  children: CategoryTreeNode[];
};

export type MergedAttributeTemplate = {
  fields: AttributeField[];
  inherited_from: string[];
};

export type CategoryCreate = {
  name: string;
  icon?: string;
  description?: string;
  parent_id?: string;
  attribute_template?: AttributeTemplate;
};

export type CategoryUpdate = Partial<CategoryCreate>;

export type Location = {
  id: string;
  name: string;
  description: string | null;
  location_type: string | null;
  parent_id: string | null;
  path: string;
  created_at: string;
};

export type LocationTreeNode = {
  id: string;
  name: string;
  description: string | null;
  location_type: string | null;
  path: string;
  item_count: number;
  total_value: number;
  children: LocationTreeNode[];
};

export type LocationWithAncestors = Location & {
  ancestors: Location[];
};

export type LocationCreate = {
  name: string;
  description?: string;
  location_type?: string;
  parent_id?: string;
};

export type LocationUpdate = Partial<LocationCreate>;

export type LocationSuggestion = {
  name: string;
  location_type: string;
  description: string | null;
};

export type LocationAnalysisResult = {
  parent: LocationSuggestion;
  children: LocationSuggestion[];
  confidence: number;
  reasoning: string;
};

export type LocationAnalysisResponse = {
  success: boolean;
  result?: LocationAnalysisResult;
  error?: string;
};

export type LocationBulkCreate = {
  parent: LocationCreate;
  children: LocationCreate[];
};

export type LocationBulkCreateResponse = {
  parent: Location;
  children: Location[];
};

export type ItemListItem = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  quantity_unit: string;
  price: number | null;
  is_low_stock: boolean;
  tags: string[];
  category: Category | null;
  location: Location | null;
  primary_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ItemDetail = ItemListItem & {
  category_id: string | null;
  location_id: string | null;
  min_quantity: number | null;
  attributes: Record<string, unknown>;
  ai_classification: Record<string, unknown>;
};

export type ItemCreate = {
  name: string;
  description?: string;
  category_id?: string;
  location_id?: string;
  quantity?: number;
  quantity_unit?: string;
  min_quantity?: number;
  price?: number;
  attributes?: Record<string, unknown>;
  tags?: string[];
  image_ids?: string[];
};

export type ItemUpdate = Partial<ItemCreate>;

export type BatchUpdateRequest = {
  item_ids: string[];
  category_id?: string | null;
  location_id?: string | null;
  clear_category?: boolean;
  clear_location?: boolean;
};

export type BatchUpdateResponse = {
  updated_count: number;
  item_ids: string[];
};

export type FacetValue = {
  value: string;
  count: number;
};

export type Facet = {
  name: string;
  label: string;
  values: FacetValue[];
};

export type FacetedSearchResponse = {
  facets: Facet[];
  total_items: number;
};

export type TimeSeriesDataPoint = {
  date: string;
  count: number;
};

export type CategoryDistribution = {
  name: string;
  count: number;
};

export type LocationDistribution = {
  name: string;
  count: number;
};

export type DashboardStatsResponse = {
  items_over_time: TimeSeriesDataPoint[];
  items_by_category: CategoryDistribution[];
  items_by_location: LocationDistribution[];
  total_items: number;
  total_quantity: number;
  categories_used: number;
  locations_used: number;
};

// Check-in/out types
export type CheckInOutCreate = {
  quantity?: number;
  notes?: string;
  occurred_at?: string;
};

export type CheckInOutResponse = {
  id: string;
  item_id: string;
  action_type: "check_in" | "check_out";
  quantity: number;
  notes: string | null;
  occurred_at: string;
  created_at: string;
};

export type ItemUsageStats = {
  total_check_outs: number;
  total_check_ins: number;
  total_quantity_out: number;
  total_quantity_in: number;
  last_check_out: string | null;
  last_check_in: string | null;
  currently_checked_out: number;
};

export type MostUsedItem = {
  id: string;
  name: string;
  total_check_outs: number;
  primary_image_url: string | null;
};

export type RecentlyUsedItem = {
  id: string;
  name: string;
  last_used: string;
  action_type: "check_in" | "check_out";
  primary_image_url: string | null;
};

// Similar items types
export type FindSimilarRequest = {
  identified_name: string;
  category_path?: string;
  specifications?: Record<string, unknown>;
  limit?: number;
};

export type SimilarItemMatch = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  quantity_unit: string;
  similarity_score: number;
  match_reasons: string[];
  category: Category | null;
  location: Location | null;
  primary_image_url: string | null;
};

export type FindSimilarResponse = {
  similar_items: SimilarItemMatch[];
  total_searched: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type ImageUpload = {
  id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type Image = ImageUpload & {
  item_id: string | null;
  is_primary: boolean;
  ai_processed: boolean;
  ai_result: Record<string, unknown> | null;
};

export type ClassificationResult = {
  identified_name: string;
  confidence: number;
  category_path: string;
  description: string;
  specifications: Record<string, unknown>;
  alternative_suggestions?: Array<{ name: string; confidence: number }>;
  quantity_estimate?: string;
};

export type ClassificationResponse = {
  success: boolean;
  classification?: ClassificationResult;
  error?: string;
  create_item_prefill?: Record<string, unknown>;
};

// Billing Types
export type CreditBalance = {
  purchased_credits: number;
  free_credits: number;
  total_credits: number;
  next_free_reset_at: string | null;
};

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string;
  is_best_value: boolean;
};

export type CreditTransaction = {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  is_refunded: boolean;
  created_at: string;
  credit_pack: CreditPack | null;
};

export type CheckoutResponse = {
  checkout_url: string;
};

export type PortalResponse = {
  portal_url: string;
};

export type RefundResponse = {
  success: boolean;
  message: string;
  refunded_credits: number;
};

// Billing API
export const billingApi = {
  getBalance: () => apiRequest<CreditBalance>("/api/v1/billing/balance"),

  getPacks: () => apiRequest<CreditPack[]>("/api/v1/billing/packs"),

  createCheckout: (packId: string) =>
    apiRequest<CheckoutResponse>("/api/v1/billing/checkout", {
      method: "POST",
      body: { pack_id: packId },
    }),

  getTransactions: (page = 1, limit = 20) =>
    apiRequest<PaginatedResponse<CreditTransaction>>(
      `/api/v1/billing/transactions?page=${page}&limit=${limit}`
    ),

  createPortalSession: () =>
    apiRequest<PortalResponse>("/api/v1/billing/portal", { method: "POST" }),

  requestRefund: (transactionId: string) =>
    apiRequest<RefundResponse>("/api/v1/billing/refund", {
      method: "POST",
      body: { transaction_id: transactionId },
    }),
};

// Admin Types
export type CreditPackAdmin = {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type CreditPackCreate = {
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string;
  is_active?: boolean;
  sort_order?: number;
};

export type CreditPackUpdate = Partial<CreditPackCreate>;

export type UserAdmin = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  credit_balance: number;
  free_credits_remaining: number;
  created_at: string;
};

export type UserAdminUpdate = {
  is_admin: boolean;
};

export type RecentActivityItem = {
  id: string;
  type: "signup" | "feedback" | "purchase" | "credit_usage";
  title: string;
  description: string | null;
  user_email: string | null;
  user_name: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type AdminStats = {
  total_users: number;
  total_items: number;
  total_revenue_cents: number;
  active_credit_packs: number;
  total_credits_purchased: number;
  total_credits_used: number;
  recent_signups_7d: number;
  pending_feedback_count: number;
  recent_activity: RecentActivityItem[];
};

// Admin API
export const adminApi = {
  // Credit Packs
  listPacks: () => apiRequest<CreditPackAdmin[]>("/api/v1/admin/packs"),

  getPack: (id: string) =>
    apiRequest<CreditPackAdmin>(`/api/v1/admin/packs/${id}`),

  createPack: (data: CreditPackCreate) =>
    apiRequest<CreditPackAdmin>("/api/v1/admin/packs", {
      method: "POST",
      body: data,
    }),

  updatePack: (id: string, data: CreditPackUpdate) =>
    apiRequest<CreditPackAdmin>(`/api/v1/admin/packs/${id}`, {
      method: "PUT",
      body: data,
    }),

  deletePack: (id: string) =>
    apiRequest<void>(`/api/v1/admin/packs/${id}`, { method: "DELETE" }),

  // Users
  listUsers: (page = 1, limit = 20, search?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.set("search", search);
    return apiRequest<PaginatedResponse<UserAdmin>>(
      `/api/v1/admin/users?${params}`
    );
  },

  getUser: (id: string) => apiRequest<UserAdmin>(`/api/v1/admin/users/${id}`),

  updateUser: (id: string, data: UserAdminUpdate) =>
    apiRequest<UserAdmin>(`/api/v1/admin/users/${id}`, {
      method: "PUT",
      body: data,
    }),

  // Stats
  getStats: () => apiRequest<AdminStats>("/api/v1/admin/stats"),

  // Credit adjustment
  adjustUserCredits: (userId: string, data: CreditAdjustment) =>
    apiRequest<CreditAdjustmentResponse>(
      `/api/v1/admin/users/${userId}/credits`,
      {
        method: "POST",
        body: data,
      }
    ),

  // Feedback
  listFeedback: (
    page = 1,
    limit = 20,
    status?: string,
    feedbackType?: string
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) params.set("status", status);
    if (feedbackType) params.set("feedback_type", feedbackType);
    return apiRequest<PaginatedResponse<FeedbackAdminResponse>>(
      `/api/v1/feedback/admin?${params}`
    );
  },

  getFeedback: (id: string) =>
    apiRequest<FeedbackAdminResponse>(`/api/v1/feedback/admin/${id}`),

  updateFeedback: (id: string, data: FeedbackAdminUpdate) =>
    apiRequest<FeedbackAdminResponse>(`/api/v1/feedback/admin/${id}`, {
      method: "PUT",
      body: data,
    }),

  deleteFeedback: (id: string) =>
    apiRequest<void>(`/api/v1/feedback/admin/${id}`, { method: "DELETE" }),

  retriggerFeedbackWebhook: (id: string) =>
    apiRequest<{ message: string }>(
      `/api/v1/feedback/admin/${id}/retrigger-webhook`,
      {
        method: "POST",
      }
    ),
};

// Feedback Types
export type FeedbackCreate = {
  subject: string;
  message: string;
  feedback_type?: string;
};

export type FeedbackResponse = {
  id: string;
  subject: string;
  message: string;
  feedback_type: string;
  status: string;
  created_at: string;
};

export type FeedbackAdminResponse = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  subject: string;
  message: string;
  feedback_type: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FeedbackAdminUpdate = {
  status?: string;
  admin_notes?: string;
};

export type CreditAdjustment = {
  amount: number;
  free_credits_amount: number;
  reason: string;
};

export type CreditAdjustmentResponse = {
  user_id: string;
  amount: number;
  free_credits_amount: number;
  new_balance: number;
  new_free_credits: number;
  reason: string;
};

// Feedback API
export const feedbackApi = {
  submit: (data: FeedbackCreate) =>
    apiRequest<FeedbackResponse>("/api/v1/feedback", {
      method: "POST",
      body: data,
    }),

  list: (page = 1, limit = 20) =>
    apiRequest<FeedbackResponse[]>(
      `/api/v1/feedback?page=${page}&limit=${limit}`
    ),
};

// Webhook Types
export type WebhookConfig = {
  id: string;
  event_type: string;
  url: string;
  http_method: string;
  headers: Record<string, string>;
  body_template: string | null;
  is_active: boolean;
  retry_count: number;
  timeout_seconds: number;
  created_at: string;
  updated_at: string;
};

export type WebhookConfigCreate = {
  event_type: string;
  url: string;
  http_method?: string;
  headers?: Record<string, string>;
  body_template?: string;
  is_active?: boolean;
  retry_count?: number;
  timeout_seconds?: number;
};

export type WebhookConfigUpdate = Partial<
  Omit<WebhookConfigCreate, "event_type">
>;

export type WebhookExecution = {
  id: string;
  webhook_config_id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  request_url: string;
  request_headers: Record<string, string>;
  request_body: string;
  response_status: number | null;
  response_body: string | null;
  status: "pending" | "success" | "failed" | "retrying";
  attempt_number: number;
  error_message: string | null;
  executed_at: string;
  completed_at: string | null;
};

export type EventTypeInfo = {
  value: string;
  label: string;
  variables: string[];
};

export type WebhookTestResponse = {
  success: boolean;
  status_code: number | null;
  response_body: string | null;
  error: string | null;
};

// Webhooks API
export const webhooksApi = {
  listEventTypes: () =>
    apiRequest<EventTypeInfo[]>("/api/v1/webhooks/event-types"),

  listConfigs: () => apiRequest<WebhookConfig[]>("/api/v1/webhooks/configs"),

  getConfig: (id: string) =>
    apiRequest<WebhookConfig>(`/api/v1/webhooks/configs/${id}`),

  createConfig: (data: WebhookConfigCreate) =>
    apiRequest<WebhookConfig>("/api/v1/webhooks/configs", {
      method: "POST",
      body: data,
    }),

  updateConfig: (id: string, data: WebhookConfigUpdate) =>
    apiRequest<WebhookConfig>(`/api/v1/webhooks/configs/${id}`, {
      method: "PUT",
      body: data,
    }),

  deleteConfig: (id: string) =>
    apiRequest<void>(`/api/v1/webhooks/configs/${id}`, { method: "DELETE" }),

  testConfig: (id: string, testPayload?: Record<string, unknown>) =>
    apiRequest<WebhookTestResponse>(`/api/v1/webhooks/configs/${id}/test`, {
      method: "POST",
      body: { test_payload: testPayload || {} },
    }),

  listExecutions: (
    page = 1,
    limit = 20,
    configId?: string,
    eventType?: string,
    status?: string
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (configId) params.set("config_id", configId);
    if (eventType) params.set("event_type", eventType);
    if (status) params.set("status", status);
    return apiRequest<PaginatedResponse<WebhookExecution>>(
      `/api/v1/webhooks/executions?${params}`
    );
  },
};

// Profile Types
export type UserSystemProfile = {
  id: string;
  user_id: string;
  hobby_types: string[];
  interest_category_ids: string[];
  retention_months: number;
  min_quantity_threshold: number;
  min_value_keep: number | null;
  profile_description: string | null;
  purge_aggressiveness: "conservative" | "moderate" | "aggressive";
  created_at: string;
  updated_at: string;
};

export type UserSystemProfileCreate = {
  hobby_types?: string[];
  interest_category_ids?: string[];
  retention_months?: number;
  min_quantity_threshold?: number;
  min_value_keep?: number | null;
  profile_description?: string | null;
  purge_aggressiveness?: "conservative" | "moderate" | "aggressive";
};

export type UserSystemProfileUpdate = Partial<UserSystemProfileCreate>;

export type HobbyTypesResponse = {
  hobby_types: string[];
};

export type PurgeRecommendation = {
  id: string;
  user_id: string;
  item_id: string;
  reason: string;
  confidence: number;
  factors: Record<string, boolean>;
  status: "pending" | "accepted" | "dismissed" | "expired";
  user_feedback: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type PurgeRecommendationWithItem = PurgeRecommendation & {
  item_name: string;
  item_quantity: number;
  item_quantity_unit: string;
  item_price: number | null;
  item_category_name: string | null;
  item_location_name: string | null;
  last_used_at: string | null;
};

export type PurgeRecommendationUpdate = {
  status: "accepted" | "dismissed";
  user_feedback?: string;
};

export type GenerateRecommendationsRequest = {
  max_recommendations?: number;
};

export type GenerateRecommendationsResponse = {
  recommendations: PurgeRecommendationWithItem[];
  total_generated: number;
  credits_used: number;
};

// API Key Types
export type ApiKeyResponse = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
};

export type ApiKeyCreatedResponse = {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

export type ApiKeyCreate = {
  name: string;
  scopes: string[];
  expires_at?: string | null;
};

export type ApiKeyUpdate = {
  name?: string;
  scopes?: string[];
  is_active?: boolean;
};

// API Keys API
export const apiKeysApi = {
  list: (page = 1, limit = 20) =>
    apiRequest<PaginatedResponse<ApiKeyResponse>>(
      `/api/v1/admin/apikeys?page=${page}&limit=${limit}`
    ),

  get: (id: string) =>
    apiRequest<ApiKeyResponse>(`/api/v1/admin/apikeys/${id}`),

  create: (data: ApiKeyCreate) =>
    apiRequest<ApiKeyCreatedResponse>("/api/v1/admin/apikeys", {
      method: "POST",
      body: data,
    }),

  update: (id: string, data: ApiKeyUpdate) =>
    apiRequest<ApiKeyResponse>(`/api/v1/admin/apikeys/${id}`, {
      method: "PATCH",
      body: data,
    }),

  delete: (id: string) =>
    apiRequest<void>(`/api/v1/admin/apikeys/${id}`, { method: "DELETE" }),
};

// Profile API
export const profileApi = {
  getHobbyTypes: () =>
    apiRequest<HobbyTypesResponse>("/api/v1/profile/hobby-types"),

  getProfile: () => apiRequest<UserSystemProfile | null>("/api/v1/profile/me"),

  createProfile: (data: UserSystemProfileCreate) =>
    apiRequest<UserSystemProfile>("/api/v1/profile/me", {
      method: "POST",
      body: data,
    }),

  updateProfile: (data: UserSystemProfileUpdate) =>
    apiRequest<UserSystemProfile>("/api/v1/profile/me", {
      method: "PATCH",
      body: data,
    }),

  getRecommendations: (limit = 50) =>
    apiRequest<PurgeRecommendationWithItem[]>(
      `/api/v1/profile/recommendations?limit=${limit}`
    ),

  generateRecommendations: (data?: GenerateRecommendationsRequest) =>
    apiRequest<GenerateRecommendationsResponse>(
      "/api/v1/profile/recommendations/generate",
      {
        method: "POST",
        body: data || {},
      }
    ),

  updateRecommendation: (id: string, data: PurgeRecommendationUpdate) =>
    apiRequest<PurgeRecommendation>(`/api/v1/profile/recommendations/${id}`, {
      method: "PATCH",
      body: data,
    }),

  dismissRecommendation: (id: string) =>
    apiRequest<void>(`/api/v1/profile/recommendations/${id}`, {
      method: "DELETE",
    }),
};
