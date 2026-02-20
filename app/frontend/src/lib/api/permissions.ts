/**
 * Permissions API Endpoints
 *
 * Permission and role-related API calls.
 */

import type { AxiosResponse } from "axios";
import getApiClient from "./client";

/**
 * Permissions response
 */
export interface PermissionsResponse {
	roles: string[];
	permissions: string[];
	featureFlags: Record<string, boolean>;
}

/**
 * Get current user's permissions API call
 */
export async function getMyPermissionsApi(): Promise<PermissionsResponse> {
	const client = getApiClient();
	const response: AxiosResponse<PermissionsResponse> = await client.get(
		"/users/me/permissions",
	);
	return response.data;
}
