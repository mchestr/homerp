/**
 * Item factory for generating test item data.
 */

import { Category, testCategories } from "./category.factory";
import { Location, testLocations } from "./location.factory";

export interface ItemSpecification {
  key: string;
  value: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  quantity: number;
  quantity_unit: string;
  is_low_stock: boolean;
  tags: string[];
  category: Category | null;
  location: Location | null;
  primary_image_url: string | null;
  attributes: { specifications?: ItemSpecification[] };
  created_at: string;
  updated_at: string;
}

export interface ItemDetail extends Item {
  category_id: string | null;
  location_id: string | null;
  min_quantity: number;
  ai_classification: Record<string, unknown>;
}

export interface ItemImage {
  id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  content_hash: string;
  is_primary: boolean;
  item_id: string | null;
  location_id: string | null;
  created_at: string;
}

export interface ItemWithImages extends ItemDetail {
  images: ItemImage[];
}

export interface PaginatedItems {
  items: Item[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

let itemCounter = 0;

export function createItem(overrides: Partial<Item> = {}): Item {
  itemCounter++;
  const name = overrides.name || `Item ${itemCounter}`;
  return {
    id: `item-${itemCounter}`,
    name,
    description: `Description for ${name}`,
    quantity: 1,
    quantity_unit: "pcs",
    is_low_stock: false,
    tags: [],
    category: null,
    location: null,
    primary_image_url: null,
    attributes: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createItemDetail(
  overrides: Partial<ItemDetail> = {}
): ItemDetail {
  const item = createItem(overrides);
  return {
    ...item,
    category_id: item.category?.id || null,
    location_id: item.location?.id || null,
    min_quantity: 1,
    ai_classification: {},
    ...overrides,
  };
}

export function createItemImage(overrides: Partial<ItemImage> = {}): ItemImage {
  const id = overrides.id || `img-${Date.now()}`;
  return {
    id,
    storage_path: `/uploads/${id}.jpg`,
    original_filename: `${id}.jpg`,
    mime_type: "image/jpeg",
    size_bytes: 102400,
    content_hash: `hash-${id}`,
    is_primary: false,
    item_id: null,
    location_id: null,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createPaginatedItems(
  items: Item[],
  overrides: Partial<Omit<PaginatedItems, "items">> = {}
): PaginatedItems {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 20,
    total_pages: Math.ceil(items.length / 20) || 1,
    ...overrides,
  };
}

export function resetItemFactory(): void {
  itemCounter = 0;
}

// Pre-built fixtures
export const testItems: Item[] = [
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

export const testItemDetail: ItemDetail = {
  ...testItems[0],
  category_id: "cat-1",
  location_id: "loc-1",
  min_quantity: 1,
  attributes: {},
  ai_classification: {},
};

export const testItemImages: ItemImage[] = [
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

export const testItemWithImages: ItemWithImages = {
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

export const testImageUpload: ItemImage = {
  id: "img-1",
  storage_path: "/uploads/test-image.jpg",
  original_filename: "test-image.jpg",
  mime_type: "image/jpeg",
  size_bytes: 102400,
  content_hash: "abc123",
  is_primary: false,
  item_id: null,
  location_id: null,
  created_at: "2024-01-01T00:00:00Z",
};

export const testLocationImage: ItemImage = {
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
