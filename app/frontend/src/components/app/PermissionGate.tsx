/**
 * Permission Gate Component
 *
 * Conditionally renders children based on user permissions.
 * Used to hide UI elements the user doesn't have access to.
 */

import type { ReactNode } from "react";
import { usePermissionsStore } from "@/store";

interface PermissionGateProps {
	/** Resource to check permission for */
	resource: string;
	/** Action to check permission for */
	action: string;
	/** Children to render if permission is granted */
	children: ReactNode;
	/** Optional fallback to render if permission is denied */
	fallback?: ReactNode;
}

/**
 * Gate component that renders children only if the user has the required permission.
 *
 * @example
 * ```tsx
 * <PermissionGate resource="accounts" action="create">
 *   <Button>Create Account</Button>
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
	resource,
	action,
	children,
	fallback = null,
}: PermissionGateProps): ReactNode {
	const can = usePermissionsStore((state) => state.can);

	if (can(resource, action)) {
		return children;
	}

	return fallback;
}

interface FeatureFlagGateProps {
	/** Feature flag name to check */
	flag: string;
	/** Children to render if flag is enabled */
	children: ReactNode;
	/** Optional fallback to render if flag is disabled */
	fallback?: ReactNode;
}

/**
 * Gate component that renders children only if a feature flag is enabled.
 *
 * @example
 * ```tsx
 * <FeatureFlagGate flag="new_dashboard">
 *   <NewDashboard />
 * </FeatureFlagGate>
 * ```
 */
export function FeatureFlagGate({
	flag,
	children,
	fallback = null,
}: FeatureFlagGateProps): ReactNode {
	const isFeatureEnabled = usePermissionsStore(
		(state) => state.isFeatureEnabled,
	);

	if (isFeatureEnabled(flag)) {
		return children;
	}

	return fallback;
}

interface RoleGateProps {
	/** Role name to check */
	role: string;
	/** Children to render if user has the role */
	children: ReactNode;
	/** Optional fallback to render if user doesn't have the role */
	fallback?: ReactNode;
}

/**
 * Gate component that renders children only if the user has a specific role.
 *
 * @example
 * ```tsx
 * <RoleGate role="Admin">
 *   <AdminPanel />
 * </RoleGate>
 * ```
 */
export function RoleGate({
	role,
	children,
	fallback = null,
}: RoleGateProps): ReactNode {
	const hasRole = usePermissionsStore((state) => state.hasRole);

	if (hasRole(role)) {
		return children;
	}

	return fallback;
}
