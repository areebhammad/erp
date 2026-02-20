/**
 * API Module Index
 *
 * Re-exports all API-related functionality.
 */

// Auth API
export {
	type ForgotPasswordRequest,
	forgotPasswordApi,
	getCsrfApi,
	getMeApi,
	getSessionsApi,
	type LoginRequest,
	type LoginResponse,
	loginApi,
	logoutApi,
	type MfaVerifyRequest,
	type RegisterRequest,
	type RegisterResponse,
	type ResetPasswordRequest,
	refreshApi,
	registerApi,
	resetPasswordApi,
	revokeAllSessionsApi,
	revokeSessionApi,
	type Session,
	verifyMfaApi,
} from "./auth";
// Circuit Breaker
export {
	CircuitBreaker,
	getCircuitBreaker,
	resetCircuitBreaker,
} from "./circuit-breaker";
// Client
export { default as apiClient, getApiClient, resetApiClient } from "./client";
// Errors
export {
	ApiError,
	type ApiErrorCode,
	getErrorMessage,
	isApiError,
} from "./errors";
// Permissions API
export {
	getMyPermissionsApi,
	type PermissionsResponse,
} from "./permissions";
// Tenant API
export {
	getCurrentTenantApi,
	getSubscriptionPlanApi,
	type UpdateTenantRequest,
	updateTenantApi,
} from "./tenant";
