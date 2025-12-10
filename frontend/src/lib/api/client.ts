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
};

// Images API
export const imagesApi = {
  upload: (file: File) =>
    uploadFile("/api/v1/images/upload", file) as Promise<ImageUpload>,

  classify: (imageId: string) =>
    apiRequest<ClassificationResponse>("/api/v1/images/classify", {
      method: "POST",
      body: { image_id: imageId },
    }),

  get: (id: string) => apiRequest<Image>(`/api/v1/images/${id}`),

  getFileUrl: (id: string) => `${getApiBaseUrl()}/api/v1/images/${id}/file`,

  delete: (id: string) =>
    apiRequest<void>(`/api/v1/images/${id}`, { method: "DELETE" }),

  attachToItem: (imageId: string, itemId: string, isPrimary?: boolean) =>
    apiRequest<Image>(
      `/api/v1/images/${imageId}/attach/${itemId}${isPrimary ? "?is_primary=true" : ""}`,
      { method: "POST" }
    ),
};

// Types
export type User = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
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
  children: LocationTreeNode[];
};

export type LocationCreate = {
  name: string;
  description?: string;
  location_type?: string;
  parent_id?: string;
};

export type LocationUpdate = Partial<LocationCreate>;

export type ItemListItem = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  quantity_unit: string;
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
  attributes?: Record<string, unknown>;
  tags?: string[];
  image_ids?: string[];
};

export type ItemUpdate = Partial<ItemCreate>;

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

export type AdminStats = {
  total_users: number;
  total_items: number;
  total_revenue_cents: number;
  active_credit_packs: number;
  total_credits_purchased: number;
  total_credits_used: number;
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
};
