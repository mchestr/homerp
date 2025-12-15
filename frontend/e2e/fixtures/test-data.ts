/**
 * Test data fixtures for e2e tests.
 * These represent realistic mock API responses.
 */

export const testUser = {
  id: "test-user-123",
  email: "test@example.com",
  name: "Test User",
  avatar_url: null,
  is_admin: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

export const adminUser = {
  id: "admin-user-456",
  email: "admin@example.com",
  name: "Admin User",
  avatar_url: null,
  is_admin: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
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
    specifications: {
      microcontroller: "ATmega328P",
      operating_voltage: "5V",
      digital_io_pins: 14,
      analog_input_pins: 6,
    },
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
