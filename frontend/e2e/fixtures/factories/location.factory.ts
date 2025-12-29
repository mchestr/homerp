/**
 * Location factory for generating test location data.
 */

export interface Location {
  id: string;
  name: string;
  description: string;
  location_type: string;
  parent_id: string | null;
  path: string;
  created_at: string;
}

export interface LocationTreeNode extends Omit<
  Location,
  "parent_id" | "created_at"
> {
  item_count: number;
  children: LocationTreeNode[];
}

export interface LocationWithAncestors extends Location {
  ancestors: Location[];
}

let locationCounter = 0;

export function createLocation(overrides: Partial<Location> = {}): Location {
  locationCounter++;
  const name = overrides.name || `Location ${locationCounter}`;
  return {
    id: `loc-${locationCounter}`,
    name,
    description: `Description for ${name}`,
    location_type: "room",
    parent_id: null,
    path: name,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createLocationTreeNode(
  overrides: Partial<LocationTreeNode> = {}
): LocationTreeNode {
  const location = createLocation(overrides);
  return {
    id: location.id,
    name: location.name,
    description: location.description,
    location_type: location.location_type,
    path: location.path,
    item_count: 0,
    children: [],
    ...overrides,
  };
}

export function resetLocationFactory(): void {
  locationCounter = 0;
}

// Pre-built fixtures
export const testLocations: Location[] = [
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

export const testLocationTree: LocationTreeNode[] = [
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
