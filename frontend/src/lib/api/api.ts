/**
 * API Client Module
 *
 * This module provides an ergonomic API interface using the auto-generated SDK.
 * It wraps the generated SDK functions with a cleaner API shape (e.g., itemsApi.list())
 * while using the configured client from client-setup.ts.
 *
 * IMPORTANT: Ensure client-setup.ts is imported before using this module
 * (already done in providers.tsx).
 */

// Re-export client configuration utilities
export { setInventoryContext, getInventoryContext } from "./client-setup";

// =============================================================================
// Import generated SDK functions
// =============================================================================

import {
  // Auth
  listProvidersApiV1AuthProvidersGet,
  getAuthUrlApiV1AuthProviderGet,
  oauthCallbackApiV1AuthCallbackProviderGet,
  getCurrentUserInfoApiV1AuthMeGet,
  refreshTokenApiV1AuthRefreshPost,
  updateUserSettingsApiV1AuthSettingsPatch,
  // Items
  listItemsApiV1ItemsGet,
  getItemApiV1ItemsItemIdGet,
  createItemApiV1ItemsPost,
  updateItemApiV1ItemsItemIdPut,
  updateItemQuantityApiV1ItemsItemIdQuantityPatch,
  deleteItemApiV1ItemsItemIdDelete,
  searchItemsApiV1ItemsSearchGet,
  listLowStockItemsApiV1ItemsLowStockGet,
  getItemFacetsApiV1ItemsFacetsGet,
  getAllTagsApiV1ItemsTagsGet,
  getDashboardStatsApiV1ItemsStatsDashboardGet,
  checkOutItemApiV1ItemsItemIdCheckOutPost,
  checkInItemApiV1ItemsItemIdCheckInPost,
  getItemHistoryApiV1ItemsItemIdHistoryGet,
  getItemUsageStatsApiV1ItemsItemIdUsageStatsGet,
  getMostUsedItemsApiV1ItemsStatsMostUsedGet,
  getRecentlyUsedItemsApiV1ItemsStatsRecentlyUsedGet,
  findSimilarItemsApiV1ItemsFindSimilarPost,
  batchUpdateItemsApiV1ItemsBatchPatch,
  batchCreateItemsApiV1ItemsBatchPost,
  suggestItemLocationApiV1ItemsSuggestLocationPost,
  // Categories
  listCategoriesApiV1CategoriesGet,
  getCategoryTreeApiV1CategoriesTreeGet,
  getCategoryApiV1CategoriesCategoryIdGet,
  getCategoryTemplateApiV1CategoriesCategoryIdTemplateGet,
  getCategoryDescendantsApiV1CategoriesCategoryIdDescendantsGet,
  createCategoryApiV1CategoriesPost,
  createCategoryFromPathApiV1CategoriesFromPathPost,
  updateCategoryApiV1CategoriesCategoryIdPut,
  moveCategoryApiV1CategoriesCategoryIdMovePatch,
  deleteCategoryApiV1CategoriesCategoryIdDelete,
  // Locations
  listLocationsApiV1LocationsGet,
  getLocationTreeApiV1LocationsTreeGet,
  getLocationApiV1LocationsLocationIdGet,
  getLocationWithAncestorsApiV1LocationsLocationIdWithAncestorsGet,
  getLocationQrSignedUrlApiV1LocationsLocationIdQrSignedUrlGet,
  getLocationDescendantsApiV1LocationsLocationIdDescendantsGet,
  createLocationApiV1LocationsPost,
  updateLocationApiV1LocationsLocationIdPut,
  moveLocationApiV1LocationsLocationIdMovePatch,
  deleteLocationApiV1LocationsLocationIdDelete,
  analyzeLocationImageApiV1LocationsAnalyzeImagePost,
  createLocationsBulkApiV1LocationsBulkPost,
  // Images
  uploadImageApiV1ImagesUploadPost,
  classifyImagesApiV1ImagesClassifyPost,
  getImageApiV1ImagesImageIdGet,
  getImageSignedUrlApiV1ImagesImageIdSignedUrlGet,
  deleteImageApiV1ImagesImageIdDelete,
  attachImageToItemApiV1ImagesImageIdAttachItemIdPost,
  listClassifiedImagesApiV1ImagesClassifiedGet,
  setImageAsPrimaryApiV1ImagesImageIdSetPrimaryPost,
  detachImageFromItemApiV1ImagesImageIdDetachPost,
  getImagesByLocationApiV1ImagesLocationLocationIdGet,
  attachImageToLocationApiV1ImagesImageIdAttachLocationLocationIdPost,
  setImageAsPrimaryForLocationApiV1ImagesImageIdSetPrimaryLocationPost,
  detachImageFromLocationApiV1ImagesImageIdDetachLocationPost,
  // Billing
  getBalanceApiV1BillingBalanceGet,
  listPacksApiV1BillingPacksGet,
  createCheckoutApiV1BillingCheckoutPost,
  listTransactionsApiV1BillingTransactionsGet,
  createPortalSessionApiV1BillingPortalPost,
  requestRefundApiV1BillingRefundPost,
  getOperationCostsApiV1BillingCostsGet,
  // Admin
  listPacksApiV1AdminPacksGet,
  getPackApiV1AdminPacksPackIdGet,
  createPackApiV1AdminPacksPost,
  updatePackApiV1AdminPacksPackIdPut,
  deletePackApiV1AdminPacksPackIdDelete,
  listPricingApiV1AdminPricingGet,
  getPricingApiV1AdminPricingPricingIdGet,
  updatePricingApiV1AdminPricingPricingIdPut,
  listAiModelSettingsApiV1AdminAiModelSettingsGet,
  getAiModelSettingsApiV1AdminAiModelSettingsSettingsIdGet,
  updateAiModelSettingsApiV1AdminAiModelSettingsSettingsIdPut,
  listUsersApiV1AdminUsersGet,
  getUserApiV1AdminUsersUserIdGet,
  updateUserApiV1AdminUsersUserIdPut,
  getStatsApiV1AdminStatsGet,
  getRevenueOverTimeApiV1AdminStatsRevenueGet,
  getSignupsOverTimeApiV1AdminStatsSignupsGet,
  getCreditActivityApiV1AdminStatsCreditsGet,
  getPackBreakdownApiV1AdminStatsPacksGet,
  getActivityFeedApiV1AdminActivityGet,
  adjustUserCreditsApiV1AdminUsersUserIdCreditsPost,
  listAllFeedbackApiV1FeedbackAdminGet,
  getFeedbackApiV1FeedbackAdminFeedbackIdGet,
  updateFeedbackApiV1FeedbackAdminFeedbackIdPut,
  deleteFeedbackApiV1FeedbackAdminFeedbackIdDelete,
  retriggerFeedbackWebhookApiV1FeedbackAdminFeedbackIdRetriggerWebhookPost,
  getAiUsageSummaryApiV1AdminAiUsageSummaryGet,
  getAiUsageByUserApiV1AdminAiUsageByUserGet,
  getAiUsageHistoryApiV1AdminAiUsageHistoryGet,
  getAiUsageDailyApiV1AdminAiUsageDailyGet,
  // Billing Settings
  listBillingSettingsApiV1AdminBillingSettingsGet,
  getBillingSettingApiV1AdminBillingSettingsSettingIdGet,
  updateBillingSettingApiV1AdminBillingSettingsSettingIdPut,
  // Feedback
  createFeedbackApiV1FeedbackPost,
  listMyFeedbackApiV1FeedbackGet,
  // Webhooks
  listEventTypesApiV1WebhooksEventTypesGet,
  listConfigsApiV1WebhooksConfigsGet,
  getConfigApiV1WebhooksConfigsConfigIdGet,
  createConfigApiV1WebhooksConfigsPost,
  updateConfigApiV1WebhooksConfigsConfigIdPut,
  deleteConfigApiV1WebhooksConfigsConfigIdDelete,
  testConfigApiV1WebhooksConfigsConfigIdTestPost,
  listExecutionsApiV1WebhooksExecutionsGet,
  // API Keys
  listApiKeysApiV1AdminApikeysGet,
  getApiKeyApiV1AdminApikeysApiKeyIdGet,
  createApiKeyApiV1AdminApikeysPost,
  updateApiKeyApiV1AdminApikeysApiKeyIdPatch,
  deleteApiKeyApiV1AdminApikeysApiKeyIdDelete,
  // Gridfinity
  listUnitsApiV1GridfinityUnitsGet,
  getUnitApiV1GridfinityUnitsUnitIdGet,
  getUnitLayoutApiV1GridfinityUnitsUnitIdLayoutGet,
  createUnitApiV1GridfinityUnitsPost,
  updateUnitApiV1GridfinityUnitsUnitIdPut,
  deleteUnitApiV1GridfinityUnitsUnitIdDelete,
  createPlacementApiV1GridfinityUnitsUnitIdPlacementsPost,
  updatePlacementApiV1GridfinityPlacementsPlacementIdPut,
  deletePlacementApiV1GridfinityPlacementsPlacementIdDelete,
  autoLayoutItemsApiV1GridfinityUnitsUnitIdAutoLayoutPost,
  recommendBinSizesApiV1GridfinityRecommendBinsPost,
  calculateGridApiV1GridfinityCalculateGridGet,
  // AI Assistant
  queryAssistantApiV1AiQueryPost,
  listSessionsApiV1AiSessionsGet,
  createSessionApiV1AiSessionsPost,
  getSessionApiV1AiSessionsSessionIdGet,
  updateSessionApiV1AiSessionsSessionIdPatch,
  deleteSessionApiV1AiSessionsSessionIdDelete,
  chatWithToolsApiV1AiChatPost,
  // Profile
  getHobbyTypesApiV1ProfileHobbyTypesGet,
  getMyProfileApiV1ProfileMeGet,
  createMyProfileApiV1ProfileMePost,
  updateMyProfileApiV1ProfileMePatch,
  getRecommendationsApiV1ProfileRecommendationsGet,
  generateRecommendationsApiV1ProfileRecommendationsGeneratePost,
  updateRecommendationApiV1ProfileRecommendationsRecommendationIdPatch,
  dismissRecommendationApiV1ProfileRecommendationsRecommendationIdDelete,
  getRecommendationsCostApiV1ProfileRecommendationsCostGet,
  // Notifications
  getNotificationPreferencesApiV1NotificationsPreferencesGet,
  updateNotificationPreferencesApiV1NotificationsPreferencesPut,
  // Collaboration
  getInventoryContextApiV1CollaborationContextGet,
  listCollaboratorsApiV1CollaborationCollaboratorsGet,
  inviteCollaboratorApiV1CollaborationCollaboratorsPost,
  removeCollaboratorApiV1CollaborationCollaboratorsCollaboratorIdDelete,
  updateCollaboratorApiV1CollaborationCollaboratorsCollaboratorIdPut,
  acceptInvitationApiV1CollaborationInvitationsAcceptPost,
  acceptInvitationByIdApiV1CollaborationInvitationsInvitationIdAcceptPost,
  declineInvitationApiV1CollaborationInvitationsInvitationIdDeclinePost,
  leaveSharedInventoryApiV1CollaborationSharedOwnerIdDelete,
} from "./sdk.gen";

