/**
 * Auth Store
 *
 * Manages authentication state including user profile and session info.
 * Backed by sessionStorage for tab-scoped persistence.
 *
 * IMPORTANT: This store NEVER stores tokens. Tokens are stored in HTTP-only
 * cookies managed by the backend. The store only holds user profile data.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * User profile type (matches backend UserResponse)
 * Tokens are explicitly excluded - they live in HTTP-only cookies
 */
export interface User {
	id: string;
	email: string;
	fullName: string;
	avatarUrl?: string;
	tenantId: string;
	roles: string[];
	createdAt: string;
	lastLoginAt?: string;
}

interface AuthState {
	user: User | null;
	sessionId: string | null;
	_isHydrated: boolean;
}

interface AuthActions {
	setUser: (user: User, sessionId: string) => void;
	clearAuth: () => void;
	setHydrated: () => void;
}

type AuthStore = AuthState & AuthActions;

/**
 * Session cleared event key for cross-tab communication
 */
export const SESSION_CLEARED_EVENT = "__session_clear";

/**
 * Auth store with sessionStorage persistence
 */
export const useAuthStore = create<AuthStore>()(
	persist(
		(set) => ({
			// State
			user: null,
			sessionId: null,
			_isHydrated: false,

			// Actions
			setUser: (user, sessionId) => {
				set({ user, sessionId });
			},

			clearAuth: () => {
				set({ user: null, sessionId: null });

				// Dispatch storage event for cross-tab sync
				if (typeof window !== "undefined") {
					// Clear the persisted state
					sessionStorage.removeItem("auth-store");

					// Dispatch custom event for other tabs
					localStorage.setItem(SESSION_CLEARED_EVENT, Date.now().toString());
					localStorage.removeItem(SESSION_CLEARED_EVENT);
				}
			},

			setHydrated: () => {
				set({ _isHydrated: true });
			},
		}),
		{
			name: "auth-store",
			storage: createJSONStorage(() => sessionStorage),
			partialize: (state) => ({
				user: state.user,
				sessionId: state.sessionId,
			}),
			onRehydrateStorage: () => (state) => {
				state?.setHydrated();
			},
		},
	),
);

/**
 * Computed property: isAuthenticated
 */
export function useIsAuthenticated(): boolean {
	const user = useAuthStore((state) => state.user);
	return user !== null;
}

/**
 * Get the current user (for use outside React components)
 */
export function getCurrentUser(): User | null {
	return useAuthStore.getState().user;
}

/**
 * Check if the user has a specific role
 */
export function useHasRole(role: string): boolean {
	const user = useAuthStore((state) => state.user);
	return user?.roles.includes(role) ?? false;
}

/**
 * Setup cross-tab session sync listener
 * Call this once in the app initialization
 */
export function setupAuthSyncListener(): () => void {
	const handleStorageEvent = (event: StorageEvent) => {
		if (event.key === SESSION_CLEARED_EVENT) {
			// Another tab cleared the session - clear this tab too
			useAuthStore.getState().clearAuth();
		}
	};

	window.addEventListener("storage", handleStorageEvent);

	return () => {
		window.removeEventListener("storage", handleStorageEvent);
	};
}
