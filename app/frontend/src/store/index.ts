/**
 * Store Index
 *
 * Re-exports all Zustand stores for convenient imports.
 */

// Auth store
export {
	getCurrentUser,
	SESSION_CLEARED_EVENT,
	setupAuthSyncListener,
	type User,
	useAuthStore,
	useHasRole,
	useIsAuthenticated,
} from "./auth";

// Permissions store
export {
	getAllPermissions,
	getAllRoles,
	useCan,
	useFeatureFlag,
	usePermissionsStore,
} from "./permissions";

// Tenant store
export {
	getCurrentTenant,
	getTenantId,
	type SubscriptionPlan,
	type Tenant,
	useCurrencyCode,
	useTenantFeatureFlag,
	useTenantLocale,
	useTenantName,
	useTenantStore,
} from "./tenant";

// UI store
export {
	type ConnectionStatus,
	type Notification,
	type NotificationType,
	useColorMode,
	useCommandPaletteOpen,
	useConnectionStatus,
	useLocale,
	useNotifications,
	useSidebarCollapsed,
	useUIStore,
	useUnreadNotificationCount,
} from "./ui";
