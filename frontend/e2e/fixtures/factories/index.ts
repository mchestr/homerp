/**
 * Central export for all test data factories.
 * Import from this file to access all factories and pre-built fixtures.
 */

// Import reset functions for use in resetAllFactories()
import { resetUserFactory } from "./user.factory";
import { resetCategoryFactory } from "./category.factory";
import { resetLocationFactory } from "./location.factory";
import { resetItemFactory } from "./item.factory";
import { resetAIFactory } from "./ai.factory";
import { resetGridfinityFactory } from "./gridfinity.factory";

// User factories and fixtures
export {
  createUser,
  createAdminUser,
  createAdminUserWithCredits,
  resetUserFactory,
  testUser,
  adminUser,
  sharedInventoryOwner,
  type User,
  type AdminUser,
} from "./user.factory";

// Category factories and fixtures
export {
  createCategory,
  createCategoryTreeNode,
  resetCategoryFactory,
  testCategories,
  testCategoryTree,
  type Category,
  type CategoryTreeNode,
  type AttributeField,
} from "./category.factory";

// Location factories and fixtures
export {
  createLocation,
  createLocationTreeNode,
  resetLocationFactory,
  testLocations,
  testLocationTree,
  type Location,
  type LocationTreeNode,
  type LocationWithAncestors,
} from "./location.factory";

// Item factories and fixtures
export {
  createItem,
  createItemDetail,
  createItemImage,
  createPaginatedItems,
  resetItemFactory,
  testItems,
  testItemDetail,
  testItemImages,
  testItemWithImages,
  testImageUpload,
  testLocationImage,
  type Item,
  type ItemDetail,
  type ItemImage,
  type ItemWithImages,
  type ItemSpecification,
  type PaginatedItems,
} from "./item.factory";

// Billing factories and fixtures
export {
  createCreditBalance,
  createCreditPack,
  testCreditBalance,
  testCreditBalanceZero,
  testCreditPacks,
  testAdminPacks,
  testCreditTransactions,
  testOperationCosts,
  type CreditBalance,
  type CreditPack,
  type AdminCreditPack,
  type CreditTransaction,
  type OperationCosts,
  type PaginatedTransactions,
} from "./billing.factory";

// Collaboration factories and fixtures
export {
  createCollaborationContext,
  createSharedInventory,
  testCollaborationContext,
  testCollaborationContextViewer,
  testCollaborationContextEmpty,
  type CollaborationContext,
  type SharedInventory,
  type InventoryOwner,
} from "./collaboration.factory";

// Admin factories and fixtures
export {
  testAdminStats,
  testAdminUsers,
  testAdminFeedback,
  testAdminPricing,
  testAIModelSettings,
  testAdminApiKeys,
  testApiKeyCreatedResponse,
  type AdminStats,
  type AdminUser as AdminUserDetail,
  type AdminFeedback,
  type AdminPricing,
  type AdminAIModelSettings,
  type AdminApiKey,
  type AdminApiKeyCreated,
  type ActivityItem,
} from "./admin.factory";

// AI factories and fixtures
export {
  createAISession,
  createAIMessage,
  resetAIFactory,
  testAISessions,
  testAISessionMessages,
  testAISessionDetail,
  testAIChatResponse,
  testClassificationResult,
  type AISession,
  type AIMessage,
  type AISessionWithMessages,
  type AIChatResponse,
  type ToolCall,
  type ClassificationResult,
  type PaginatedSessions,
} from "./ai.factory";

// Gridfinity factories and fixtures
export {
  createGridfinityUnit,
  resetGridfinityFactory,
  testGridfinityUnits,
  type GridfinityUnit,
} from "./gridfinity.factory";

// Misc factories and fixtures
export {
  createDeclutterCost,
  createNotificationPreferences,
  testDeclutterCost,
  testDeclutterCostFewItems,
  testDeclutterRecommendations,
  testNotificationPreferences,
  testNotificationPreferencesDisabled,
  testFacets,
  testSimilarItems,
  type DeclutterCost,
  type DeclutterRecommendation,
  type NotificationPreferences,
  type FacetsResponse,
  type Facet,
  type FacetValue,
  type SimilarItem,
  type SimilarItemsResponse,
} from "./misc.factory";

/**
 * Reset all factory counters.
 * Call this in test setup if you need predictable IDs.
 */
export function resetAllFactories(): void {
  // Import and call reset functions (already exported above)
  resetUserFactory();
  resetCategoryFactory();
  resetLocationFactory();
  resetItemFactory();
  resetAIFactory();
  resetGridfinityFactory();
}
