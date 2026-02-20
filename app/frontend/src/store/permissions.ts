/**
 * Permissions Store
 *
 * Manages RBAC permissions and feature flags for the current user.
 * NOT persisted - permissions are fetched fresh on each session init
 * and on window focus to catch admin changes.
 */

import { create } from "zustand";

/**
 * Permission string format: "resource:action"
 * Examples: "accounts:read", "invoices:create", "users:manage"
 */
type PermissionString = string;

interface PermissionsState {
	roles: string[];
	permissions: Set<PermissionString>;
	featureFlags: Record<string, boolean>;
}

interface PermissionsActions {
	setPermissions: (
		roles: string[],
		permissions: PermissionString[],
		featureFlags?: Record<string, boolean>,
	) => void;
	clearPermissions: () => void;
	can: (resource: string, action: string) => boolean;
	hasRole: (role: string) => boolean;
	hasPermission: (permission: PermissionString) => boolean;
	isFeatureEnabled: (flag: string) => boolean;
}

type PermissionsStore = PermissionsState & PermissionsActions;

const initialState: PermissionsState = {
	roles: [],
	permissions: new Set(),
	featureFlags: {},
};

export const usePermissionsStore = create<PermissionsStore>()((set, get) => ({
	...initialState,

	setPermissions: (roles, permissions, featureFlags = {}) => {
		set({
			roles,
			permissions: new Set(permissions),
			featureFlags,
		});
	},

	clearPermissions: () => {
		set(initialState);
	},

	/**
	 * Check if user has permission for a resource:action
	 * @param resource - The resource name (e.g., 'accounts', 'invoices')
	 * @param action - The action name (e.g., 'read', 'create', 'update', 'delete')
	 */
	can: (resource, action) => {
		const { permissions } = get();
		const permission = `${resource}:${action}`;

		// Check for exact permission
		if (permissions.has(permission)) return true;

		// Check for wildcard permission (e.g., "accounts:*" or "*:*")
		if (permissions.has(`${resource}:*`)) return true;
		if (permissions.has("*:*")) return true;

		return false;
	},

	/**
	 * Check if user has a specific role
	 */
	hasRole: (role) => {
		const { roles } = get();
		return roles.includes(role);
	},

	/**
	 * Check if user has a specific permission string
	 */
	hasPermission: (permission) => {
		const { permissions } = get();
		return permissions.has(permission);
	},

	/**
	 * Check if a feature flag is enabled
	 */
	isFeatureEnabled: (flag) => {
		const { featureFlags } = get();
		return featureFlags[flag] === true;
	},
}));

/**
 * Hook for checking a specific permission
 */
export function useCan(resource: string, action: string): boolean {
	return usePermissionsStore((state) => state.can(resource, action));
}

/**
 * Hook for checking if a feature is enabled
 */
export function useFeatureFlag(flag: string): boolean {
	return usePermissionsStore((state) => state.isFeatureEnabled(flag));
}

/**
 * Get all permissions (for debugging/logging)
 */
export function getAllPermissions(): string[] {
	return Array.from(usePermissionsStore.getState().permissions);
}

/**
 * Get all roles (for debugging/logging)
 */
export function getAllRoles(): string[] {
	return usePermissionsStore.getState().roles;
}
