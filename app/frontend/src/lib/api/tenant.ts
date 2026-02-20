/**
 * Tenant API Endpoints
 *
 * Tenant-related API calls.
 */

import type { AxiosResponse } from "axios";
import type { SubscriptionPlan, Tenant } from "@/store/tenant";
import getApiClient from "./client";

/**
 * Update tenant request
 */
export interface UpdateTenantRequest {
	name?: string;
	logoUrl?: string;
	currencyCode?: string;
	locale?: string;
	fiscalYearStart?: number;
	gstin?: string;
	timezone?: string;
}

/**
 * Get current tenant API call
 */
export async function getCurrentTenantApi(): Promise<Tenant> {
	const client = getApiClient();
	const response: AxiosResponse<Tenant> = await client.get("/tenants/me");
	return response.data;
}

/**
 * Update tenant API call
 */
export async function updateTenantApi(
	data: UpdateTenantRequest,
): Promise<Tenant> {
	const client = getApiClient();
	const response: AxiosResponse<Tenant> = await client.patch(
		"/tenants/me",
		data,
	);
	return response.data;
}

/**
 * Get subscription plan API call
 */
export async function getSubscriptionPlanApi(): Promise<{
	plan: SubscriptionPlan;
}> {
	const client = getApiClient();
	const response: AxiosResponse<{ plan: SubscriptionPlan }> = await client.get(
		"/tenants/me/subscription",
	);
	return response.data;
}
