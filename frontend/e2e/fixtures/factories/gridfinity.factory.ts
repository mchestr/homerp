/**
 * Gridfinity factory for generating test storage unit data.
 */

export interface GridfinityUnit {
  id: string;
  name: string;
  description: string;
  location_id: string | null;
  container_width_mm: number;
  container_depth_mm: number;
  container_height_mm: number;
  grid_columns: number;
  grid_rows: number;
  created_at: string;
  updated_at: string;
}

let unitCounter = 0;

export function createGridfinityUnit(
  overrides: Partial<GridfinityUnit> = {}
): GridfinityUnit {
  unitCounter++;
  const width = overrides.container_width_mm || 252;
  const depth = overrides.container_depth_mm || 252;
  return {
    id: `gf-unit-${unitCounter}`,
    name: `Storage Unit ${unitCounter}`,
    description: `Gridfinity storage unit ${unitCounter}`,
    location_id: null,
    container_width_mm: width,
    container_depth_mm: depth,
    container_height_mm: 50,
    grid_columns: Math.floor(width / 42),
    grid_rows: Math.floor(depth / 42),
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function resetGridfinityFactory(): void {
  unitCounter = 0;
}

// Pre-built fixtures
export const testGridfinityUnits: GridfinityUnit[] = [
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