// Import types we need to use within this file
import type {
  GridfinityUnitCreate,
  GridfinityUnitUpdate,
  GridfinityPlacementCreate,
  GridfinityPlacementUpdate,
  ItemCreate,
  ItemUpdate,
  BatchCreateRequest,
  LocationCreate,
  LocationUpdate,
  LocationBulkCreate,
  NotificationPreferencesUpdate,
  UserSystemProfileCreate,
  UserSystemProfileUpdate,
  UserSettingsUpdate,
  CheckInOutCreate,
  CategoryCreate,
  CategoryUpdate,
  CreditPackCreate,
  CreditPackUpdate,
  CreditPricingUpdate,
  UserAdminUpdate,
  CreditAdjustmentRequest,
  FeedbackAdminUpdate,
  WebhookConfigCreate,
  WebhookConfigUpdate,
  ApiKeyCreate,
  ApiKeyUpdate,
  CollaboratorRole,
  AiModelSettingsUpdate,
  SessionCreate,
  SessionUpdate,
  BillingSettingResponse,
  BillingSettingUpdate,
} from "./types.gen";

// BillingSetting type alias for backwards compatibility
export type BillingSetting = BillingSettingResponse;
export type { BillingSettingUpdate };

// =============================================================================
// Re-export types from generated types (with aliases for backwards compatibility)
// =============================================================================

