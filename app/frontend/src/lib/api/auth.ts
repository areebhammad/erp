/**
 * Auth API Endpoints
 *
 * All authentication-related API calls.
 */

import type { AxiosResponse } from "axios";
import type { User } from "@/store/auth";
import getApiClient from "./client";

/**
 * Login request payload
 */
export interface LoginRequest {
	email: string;
	password: string;
	captchaToken?: string;
}

/**
 * Login response
 */
export interface LoginResponse {
	user: User;
	sessionId: string;
	mfaRequired?: boolean;
}

/**
 * MFA verification request
 */
export interface MfaVerifyRequest {
	code: string;
}

/**
 * Register request payload
 */
export interface RegisterRequest {
	companyName: string;
	fullName: string;
	email: string;
	password: string;
	gstin?: string;
}

/**
 * Register response
 */
export interface RegisterResponse {
	user: User;
	tenantId: string;
}

/**
 * Forgot password request
 */
export interface ForgotPasswordRequest {
	email: string;
}

/**
 * Reset password request
 */
export interface ResetPasswordRequest {
	token: string;
	password: string;
}

/**
 * Session info
 */
export interface Session {
	id: string;
	deviceInfo: string;
	ipAddress: string;
	location?: string;
	lastActiveAt: string;
	isCurrent: boolean;
}

/**
 * Login API call
 */
export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
	const client = getApiClient();
	const response: AxiosResponse<LoginResponse> = await client.post(
		"/auth/login",
		data,
	);
	return response.data;
}

/**
 * Register API call
 */
export async function registerApi(
	data: RegisterRequest,
): Promise<RegisterResponse> {
	const client = getApiClient();
	const response: AxiosResponse<RegisterResponse> = await client.post(
		"/auth/register",
		data,
	);
	return response.data;
}

/**
 * Verify MFA API call
 */
export async function verifyMfaApi(
	data: MfaVerifyRequest,
): Promise<LoginResponse> {
	const client = getApiClient();
	const response: AxiosResponse<LoginResponse> = await client.post(
		"/auth/mfa/verify",
		data,
	);
	return response.data;
}

/**
 * Logout API call
 */
export async function logoutApi(): Promise<void> {
	const client = getApiClient();
	await client.post("/auth/logout");
}

/**
 * Refresh session API call
 */
export async function refreshApi(): Promise<void> {
	const client = getApiClient();
	await client.get("/auth/refresh");
}

/**
 * Get current user API call
 */
export async function getMeApi(): Promise<User> {
	const client = getApiClient();
	const response: AxiosResponse<User> = await client.get("/auth/me");
	return response.data;
}

/**
 * Forgot password API call
 */
export async function forgotPasswordApi(
	data: ForgotPasswordRequest,
): Promise<void> {
	const client = getApiClient();
	await client.post("/auth/forgot-password", data);
}

/**
 * Reset password API call
 */
export async function resetPasswordApi(
	data: ResetPasswordRequest,
): Promise<void> {
	const client = getApiClient();
	await client.post("/auth/reset-password", data);
}

/**
 * Get active sessions API call
 */
export async function getSessionsApi(): Promise<Session[]> {
	const client = getApiClient();
	const response: AxiosResponse<Session[]> = await client.get("/auth/sessions");
	return response.data;
}

/**
 * Revoke a session API call
 */
export async function revokeSessionApi(sessionId: string): Promise<void> {
	const client = getApiClient();
	await client.delete(`/auth/sessions/${sessionId}`);
}

/**
 * Revoke all other sessions API call
 */
export async function revokeAllSessionsApi(): Promise<void> {
	const client = getApiClient();
	await client.delete("/auth/sessions");
}

/**
 * Get CSRF token API call (forces cookie set)
 */
export async function getCsrfApi(): Promise<void> {
	const client = getApiClient();
	await client.get("/auth/csrf");
}
