/**
 * Query Key Factory
 *
 * Hierarchical namespacing for TanStack Query keys.
 * All keys are typed as const tuples for type-safe query invalidation.
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/query-keys
 */

export const keys = {
	// Auth namespace
	auth: {
		me: ["auth", "me"] as const,
		sessions: ["auth", "sessions"] as const,
	},

	// Tenant namespace
	tenant: {
		current: ["tenant", "current"] as const,
	},

	// Permissions namespace
	permissions: {
		mine: ["permissions", "mine"] as const,
	},

	// Modules will add their namespaces here as their proposals are implemented
	// Example:
	// accounts: {
	//   list: (filters: AccountsFilters) => ['accounts', 'list', filters] as const,
	//   detail: (id: string) => ['accounts', 'detail', id] as const,
	// },
} as const;

/**
 * Type helper to extract query key types
 */
export type QueryKeys = typeof keys;