// Core types
export type {
  UserResponse as User,
  UserSettingsUpdate,
  CategoryResponse as Category,
  CategoryCreate,
  CategoryUpdate,
  CategoryTreeNode,
  MergedAttributeTemplate,
  AttributeTemplate,
  AttributeField,
  LocationResponse as Location,
  LocationCreate,
  LocationUpdate,
  LocationTreeNode,
  LocationWithAncestors,
  LocationSuggestion,
  LocationAnalysisResult,
  LocationAnalysisResponse,
  LocationBulkCreate,
  LocationBulkCreateResponse,
  ItemListResponse as ItemListItem,
  ItemDetailResponse as ItemDetail,
  ItemCreate,
  ItemUpdate,
  BatchUpdateRequest,
  BatchUpdateResponse,
  BatchItemCreate,
  BatchCreateRequest,
  BatchItemResult,
  BatchCreateResponse,
  FacetValue,
  Facet,
  FacetedSearchResponse,
  SrcItemsSchemasTimeSeriesDataPoint as TimeSeriesDataPoint,
  CategoryDistribution,
  LocationDistribution,
  DashboardStatsResponse,
  CheckInOutCreate,
  CheckInOutResponse,
  ItemUsageStatsResponse as ItemUsageStats,
  MostUsedItemResponse as MostUsedItem,
  RecentlyUsedItemResponse as RecentlyUsedItem,
  FindSimilarRequest,
  SimilarItemMatch,
  FindSimilarResponse,
  ItemLocationSuggestionRequest,
  LocationSuggestionItem,
  ItemLocationSuggestionResponse,
  PaginatedResponseItemListResponse as PaginatedResponse,
  ImageUploadResponse as ImageUpload,
  ImageResponse as Image,
  ClassificationResult,
  ClassificationResponse,
  // Billing types
  CreditBalanceResponse as CreditBalance,
  CreditPackResponse as CreditPack,
  TransactionResponse as CreditTransaction,
  CheckoutResponse,
  PortalResponse,
  RefundResponse,
  OperationCostsResponse,
  // Admin types
  CreditPackAdminResponse as CreditPackAdmin,
  CreditPackCreate,
  CreditPackUpdate,
  CreditPricingResponse as CreditPricing,
  CreditPricingUpdate,
  AiModelSettingsResponse as AIModelSettings,
  AiModelSettingsUpdate as AIModelSettingsUpdate,
  UserAdminResponse as UserAdmin,
  UserAdminUpdate,
  RecentActivityItem,
  CreditAdjustmentRequest,
  AdminStatsResponse as AdminStats,
  SrcAdminSchemasTimeSeriesDataPoint as AdminTimeSeriesDataPoint,
  RevenueTimeSeriesResponse,
  SignupsTimeSeriesResponse,
  CreditActivityDataPoint,
  CreditActivityResponse,
  PackBreakdownItem,
  PackBreakdownResponse,
  PaginatedActivityResponse,
  CreditAdjustmentRequest as CreditAdjustment,
  CreditAdjustmentResponse,
  // Feedback types
  FeedbackCreate,
  FeedbackResponse,
  FeedbackAdminResponse,
  FeedbackAdminUpdate,
  // Webhook types
  WebhookConfigResponse as WebhookConfig,
  WebhookConfigCreate,
  WebhookConfigUpdate,
  WebhookExecutionResponse as WebhookExecution,
  EventTypeInfo,
  WebhookTestResponse,
  // Profile types
  UserSystemProfileResponse as UserSystemProfile,
  UserSystemProfileCreate,
  UserSystemProfileUpdate,
  HobbyTypesResponse,
  PurgeRecommendationWithItem,
  PurgeRecommendationResponse as PurgeRecommendation,
  PurgeRecommendationUpdate,
  GenerateRecommendationsRequest,
  GenerateRecommendationsResponse,
  DeclutterCostResponse,
  // API Key types
  ApiKeyResponse,
  ApiKeyCreatedResponse,
  ApiKeyCreate,
  ApiKeyUpdate,
  // Gridfinity types
  GridfinityUnitResponse as GridfinityUnit,
  GridfinityUnitCreate,
  GridfinityUnitUpdate,
  GridfinityPlacementResponse as GridfinityPlacement,
  GridfinityPlacementCreate,
  GridfinityPlacementUpdate,
  GridfinityUnitWithPlacementsResponse as GridfinityUnitWithPlacements,
  GridCalculation,
  AutoLayoutPlacement,
  AutoLayoutResult,
  BinRecommendation,
  BinRecommendationResponse,
  // AI Assistant types
  AssistantQueryRequest,
  AssistantQueryResponse,
  SessionCreate,
  SessionUpdate,
  SessionResponse,
  SessionDetailResponse,
  SessionListResponse,
  SessionMessageResponse,
  SessionQueryRequest,
  SessionQueryResponse,
  // AI Usage types
  OperationBreakdown,
  ModelBreakdown,
  AiUsageSummaryResponse as AIUsageSummary,
  AiUsageByUserResponse as AIUsageByUser,
  AiUsageLogResponse as AIUsageLog,
  DailyUsageResponse as DailyUsage,
  // Notification types
  NotificationPreferencesResponse as NotificationPreferences,
  NotificationPreferencesUpdate,
  // Collaboration types
  InventoryContextResponse as InventoryContext,
  CollaboratorResponse as Collaborator,
  CollaboratorInviteRequest,
  CollaboratorUpdateRequest,
  CollaboratorRole,
  CollaboratorUserInfo,
  CollaboratorOwnerInfo,
  SharedInventoryResponse as SharedInventory,
} from "./types.gen";

