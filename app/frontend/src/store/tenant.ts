/**
 * Tenant Store
 *
 * Manages the current tenant context including company info,
 * subscription plan, and locale settings.
 * NOT persisted - fetched fresh on each session init.
 */

import { create } from "zustand";

/**
 * Subscription plan types
 */
export type SubscriptionPlan =
	| "free"
	| "starter"
	| "professional"
	| "enterprise";

/**
 * Tenant information (matches backend TenantResponse)
 */
export interface Tenant {
	id: string;
	name: string;
	logoUrl?: string;
	currencyCode: string;
	locale: string;
	fiscalYearStart: number; // Month number (1-12)
	gstin?: string;
	timezone: string;
	countryCode: string;
	createdAt: string;
}

interface TenantState {
	tenant: Tenant | null;
	subscriptionPlan: SubscriptionPlan;
	featureFlags: Record<string, boolean>;
}

interface TenantActions {
	setTenant: (tenant: Tenant) => void;
	setSubscriptionPlan: (plan: SubscriptionPlan) => void;
	setFeatureFlags: (flags: Record<string, boolean>) => void;
	clearTenant: () => void;
}

type TenantStore = TenantState & TenantActions;

const initialState: TenantState = {
	tenant: null,
	subscriptionPlan: "free",
	featureFlags: {},
};

export const useTenantStore = create<TenantStore>()((set) => ({
	...initialState,

	setTenant: (tenant) => {
		set({ tenant });
	},

	setSubscriptionPlan: (plan) => {
		set({ subscriptionPlan: plan });
	},

	setFeatureFlags: (flags) => {
		set({ featureFlags: flags });
	},

	clearTenant: () => {
		set(initialState);
	},
}));

/**
 * Get tenant currency code (for Money formatting)
 */
export function useCurrencyCode(): string {
	return useTenantStore((state) => state.tenant?.currencyCode ?? "INR");
}

/**
 * Get tenant locale (for i18n)
 */
export function useTenantLocale(): string {
	return useTenantStore((state) => state.tenant?.locale ?? "en");
}

/**
 * Get tenant name
 */
export function useTenantName(): string {
	return useTenantStore((state) => state.tenant?.name ?? "");
}

/**
 * Check if tenant has a specific feature flag enabled
 */
export function useTenantFeatureFlag(flag: string): boolean {
	return useTenantStore((state) => state.featureFlags[flag] === true);
}

/**
 * Get current tenant (for use outside React components)
 */
export function getCurrentTenant(): Tenant | null {
	return useTenantStore.getState().tenant;
}

/**
 * Get tenant ID (for use outside React components)
 */
export function getTenantId(): string | null {
	return useTenantStore.getState().tenant?.id ?? null;
}
