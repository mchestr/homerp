/**
 * Test data fixtures for e2e tests.
 * These represent realistic mock API responses.
 */

export const testUser = {
  id: "test-user-123",
  email: "test@example.com",
  name: "Test User",
  avatar_url: null,
  oauth_provider: "google",
  is_admin: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

export const adminUser = {
  id: "admin-user-456",
  email: "admin@example.com",
  name: "Admin User",
  avatar_url: null,
  oauth_provider: "google",
  is_admin: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

export const sharedInventoryOwner = {
  id: "shared-owner-789",
  email: "shared@example.com",
  name: "Shared Owner",
  avatar_url: null,
};

export const testCollaborationContext = {
  own_inventory: {
    id: testUser.id,
    name: testUser.name,
    email: testUser.email,
    avatar_url: testUser.avatar_url,
  },
  shared_inventories: [
    {
      id: "collab-1",
      owner_id: sharedInventoryOwner.id,
      role: "editor" as const,
      status: "accepted" as const,
      accepted_at: "2024-01-15T00:00:00Z",
      owner: sharedInventoryOwner,
    },
  ],
  pending_invitations: [],
};

export const testCollaborationContextViewer = {
  own_inventory: {
    id: testUser.id,
    name: testUser.name,
    email: testUser.email,
    avatar_url: testUser.avatar_url,
  },
  shared_inventories: [
    {
      id: "collab-2",
      owner_id: sharedInventoryOwner.id,
      role: "viewer" as const,
      status: "accepted" as const,
      accepted_at: "2024-01-15T00:00:00Z",
      owner: sharedInventoryOwner,
    },
  ],
  pending_invitations: [],
};

export const testCollaborationContextEmpty = {
  own_inventory: {
    id: testUser.id,
    name: testUser.name,
    email: testUser.email,
    avatar_url: testUser.avatar_url,
  },
  shared_inventories: [],
  pending_invitations: [],
};

export const testCategories = [
  {
    id: "cat-1",
    name: "Electronics",
    icon: "Cpu",
    description: "Electronic devices",
    parent_id: null,
    path: "Electronics",
    attribute_template: { fields: [] },
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "cat-2",
    name: "Components",
    icon: "Chip",
    description: "Electronic components",
    parent_id: "cat-1",
    path: "Electronics.Components",
    attribute_template: {
      fields: [
        { name: "voltage", label: "Voltage", type: "number", unit: "V" },
        {
          name: "package",
          label: "Package",
          type: "select",
          options: ["SMD", "THT"],
        },
      ],
    },
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "cat-3",
    name: "Filament",
    icon: "Spooler",
    description: "3D printing filament",
    parent_id: null,
    path: "Filament",
    attribute_template: {
      fields: [
        { name: "type", label: "Type", type: "text" },
        { name: "color", label: "Color", type: "text" },
        { name: "diameter", label: "Diameter", type: "text" },
      ],
    },
    created_at: "2024-01-01T00:00:00Z",
  },
];

export const testCategoryTree = [
  {
    id: "cat-1",
    name: "Electronics",
    icon: "Cpu",
    description: "Electronic devices",
    path: "Electronics",
    attribute_template: { fields: [] },
    item_count: 5,
    children: [
      {
        id: "cat-2",
        name: "Components",
        icon: "Chip",
        description: "Electronic components",
        path: "Electronics.Components",
        attribute_template: {
          fields: [
            { name: "voltage", label: "Voltage", type: "number", unit: "V" },
            {
              name: "package",
              label: "Package",
              type: "select",
              options: ["SMD", "THT"],
            },
          ],
        },
        item_count: 3,
        children: [],
      },
    ],
  },
];

export const testLocations = [
  {
    id: "loc-1",
    name: "Workshop",
    description: "Main workshop",
    location_type: "room",
    parent_id: null,
    path: "Workshop",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "loc-2",
    name: "Shelf A",
    description: "First shelf",
    location_type: "shelf",
    parent_id: "loc-1",
    path: "Workshop.Shelf_A",
    created_at: "2024-01-01T00:00:00Z",
  },
];

export const testLocationTree = [
  {
    id: "loc-1",
    name: "Workshop",
    description: "Main workshop",
    location_type: "room",
    path: "Workshop",
    item_count: 10,
    children: [
      {
        id: "loc-2",
        name: "Shelf A",
        description: "First shelf",
        location_type: "shelf",
        path: "Workshop.Shelf_A",
        item_count: 5,
        children: [],
      },
    ],
  },
];

export const testItems = [
  {
    id: "item-1",
    name: "Arduino Uno",
    description: "Microcontroller board",
    quantity: 3,
    quantity_unit: "pcs",
    is_low_stock: false,
    tags: ["microcontroller", "arduino"],
    category: testCategories[0],
    location: testLocations[0],
    primary_image_url: null,
    attributes: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "item-2",
    name: "Resistor 10k",
    description: "10k ohm resistor",
    quantity: 100,
    quantity_unit: "pcs",
    is_low_stock: false,
    tags: ["resistor", "passive"],
    category: testCategories[1],
    location: testLocations[1],
    primary_image_url: null,
    attributes: {
      specifications: [
        { key: "voltage", value: "5V" },
        { key: "package", value: "SMD" },
      ],
    },
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "item-3",
    name: "Capacitor 100uF",
    description: "Electrolytic capacitor",
    quantity: 2,
    quantity_unit: "pcs",
    is_low_stock: true,
    tags: ["capacitor", "passive"],
    category: testCategories[1],
    location: testLocations[1],
    primary_image_url: null,
    attributes: {
      specifications: [
        { key: "voltage", value: "25V" },
        { key: "package", value: "THT" },
      ],
    },
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "item-4",
    name: "PLA Filament",
    description: "Blue PLA 3D printing filament",
    quantity: 5,
    quantity_unit: "rolls",
    is_low_stock: false,
    tags: ["3d-printing", "filament"],
    category: testCategories[2],
    location: testLocations[0],
    primary_image_url: null,
    attributes: {
      specifications: [
        { key: "type", value: "PLA" },
        { key: "color", value: "Blue" },
        { key: "diameter", value: "1.75mm" },
      ],
    },
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

export const testItemDetail = {
  ...testItems[0],
  category_id: "cat-1",
  location_id: "loc-1",
  min_quantity: 1,
  attributes: {},
  ai_classification: {},
};

export const testCreditBalance = {
  purchased_credits: 10,
  free_credits: 5,
  total_credits: 15,
  next_free_reset_at: "2025-02-01T00:00:00Z",
};

export const testCreditBalanceZero = {
  purchased_credits: 0,
  free_credits: 0,
  total_credits: 0,
  next_free_reset_at: "2025-02-01T00:00:00Z",
};

export const testCreditPacks = [
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

export const testCreditTransactions = [
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

export const testClassificationResult = {
  success: true,
  classification: {
    identified_name: "Arduino Uno R3",
    confidence: 0.95,
    category_path: "Electronics.Microcontrollers",
    description: "Arduino Uno microcontroller board based on ATmega328P",
    specifications: [
      { key: "microcontroller", value: "ATmega328P" },
      { key: "operating_voltage", value: "5V" },
      { key: "digital_io_pins", value: 14 },
      { key: "analog_input_pins", value: 6 },
    ],
    alternative_suggestions: [
      { name: "Arduino Nano", confidence: 0.1 },
      { name: "Arduino Mega", confidence: 0.05 },
    ],
    quantity_estimate: "1 piece",
  },
  create_item_prefill: {
    name: "Arduino Uno R3",
    description: "Arduino Uno microcontroller board based on ATmega328P",
    quantity: 1,
    quantity_unit: "pcs",
    tags: ["arduino", "microcontroller"],
  },
};

export const testImageUpload = {
  id: "img-1",
  storage_path: "/uploads/test-image.jpg",
  original_filename: "test-image.jpg",
  mime_type: "image/jpeg",
  size_bytes: 102400,
  content_hash: "abc123",
  created_at: "2024-01-01T00:00:00Z",
};

export const testItemImages = [
  {
    id: "item-img-1",
    storage_path: "/uploads/item-image-1.jpg",
    original_filename: "item-image-1.jpg",
    mime_type: "image/jpeg",
    size_bytes: 102400,
    content_hash: "hash1",
    is_primary: true,
    item_id: "item-with-images",
    location_id: null,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "item-img-2",
    storage_path: "/uploads/item-image-2.jpg",
    original_filename: "item-image-2.jpg",
    mime_type: "image/jpeg",
    size_bytes: 102400,
    content_hash: "hash2",
    is_primary: false,
    item_id: "item-with-images",
    location_id: null,
    created_at: "2024-01-02T00:00:00Z",
  },
  {
    id: "item-img-3",
    storage_path: "/uploads/item-image-3.jpg",
    original_filename: "item-image-3.jpg",
    mime_type: "image/jpeg",
    size_bytes: 102400,
    content_hash: "hash3",
    is_primary: false,
    item_id: "item-with-images",
    location_id: null,
    created_at: "2024-01-03T00:00:00Z",
  },
];

export const testItemWithImages = {
  id: "item-with-images",
  name: "Test Item with Images",
  description: "Item for testing primary image functionality",
  quantity: 5,
  quantity_unit: "pcs",
  is_low_stock: false,
  tags: ["test"],
  category: testCategories[0],
  location: testLocations[0],
  category_id: "cat-1",
  location_id: "loc-1",
  min_quantity: 1,
  primary_image_url: null,
  attributes: {},
  ai_classification: {},
  images: testItemImages,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

export const testLocationImage = {
  id: "loc-img-1",
  storage_path: "/uploads/location-image.jpg",
  original_filename: "location-image.jpg",
  mime_type: "image/jpeg",
  size_bytes: 102400,
  content_hash: "def456",
  location_id: "loc-1",
  item_id: null,
  is_primary: true,
  created_at: "2024-01-01T00:00:00Z",
};

export const testAdminStats = {
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
      type: "signup" as const,
      title: "New user registered",
      description: "Welcome to HomERP!",
      user_email: "newuser@example.com",
      user_name: "New User",
      timestamp: "2024-06-20T10:30:00Z",
      metadata: {},
    },
    {
      id: "activity-2",
      type: "feedback" as const,
      title: "Bug report submitted",
      description: "Unable to upload images",
      user_email: "user@example.com",
      user_name: "John Doe",
      timestamp: "2024-06-20T09:15:00Z",
      metadata: { status: "pending" },
    },
    {
      id: "activity-3",
      type: "purchase" as const,
      title: "Credit pack purchased",
      description: "Standard Pack - 100 credits",
      user_email: "buyer@example.com",
      user_name: "Jane Smith",
      timestamp: "2024-06-19T14:22:00Z",
      metadata: { pack_name: "Standard Pack", credits: 100 },
    },
  ],
};

export const testAdminUsers = [
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

export const testAdminPacks = [
  {
    id: "pack-1",
    name: "Starter Pack",
    credits: 25,
    price_cents: 300,
    stripe_price_id: "price_starter",
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
    is_active: true,
    sort_order: 2,
    created_at: "2024-01-01T00:00:00Z",
  },
];

export const testAdminFeedback = [
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

export const testFacets = {
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

export const testSimilarItems = {
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

// Declutter test data
export const testDeclutterCost = {
  total_items: 25,
  items_to_analyze: 25,
  credits_required: 1,
  items_per_credit: 50,
  has_sufficient_credits: true,
  user_credit_balance: 15,
  has_profile: true,
};

export const testDeclutterCostFewItems = {
  total_items: 15,
  items_to_analyze: 15,
  credits_required: 1,
  items_per_credit: 50,
  has_sufficient_credits: true,
  user_credit_balance: 15,
  has_profile: true,
};

export const testDeclutterRecommendations = [
  {
    id: "rec-1",
    user_id: "test-user-123",
    item_id: "item-2",
    reason:
      "You have 100 of these resistors but haven't used them in over 6 months.",
    confidence: 0.85,
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
    item_price: 0.01,
    item_category_name: "Components",
    item_location_name: "Shelf A",
    last_used_at: null,
  },
];

// Gridfinity test data
export const testGridfinityUnits = [
  {
    id: "gf-unit-1",
    name: "Workshop Drawer",
    description: "Main workshop drawer with gridfinity baseplate",
    location_id: "loc-1",
    container_width_mm: 252,
    container_depth_mm: 252,
    container_height_mm: 50,
    grid_columns: 6,
    grid_rows: 6,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "gf-unit-2",
    name: "Electronics Tray",
    description: "Small tray for electronics components",
    location_id: "loc-2",
    container_width_mm: 168,
    container_depth_mm: 126,
    container_height_mm: 42,
    grid_columns: 4,
    grid_rows: 3,
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
  },
];

// Admin pricing test data
export const testAdminPricing = [
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

// Notification preferences test data
export const testNotificationPreferences = {
  email_notifications_enabled: true,
  low_stock_email_enabled: true,
};

export const testNotificationPreferencesDisabled = {
  email_notifications_enabled: false,
  low_stock_email_enabled: false,
};

// Admin API Keys test data
export const testAdminApiKeys = [
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

export const testApiKeyCreatedResponse = {
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

// Admin AI Model Settings test data
export const testAIModelSettings = [
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

// AI Assistant Session test data
export const testAISessions = [
  {
    id: "session-1",
    title: "Organizing garage tools",
    message_count: 5,
    is_active: true,
    created_at: "2024-06-19T10:00:00Z",
    updated_at: "2024-06-19T10:15:00Z",
  },
  {
    id: "session-2",
    title: "Electronics inventory help",
    message_count: 3,
    is_active: true,
    created_at: "2024-06-18T14:30:00Z",
    updated_at: "2024-06-18T14:45:00Z",
  },
  {
    id: "session-3",
    title: "Kitchen storage ideas",
    message_count: 8,
    is_active: true,
    created_at: "2024-06-17T09:20:00Z",
    updated_at: "2024-06-17T10:00:00Z",
  },
];

export const testAISessionMessages = [
  {
    id: "msg-1",
    session_id: "session-1",
    role: "user" as const,
    content: "How should I organize my garage tools?",
    created_at: "2024-06-19T10:00:00Z",
  },
  {
    id: "msg-2",
    session_id: "session-1",
    role: "assistant" as const,
    content:
      "I'd recommend organizing your garage tools by frequency of use and category. Here are some tips:\n\n1. Wall-mounted pegboards for frequently used tools\n2. Labeled bins for small items\n3. Heavy-duty shelving for power tools\n\nWould you like me to search your inventory for specific tool categories?",
    tool_calls: [
      {
        id: "call-1",
        type: "function" as const,
        function: {
          name: "search_items",
          arguments: '{"query":"tools","category":"garage"}',
        },
      },
    ],
    created_at: "2024-06-19T10:01:00Z",
  },
  {
    id: "msg-3",
    session_id: "session-1",
    role: "user" as const,
    content: "Yes, show me my power tools",
    created_at: "2024-06-19T10:05:00Z",
  },
  {
    id: "msg-4",
    session_id: "session-1",
    role: "assistant" as const,
    content:
      "I found 3 power tools in your inventory:\n- [Cordless Drill](/items/item-1)\n- [Circular Saw](/items/item-2)\n- [Angle Grinder](/items/item-3)\n\nThese would be great candidates for wall-mounted storage or a dedicated power tool cabinet.",
    tool_calls: [
      {
        id: "call-2",
        type: "function" as const,
        function: {
          name: "list_items",
          arguments: '{"category":"Power Tools","limit":10}',
        },
      },
    ],
    created_at: "2024-06-19T10:06:00Z",
  },
];

export const testAISessionDetail = {
  id: "session-1",
  title: "Organizing garage tools",
  message_count: 5,
  is_active: true,
  created_at: "2024-06-19T10:00:00Z",
  updated_at: "2024-06-19T10:15:00Z",
  messages: testAISessionMessages.filter((m) => m.session_id === "session-1"),
};

export const testAIChatResponse = {
  session_id: "session-1",
  new_messages: [
    {
      id: "msg-new-user",
      session_id: "session-1",
      role: "user" as const,
      content: "What's in my garage?",
      created_at: new Date().toISOString(),
    },
    {
      id: "msg-new-assistant",
      session_id: "session-1",
      role: "assistant" as const,
      content:
        "Based on your inventory, your garage contains:\n- 15 power tools\n- 32 hand tools\n- 8 gardening items\n- Various hardware and supplies",
      tool_calls: [
        {
          id: "call-3",
          type: "function" as const,
          function: {
            name: "search_items",
            arguments: '{"location":"Garage"}',
          },
        },
      ],
      created_at: new Date().toISOString(),
    },
  ],
  tools_used: ["search_items"],
  credits_used: 1,
};

export const testOperationCosts = {
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
