/**
 * Central export for all MSW handlers.
 * These handlers provide default mock behavior for all API endpoints.
 */

import { authHandlers } from "./auth.handlers";
import { itemsHandlers } from "./items.handlers";
import { categoriesHandlers } from "./categories.handlers";
import { locationsHandlers } from "./locations.handlers";
import { billingHandlers } from "./billing.handlers";
import { imagesHandlers } from "./images.handlers";
import { adminHandlers } from "./admin.handlers";
import { aiHandlers } from "./ai.handlers";
import { gridfinityHandlers } from "./gridfinity.handlers";
import { collaborationHandlers } from "./collaboration.handlers";
import { notificationsHandlers } from "./notifications.handlers";

/**
 * All handlers combined.
 * Order matters for path matching - more specific handlers should come first.
 */
export const handlers = [
  ...authHandlers,
  ...itemsHandlers,
  ...categoriesHandlers,
  ...locationsHandlers,
  ...billingHandlers,
  ...imagesHandlers,
  ...adminHandlers,
  ...aiHandlers,
  ...gridfinityHandlers,
  ...collaborationHandlers,
  ...notificationsHandlers,
];

// Re-export individual handler groups for targeted overrides
export {
  authHandlers,
  itemsHandlers,
  categoriesHandlers,
  locationsHandlers,
  billingHandlers,
  imagesHandlers,
  adminHandlers,
  aiHandlers,
  gridfinityHandlers,
  collaborationHandlers,
  notificationsHandlers,
};
