/**
 * Category factory for generating test category data.
 */

export interface AttributeField {
  name: string;
  label: string;
  type: string;
  unit?: string;
  options?: string[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  parent_id: string | null;
  path: string;
  attribute_template: { fields: AttributeField[] };
  created_at: string;
}

export interface CategoryTreeNode extends Omit<
  Category,
  "parent_id" | "created_at"
> {
  item_count: number;
  children: CategoryTreeNode[];
}

let categoryCounter = 0;

export function createCategory(overrides: Partial<Category> = {}): Category {
  categoryCounter++;
  const name = overrides.name || `Category ${categoryCounter}`;
  return {
    id: `cat-${categoryCounter}`,
    name,
    icon: "Folder",
    description: `Description for ${name}`,
    parent_id: null,
    path: name,
    attribute_template: { fields: [] },
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createCategoryTreeNode(
  overrides: Partial<CategoryTreeNode> = {}
): CategoryTreeNode {
  const category = createCategory(overrides);
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    description: category.description,
    path: category.path,
    attribute_template: category.attribute_template,
    item_count: 0,
    children: [],
    ...overrides,
  };
}

export function resetCategoryFactory(): void {
  categoryCounter = 0;
}

// Pre-built fixtures
export const testCategories: Category[] = [
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

export const testCategoryTree: CategoryTreeNode[] = [
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