// Also export the OAuth provider type
export type OAuthProvider = {
  id: string;
  name: string;
  icon: string;
};

export type TimeRange = "7d" | "30d" | "90d";

// =============================================================================
// Auth API
// =============================================================================

export const authApi = {
  getProviders: () =>
    listProvidersApiV1AuthProvidersGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  getAuthUrl: (provider: string, redirectUri: string) =>
    getAuthUrlApiV1AuthProviderGet({
      path: { provider },
      query: { redirect_uri: redirectUri },
      throwOnError: true,
    }).then((res) => res.data),

  handleCallback: (provider: string, code: string, redirectUri: string) =>
    oauthCallbackApiV1AuthCallbackProviderGet({
      path: { provider },
      query: { code, redirect_uri: redirectUri },
      throwOnError: true,
    }).then((res) => res.data),

  // Legacy methods for backwards compatibility
  getGoogleAuthUrl: (redirectUri: string) =>
    getAuthUrlApiV1AuthProviderGet({
      path: { provider: "google" },
      query: { redirect_uri: redirectUri },
      throwOnError: true,
    }).then((res) => res.data),

  handleGoogleCallback: (code: string, redirectUri: string) =>
    oauthCallbackApiV1AuthCallbackProviderGet({
      path: { provider: "google" },
      query: { code, redirect_uri: redirectUri },
      throwOnError: true,
    }).then((res) => res.data),

  getCurrentUser: () =>
    getCurrentUserInfoApiV1AuthMeGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  refreshToken: () =>
    refreshTokenApiV1AuthRefreshPost({ throwOnError: true }).then(
      (res) => res.data
    ),

  updateSettings: (settings: UserSettingsUpdate) =>
    updateUserSettingsApiV1AuthSettingsPatch({
      body: settings,
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Items API
// =============================================================================

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
    checked_out?: boolean;
  }) =>
    listItemsApiV1ItemsGet({
      query: {
        page: params?.page,
        limit: params?.limit,
        category_id: params?.category_id,
        include_subcategories: params?.include_subcategories,
        location_id: params?.location_id,
        include_sublocations: params?.include_sublocations,
        no_category: params?.no_category,
        no_location: params?.no_location,
        search: params?.search,
        tags: params?.tags,
        attr: params?.attributes
          ? Object.entries(params.attributes).map(
              ([key, value]) => `${key}:${value}`
            )
          : undefined,
        low_stock: params?.low_stock,
        checked_out: params?.checked_out,
      },
      throwOnError: true,
    }).then((res) => res.data),

  get: (id: string) =>
    getItemApiV1ItemsItemIdGet({
      path: { item_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  create: (data: ItemCreate) =>
    createItemApiV1ItemsPost({ body: data, throwOnError: true }).then(
      (res) => res.data
    ),

  update: (id: string, data: ItemUpdate) =>
    updateItemApiV1ItemsItemIdPut({
      path: { item_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  updateQuantity: (id: string, quantity: number) =>
    updateItemQuantityApiV1ItemsItemIdQuantityPatch({
      path: { item_id: id },
      body: { quantity },
      throwOnError: true,
    }).then((res) => res.data),

  delete: (id: string) =>
    deleteItemApiV1ItemsItemIdDelete({
      path: { item_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  search: (q: string, limit?: number) =>
    searchItemsApiV1ItemsSearchGet({
      query: { q, limit },
      throwOnError: true,
    }).then((res) => res.data),

  lowStock: () =>
    listLowStockItemsApiV1ItemsLowStockGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  facets: (params?: {
    category_id?: string;
    include_subcategories?: boolean;
    location_id?: string;
    include_sublocations?: boolean;
  }) =>
    getItemFacetsApiV1ItemsFacetsGet({
      query: {
        category_id: params?.category_id,
        include_subcategories: params?.include_subcategories,
        location_id: params?.location_id,
        include_sublocations: params?.include_sublocations,
      },
      throwOnError: true,
    }).then((res) => res.data),

  tags: (limit?: number) =>
    getAllTagsApiV1ItemsTagsGet({ query: { limit }, throwOnError: true }).then(
      (res) => res.data
    ),

  dashboardStats: (days: number = 30) =>
    getDashboardStatsApiV1ItemsStatsDashboardGet({
      query: { days },
      throwOnError: true,
    }).then((res) => res.data),

  checkOut: (id: string, data: CheckInOutCreate = {}) =>
    checkOutItemApiV1ItemsItemIdCheckOutPost({
      path: { item_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  checkIn: (id: string, data: CheckInOutCreate = {}) =>
    checkInItemApiV1ItemsItemIdCheckInPost({
      path: { item_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  getHistory: (id: string, page = 1, limit = 20) =>
    getItemHistoryApiV1ItemsItemIdHistoryGet({
      path: { item_id: id },
      query: { page, limit },
      throwOnError: true,
    }).then((res) => res.data),

  getUsageStats: (id: string) =>
    getItemUsageStatsApiV1ItemsItemIdUsageStatsGet({
      path: { item_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  getMostUsed: (limit = 5) =>
    getMostUsedItemsApiV1ItemsStatsMostUsedGet({
      query: { limit },
      throwOnError: true,
    }).then((res) => res.data),

  getRecentlyUsed: (limit = 5) =>
    getRecentlyUsedItemsApiV1ItemsStatsRecentlyUsedGet({
      query: { limit },
      throwOnError: true,
    }).then((res) => res.data),

  findSimilar: (data: {
    identified_name: string;
    category_path?: string;
    specifications?: Array<{ key: string; value: string | number | boolean }>;
    limit?: number;
  }) =>
    findSimilarItemsApiV1ItemsFindSimilarPost({
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  batchUpdate: (data: {
    item_ids: string[];
    category_id?: string | null;
    location_id?: string | null;
    clear_category?: boolean;
    clear_location?: boolean;
  }) =>
    batchUpdateItemsApiV1ItemsBatchPatch({
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  batchCreate: (data: BatchCreateRequest) =>
    batchCreateItemsApiV1ItemsBatchPost({
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  suggestLocation: (data: {
    item_name: string;
    item_category?: string;
    item_description?: string;
    item_specifications?: Record<string, unknown>;
  }) =>
    suggestItemLocationApiV1ItemsSuggestLocationPost({
      body: data,
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Categories API
// =============================================================================

export const categoriesApi = {
  list: () =>
    listCategoriesApiV1CategoriesGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  tree: () =>
    getCategoryTreeApiV1CategoriesTreeGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  get: (id: string) =>
    getCategoryApiV1CategoriesCategoryIdGet({
      path: { category_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  getTemplate: (id: string) =>
    getCategoryTemplateApiV1CategoriesCategoryIdTemplateGet({
      path: { category_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  getDescendants: (id: string) =>
    getCategoryDescendantsApiV1CategoriesCategoryIdDescendantsGet({
      path: { category_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  create: (data: CategoryCreate) =>
    createCategoryApiV1CategoriesPost({ body: data, throwOnError: true }).then(
      (res) => res.data
    ),

  createFromPath: (path: string) =>
    createCategoryFromPathApiV1CategoriesFromPathPost({
      body: { path },
      throwOnError: true,
    }).then((res) => res.data),

  update: (id: string, data: CategoryUpdate) =>
    updateCategoryApiV1CategoriesCategoryIdPut({
      path: { category_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  move: (id: string, newParentId: string | null) =>
    moveCategoryApiV1CategoriesCategoryIdMovePatch({
      path: { category_id: id },
      body: { new_parent_id: newParentId },
      throwOnError: true,
    }).then((res) => res.data),

  delete: (id: string) =>
    deleteCategoryApiV1CategoriesCategoryIdDelete({
      path: { category_id: id },
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Locations API
// =============================================================================

export const locationsApi = {
  list: () =>
    listLocationsApiV1LocationsGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  tree: () =>
    getLocationTreeApiV1LocationsTreeGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  get: (id: string) =>
    getLocationApiV1LocationsLocationIdGet({
      path: { location_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  getWithAncestors: (id: string) =>
    getLocationWithAncestorsApiV1LocationsLocationIdWithAncestorsGet({
      path: { location_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  getQrSignedUrl: (id: string, size?: number) =>
    getLocationQrSignedUrlApiV1LocationsLocationIdQrSignedUrlGet({
      path: { location_id: id },
      query: { size },
      throwOnError: true,
    }).then((res) => res.data),

  getDescendants: (id: string) =>
    getLocationDescendantsApiV1LocationsLocationIdDescendantsGet({
      path: { location_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  create: (data: LocationCreate) =>
    createLocationApiV1LocationsPost({ body: data, throwOnError: true }).then(
      (res) => res.data
    ),

  update: (id: string, data: LocationUpdate) =>
    updateLocationApiV1LocationsLocationIdPut({
      path: { location_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  move: (id: string, newParentId: string | null) =>
    moveLocationApiV1LocationsLocationIdMovePatch({
      path: { location_id: id },
      body: { new_parent_id: newParentId },
      throwOnError: true,
    }).then((res) => res.data),

  delete: (id: string) =>
    deleteLocationApiV1LocationsLocationIdDelete({
      path: { location_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  analyzeImage: (imageId: string) =>
    analyzeLocationImageApiV1LocationsAnalyzeImagePost({
      body: { image_id: imageId },
      throwOnError: true,
    }).then((res) => res.data),

  createBulk: (data: LocationBulkCreate) =>
    createLocationsBulkApiV1LocationsBulkPost({
      body: data,
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Images API
// =============================================================================

export const imagesApi = {
  upload: (file: File) =>
    uploadImageApiV1ImagesUploadPost({
      body: { file },
      throwOnError: true,
    }).then((res) => res.data),

  classify: (imageIds: string[], customPrompt?: string) =>
    classifyImagesApiV1ImagesClassifyPost({
      body: { image_ids: imageIds, custom_prompt: customPrompt ?? null },
      throwOnError: true,
    }).then((res) => res.data),

  get: (id: string) =>
    getImageApiV1ImagesImageIdGet({
      path: { image_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  getSignedUrl: (id: string, thumbnail?: boolean) =>
    getImageSignedUrlApiV1ImagesImageIdSignedUrlGet({
      path: { image_id: id },
      query: thumbnail ? { thumbnail } : undefined,
      throwOnError: true,
    }).then((res) => res.data),

  delete: (id: string) =>
    deleteImageApiV1ImagesImageIdDelete({
      path: { image_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  attachToItem: (imageId: string, itemId: string, isPrimary?: boolean) =>
    attachImageToItemApiV1ImagesImageIdAttachItemIdPost({
      path: { image_id: imageId, item_id: itemId },
      query: { is_primary: isPrimary },
      throwOnError: true,
    }).then((res) => res.data),

  listClassified: (page = 1, limit = 12, search?: string) =>
    listClassifiedImagesApiV1ImagesClassifiedGet({
      query: { page, limit, search },
      throwOnError: true,
    }).then((res) => res.data),

  setPrimary: (imageId: string) =>
    setImageAsPrimaryApiV1ImagesImageIdSetPrimaryPost({
      path: { image_id: imageId },
      throwOnError: true,
    }).then((res) => res.data),

  detach: (imageId: string) =>
    detachImageFromItemApiV1ImagesImageIdDetachPost({
      path: { image_id: imageId },
      throwOnError: true,
    }).then((res) => res.data),

  // Location image methods
  getByLocation: (locationId: string) =>
    getImagesByLocationApiV1ImagesLocationLocationIdGet({
      path: { location_id: locationId },
      throwOnError: true,
    }).then((res) => res.data),

  attachToLocation: (
    imageId: string,
    locationId: string,
    isPrimary?: boolean
  ) =>
    attachImageToLocationApiV1ImagesImageIdAttachLocationLocationIdPost({
      path: { image_id: imageId, location_id: locationId },
      query: { is_primary: isPrimary },
      throwOnError: true,
    }).then((res) => res.data),

  setPrimaryForLocation: (imageId: string) =>
    setImageAsPrimaryForLocationApiV1ImagesImageIdSetPrimaryLocationPost({
      path: { image_id: imageId },
      throwOnError: true,
    }).then((res) => res.data),

  detachFromLocation: (imageId: string) =>
    detachImageFromLocationApiV1ImagesImageIdDetachLocationPost({
      path: { image_id: imageId },
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Billing API
// =============================================================================

export const billingApi = {
  getBalance: () =>
    getBalanceApiV1BillingBalanceGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  getPacks: () =>
    listPacksApiV1BillingPacksGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  getCosts: () =>
    getOperationCostsApiV1BillingCostsGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  createCheckout: (packId: string) =>
    createCheckoutApiV1BillingCheckoutPost({
      body: { pack_id: packId },
      throwOnError: true,
    }).then((res) => res.data),

  getTransactions: (page = 1, limit = 20) =>
    listTransactionsApiV1BillingTransactionsGet({
      query: { page, limit },
      throwOnError: true,
    }).then((res) => res.data),

  createPortalSession: () =>
    createPortalSessionApiV1BillingPortalPost({ throwOnError: true }).then(
      (res) => res.data
    ),

  requestRefund: (transactionId: string) =>
    requestRefundApiV1BillingRefundPost({
      body: { transaction_id: transactionId },
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Admin API
// =============================================================================

export const adminApi = {
  // Credit Packs
  listPacks: () =>
    listPacksApiV1AdminPacksGet({ throwOnError: true }).then((res) => res.data),

  getPack: (id: string) =>
    getPackApiV1AdminPacksPackIdGet({
      path: { pack_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  createPack: (data: CreditPackCreate) =>
    createPackApiV1AdminPacksPost({ body: data, throwOnError: true }).then(
      (res) => res.data
    ),

  updatePack: (id: string, data: CreditPackUpdate) =>
    updatePackApiV1AdminPacksPackIdPut({
      path: { pack_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  deletePack: (id: string) =>
    deletePackApiV1AdminPacksPackIdDelete({
      path: { pack_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  // Credit Pricing
  listPricing: () =>
    listPricingApiV1AdminPricingGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  getPricing: (id: string) =>
    getPricingApiV1AdminPricingPricingIdGet({
      path: { pricing_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  updatePricing: (id: string, data: CreditPricingUpdate) =>
    updatePricingApiV1AdminPricingPricingIdPut({
      path: { pricing_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  // AI Model Settings
  listAIModelSettings: () =>
    listAiModelSettingsApiV1AdminAiModelSettingsGet({
      throwOnError: true,
    }).then((res) => res.data),

  getAIModelSettings: (id: string) =>
    getAiModelSettingsApiV1AdminAiModelSettingsSettingsIdGet({
      path: { settings_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  updateAIModelSettings: (id: string, data: AiModelSettingsUpdate) =>
    updateAiModelSettingsApiV1AdminAiModelSettingsSettingsIdPut({
      path: { settings_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  // Users
  listUsers: (page = 1, limit = 20, search?: string) =>
    listUsersApiV1AdminUsersGet({
      query: { page, limit, search },
      throwOnError: true,
    }).then((res) => res.data),

  getUser: (id: string) =>
    getUserApiV1AdminUsersUserIdGet({
      path: { user_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  updateUser: (id: string, data: UserAdminUpdate) =>
    updateUserApiV1AdminUsersUserIdPut({
      path: { user_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  // Stats
  getStats: () =>
    getStatsApiV1AdminStatsGet({ throwOnError: true }).then((res) => res.data),

  getRevenueOverTime: (timeRange: TimeRange = "7d") =>
    getRevenueOverTimeApiV1AdminStatsRevenueGet({
      query: { time_range: timeRange },
      throwOnError: true,
    }).then((res) => res.data),

  getSignupsOverTime: (timeRange: TimeRange = "7d") =>
    getSignupsOverTimeApiV1AdminStatsSignupsGet({
      query: { time_range: timeRange },
      throwOnError: true,
    }).then((res) => res.data),

  getCreditActivity: (timeRange: TimeRange = "7d") =>
    getCreditActivityApiV1AdminStatsCreditsGet({
      query: { time_range: timeRange },
      throwOnError: true,
    }).then((res) => res.data),

  getPackBreakdown: (timeRange: TimeRange = "7d") =>
    getPackBreakdownApiV1AdminStatsPacksGet({
      query: { time_range: timeRange },
      throwOnError: true,
    }).then((res) => res.data),

  getActivityFeed: (
    page = 1,
    limit = 20,
    activityType?: "signup" | "feedback" | "purchase"
  ) =>
    getActivityFeedApiV1AdminActivityGet({
      query: { page, limit, activity_type: activityType },
      throwOnError: true,
    }).then((res) => res.data),

  // Credit adjustment
  adjustUserCredits: (userId: string, data: CreditAdjustmentRequest) =>
    adjustUserCreditsApiV1AdminUsersUserIdCreditsPost({
      path: { user_id: userId },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  // Feedback
  listFeedback: (
    page = 1,
    limit = 20,
    status?: string,
    feedbackType?: string
  ) =>
    listAllFeedbackApiV1FeedbackAdminGet({
      query: { page, limit, status, feedback_type: feedbackType },
      throwOnError: true,
    }).then((res) => res.data),

  getFeedback: (id: string) =>
    getFeedbackApiV1FeedbackAdminFeedbackIdGet({
      path: { feedback_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  updateFeedback: (id: string, data: FeedbackAdminUpdate) =>
    updateFeedbackApiV1FeedbackAdminFeedbackIdPut({
      path: { feedback_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  deleteFeedback: (id: string) =>
    deleteFeedbackApiV1FeedbackAdminFeedbackIdDelete({
      path: { feedback_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  retriggerFeedbackWebhook: (id: string) =>
    retriggerFeedbackWebhookApiV1FeedbackAdminFeedbackIdRetriggerWebhookPost({
      path: { feedback_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  // AI Usage Analytics
  getAIUsageSummary: (startDate?: string, endDate?: string) =>
    getAiUsageSummaryApiV1AdminAiUsageSummaryGet({
      query: { start_date: startDate, end_date: endDate },
      throwOnError: true,
    }).then((res) => res.data),

  getAIUsageByUser: (startDate?: string, endDate?: string, limit = 50) =>
    getAiUsageByUserApiV1AdminAiUsageByUserGet({
      query: { start_date: startDate, end_date: endDate, limit },
      throwOnError: true,
    }).then((res) => res.data),

  getAIUsageHistory: (
    page = 1,
    limit = 50,
    operationType?: string,
    userId?: string
  ) =>
    getAiUsageHistoryApiV1AdminAiUsageHistoryGet({
      query: { page, limit, operation_type: operationType, user_id: userId },
      throwOnError: true,
    }).then((res) => res.data),

  getAIUsageDaily: (days = 30) =>
    getAiUsageDailyApiV1AdminAiUsageDailyGet({
      query: { days },
      throwOnError: true,
    }).then((res) => res.data),

  // Billing Settings
  listBillingSettings: () =>
    listBillingSettingsApiV1AdminBillingSettingsGet({
      throwOnError: true,
    }).then((res) => res.data),

  getBillingSetting: (id: string) =>
    getBillingSettingApiV1AdminBillingSettingsSettingIdGet({
      path: { setting_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  updateBillingSetting: (id: string, data: BillingSettingUpdate) =>
    updateBillingSettingApiV1AdminBillingSettingsSettingIdPut({
      path: { setting_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Feedback API
// =============================================================================

export const feedbackApi = {
  submit: (data: {
    subject: string;
    message: string;
    feedback_type?: string;
  }) =>
    createFeedbackApiV1FeedbackPost({ body: data, throwOnError: true }).then(
      (res) => res.data
    ),

  list: (page = 1, limit = 20) =>
    listMyFeedbackApiV1FeedbackGet({
      query: { page, limit },
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Webhooks API
// =============================================================================

export const webhooksApi = {
  listEventTypes: () =>
    listEventTypesApiV1WebhooksEventTypesGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  listConfigs: () =>
    listConfigsApiV1WebhooksConfigsGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  getConfig: (id: string) =>
    getConfigApiV1WebhooksConfigsConfigIdGet({
      path: { config_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  createConfig: (data: WebhookConfigCreate) =>
    createConfigApiV1WebhooksConfigsPost({
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  updateConfig: (id: string, data: WebhookConfigUpdate) =>
    updateConfigApiV1WebhooksConfigsConfigIdPut({
      path: { config_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  deleteConfig: (id: string) =>
    deleteConfigApiV1WebhooksConfigsConfigIdDelete({
      path: { config_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  testConfig: (id: string, testPayload?: Record<string, unknown>) =>
    testConfigApiV1WebhooksConfigsConfigIdTestPost({
      path: { config_id: id },
      body: { test_payload: testPayload || {} },
      throwOnError: true,
    }).then((res) => res.data),

  listExecutions: (
    page = 1,
    limit = 20,
    configId?: string,
    eventType?: string,
    status?: string
  ) =>
    listExecutionsApiV1WebhooksExecutionsGet({
      query: {
        page,
        limit,
        config_id: configId,
        event_type: eventType,
        status,
      },
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// API Keys API
// =============================================================================

export const apiKeysApi = {
  list: (page = 1, limit = 20) =>
    listApiKeysApiV1AdminApikeysGet({
      query: { page, limit },
      throwOnError: true,
    }).then((res) => res.data),

  get: (id: string) =>
    getApiKeyApiV1AdminApikeysApiKeyIdGet({
      path: { api_key_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  create: (data: ApiKeyCreate) =>
    createApiKeyApiV1AdminApikeysPost({
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  update: (id: string, data: ApiKeyUpdate) =>
    updateApiKeyApiV1AdminApikeysApiKeyIdPatch({
      path: { api_key_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  delete: (id: string) =>
    deleteApiKeyApiV1AdminApikeysApiKeyIdDelete({
      path: { api_key_id: id },
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Gridfinity API
// =============================================================================

export const gridfinityApi = {
  // Units
  listUnits: () =>
    listUnitsApiV1GridfinityUnitsGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  getUnit: (id: string) =>
    getUnitApiV1GridfinityUnitsUnitIdGet({
      path: { unit_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  getUnitLayout: (id: string) =>
    getUnitLayoutApiV1GridfinityUnitsUnitIdLayoutGet({
      path: { unit_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  createUnit: (data: GridfinityUnitCreate) =>
    createUnitApiV1GridfinityUnitsPost({
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  updateUnit: (id: string, data: GridfinityUnitUpdate) =>
    updateUnitApiV1GridfinityUnitsUnitIdPut({
      path: { unit_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  deleteUnit: (id: string) =>
    deleteUnitApiV1GridfinityUnitsUnitIdDelete({
      path: { unit_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  // Placements
  createPlacement: (unitId: string, data: GridfinityPlacementCreate) =>
    createPlacementApiV1GridfinityUnitsUnitIdPlacementsPost({
      path: { unit_id: unitId },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  updatePlacement: (placementId: string, data: GridfinityPlacementUpdate) =>
    updatePlacementApiV1GridfinityPlacementsPlacementIdPut({
      path: { placement_id: placementId },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  deletePlacement: (placementId: string) =>
    deletePlacementApiV1GridfinityPlacementsPlacementIdDelete({
      path: { placement_id: placementId },
      throwOnError: true,
    }).then((res) => res.data),

  // Auto-layout
  autoLayout: (unitId: string, itemIds: string[]) =>
    autoLayoutItemsApiV1GridfinityUnitsUnitIdAutoLayoutPost({
      path: { unit_id: unitId },
      body: { item_ids: itemIds },
      throwOnError: true,
    }).then((res) => res.data),

  // Bin recommendations
  recommendBins: (itemIds: string[]) =>
    recommendBinSizesApiV1GridfinityRecommendBinsPost({
      body: { item_ids: itemIds },
      throwOnError: true,
    }).then((res) => res.data),

  // Grid calculation
  calculateGrid: (widthMm: number, depthMm: number) =>
    calculateGridApiV1GridfinityCalculateGridGet({
      query: { width_mm: widthMm, depth_mm: depthMm },
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// AI Assistant API
// =============================================================================

export const aiApi = {
  query: (data: { prompt: string; include_inventory_context?: boolean }) =>
    queryAssistantApiV1AiQueryPost({ body: data, throwOnError: true }).then(
      (res) => res.data
    ),

  // Session management
  listSessions: (options?: {
    page?: number;
    limit?: number;
    active_only?: boolean;
  }) =>
    listSessionsApiV1AiSessionsGet({
      query: {
        page: options?.page ?? 1,
        limit: options?.limit ?? 20,
        active_only: options?.active_only ?? true,
      },
      throwOnError: true,
    }).then((res) => res.data),

  createSession: (data?: SessionCreate) =>
    createSessionApiV1AiSessionsPost({
      body: data || {},
      throwOnError: true,
    }).then((res) => res.data),

  getSession: (sessionId: string) =>
    getSessionApiV1AiSessionsSessionIdGet({
      path: { session_id: sessionId },
      throwOnError: true,
    }).then((res) => res.data),

  updateSession: (sessionId: string, data: SessionUpdate) =>
    updateSessionApiV1AiSessionsSessionIdPatch({
      path: { session_id: sessionId },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  deleteSession: (sessionId: string, permanent = false) =>
    deleteSessionApiV1AiSessionsSessionIdDelete({
      path: { session_id: sessionId },
      query: { permanent },
      throwOnError: true,
    }).then((res) => res.data),

  // Tool-enabled chat
  chat: (data: { prompt: string; session_id?: string }) =>
    chatWithToolsApiV1AiChatPost({
      body: data,
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Profile API
// =============================================================================

export const profileApi = {
  getHobbyTypes: () =>
    getHobbyTypesApiV1ProfileHobbyTypesGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  getProfile: () =>
    getMyProfileApiV1ProfileMeGet({ throwOnError: true }).then(
      (res) => res.data
    ),

  createProfile: (data: UserSystemProfileCreate) =>
    createMyProfileApiV1ProfileMePost({ body: data, throwOnError: true }).then(
      (res) => res.data
    ),

  updateProfile: (data: UserSystemProfileUpdate) =>
    updateMyProfileApiV1ProfileMePatch({ body: data, throwOnError: true }).then(
      (res) => res.data
    ),

  getRecommendations: (limit = 50) =>
    getRecommendationsApiV1ProfileRecommendationsGet({
      query: { limit },
      throwOnError: true,
    }).then((res) => res.data),

  generateRecommendations: (data?: {
    max_recommendations?: number;
    items_to_analyze?: number;
  }) =>
    generateRecommendationsApiV1ProfileRecommendationsGeneratePost({
      body: data || {},
      throwOnError: true,
    }).then((res) => res.data),

  updateRecommendation: (
    id: string,
    data: { status: "accepted" | "dismissed"; user_feedback?: string }
  ) =>
    updateRecommendationApiV1ProfileRecommendationsRecommendationIdPatch({
      path: { recommendation_id: id },
      body: data,
      throwOnError: true,
    }).then((res) => res.data),

  dismissRecommendation: (id: string) =>
    dismissRecommendationApiV1ProfileRecommendationsRecommendationIdDelete({
      path: { recommendation_id: id },
      throwOnError: true,
    }).then((res) => res.data),

  getDeclutterCost: (itemsToAnalyze = 50) =>
    getRecommendationsCostApiV1ProfileRecommendationsCostGet({
      query: { items_to_analyze: itemsToAnalyze },
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Notifications API
// =============================================================================

export const notificationsApi = {
  getPreferences: () =>
    getNotificationPreferencesApiV1NotificationsPreferencesGet({
      throwOnError: true,
    }).then((res) => res.data),

  updatePreferences: (data: NotificationPreferencesUpdate) =>
    updateNotificationPreferencesApiV1NotificationsPreferencesPut({
      body: data,
      throwOnError: true,
    }).then((res) => res.data),
};

// =============================================================================
// Collaboration API
// =============================================================================

export const collaborationApi = {
  getContext: () =>
    getInventoryContextApiV1CollaborationContextGet({
      throwOnError: true,
    }).then((res) => res.data),

  listCollaborators: () =>
    listCollaboratorsApiV1CollaborationCollaboratorsGet({
      throwOnError: true,
    }).then((res) => res.data),

  invite: (email: string, role: CollaboratorRole = "viewer") =>
    inviteCollaboratorApiV1CollaborationCollaboratorsPost({
      body: { email, role },
      throwOnError: true,
    }).then((res) => res.data),

  remove: (collaboratorId: string) =>
    removeCollaboratorApiV1CollaborationCollaboratorsCollaboratorIdDelete({
      path: { collaborator_id: collaboratorId },
      throwOnError: true,
    }).then((res) => res.data),

  updateRole: (collaboratorId: string, role: CollaboratorRole) =>
    updateCollaboratorApiV1CollaborationCollaboratorsCollaboratorIdPut({
      path: { collaborator_id: collaboratorId },
      body: { role },
      throwOnError: true,
    }).then((res) => res.data),

  acceptInvitation: (token: string) =>
    acceptInvitationApiV1CollaborationInvitationsAcceptPost({
      body: { token },
      throwOnError: true,
    }).then((res) => res.data),

  acceptInvitationById: (invitationId: string) =>
    acceptInvitationByIdApiV1CollaborationInvitationsInvitationIdAcceptPost({
      path: { invitation_id: invitationId },
      throwOnError: true,
    }).then((res) => res.data),

  declineInvitation: (invitationId: string) =>
    declineInvitationApiV1CollaborationInvitationsInvitationIdDeclinePost({
      path: { invitation_id: invitationId },
      throwOnError: true,
    }).then((res) => res.data),

  leaveSharedInventory: (ownerId: string) =>
    leaveSharedInventoryApiV1CollaborationSharedOwnerIdDelete({
      path: { owner_id: ownerId },
      throwOnError: true,
    }).then((res) => res.data),
};
