/**
 * API Error Class
 *
 * Normalized error class for all API errors.
 * Includes Sentry integration for 5xx errors.
 */

import type { AxiosError, AxiosResponse } from "axios";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ module: "api-error" });

/**
 * API error codes
 */
export type ApiErrorCode =
	| "validation_error"
	| "unauthorized"
	| "forbidden"
	| "not_found"
	| "conflict"
	| "rate_limited"
	| "account_locked"
	| "session_expired"
	| "server_error"
	| "network_error"
	| "circuit_open"
	| "unknown";

/**
 * Normalized API error
 */
export class ApiError extends Error {
	readonly status: number;
	readonly code: ApiErrorCode;
	readonly details?: Record<string, string[]>;
	readonly requestId: string;
	readonly traceId?: string;

	constructor(
		status: number,
		code: ApiErrorCode,
		message: string,
		requestId: string,
		options?: {
			details?: Record<string, string[]>;
			traceId?: string;
		},
	) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
		this.requestId = requestId;
		this.details = options?.details;
		this.traceId = options?.traceId;

		// Capture to Sentry for server errors
		if (status >= 500) {
			this.captureToSentry();
		}
	}

	/**
	 * Create ApiError from Axios error
	 */
	static fromAxiosError(error: AxiosError): ApiError {
		const response = error.response as
			| AxiosResponse<{
					detail?: string;
					message?: string;
					code?: ApiErrorCode;
					errors?: Record<string, string[]>;
					request_id?: string;
					trace_id?: string;
			  }>
			| undefined;

		const status = response?.status ?? 0;
		const requestId = response?.data?.request_id ?? crypto.randomUUID();
		const traceId = response?.data?.trace_id;

		// Determine error code
		let code: ApiErrorCode = "unknown";
		let message = "An unexpected error occurred";

		if (!response) {
			// Network error
			code = "network_error";
			message =
				"Unable to connect to the server. Please check your connection.";
		} else {
			// Map status codes to error codes
			switch (status) {
				case 400:
					code = "validation_error";
					message =
						response?.data?.detail ??
						response?.data?.message ??
						"Invalid request";
					break;
				case 401:
					code = "unauthorized";
					message = "Authentication required";
					break;
				case 403:
					code = "forbidden";
					message = "You do not have permission to perform this action";
					break;
				case 404:
					code = "not_found";
					message = "The requested resource was not found";
					break;
				case 409:
					code = "conflict";
					message = response?.data?.detail ?? "Resource conflict";
					break;
				case 423:
					code = "account_locked";
					message = "Account is temporarily locked";
					break;
				case 429:
					code = "rate_limited";
					message = "Too many requests. Please try again later.";
					break;
				case 500:
				case 502:
				case 503:
				case 504:
					code = "server_error";
					message = "A server error occurred. Please try again later.";
					break;
				default:
					code = response?.data?.code ?? "unknown";
					message =
						response?.data?.detail ??
						response?.data?.message ??
						"An error occurred";
			}
		}

		return new ApiError(status, code, message, requestId, {
			details: response?.data?.errors,
			traceId,
		});
	}

	/**
	 * Create ApiError for circuit breaker open state
	 */
	static circuitOpen(): ApiError {
		return new ApiError(
			503,
			"circuit_open",
			"Service temporarily unavailable",
			crypto.randomUUID(),
		);
	}

	/**
	 * Capture error to Sentry
	 */
	private captureToSentry(): void {
		// Sentry capture would be implemented when Sentry is configured
		// For now, just log
		logger.error("Server error captured", {
			status: this.status,
			code: this.code,
			requestId: this.requestId,
			traceId: this.traceId,
		});

		// When Sentry is configured:
		// import * as Sentry from '@sentry/react'
		// Sentry.captureException(this, {
		//   tags: {
		//     request_id: this.requestId,
		//     error_code: this.code,
		//   },
		// })
	}

	/**
	 * Check if error is a network error
	 */
	isNetworkError(): boolean {
		return this.code === "network_error";
	}

	/**
	 * Check if error is retryable
	 */
	isRetryable(): boolean {
		return (
			this.code === "network_error" ||
			this.code === "server_error" ||
			this.code === "circuit_open"
		);
	}

	/**
	 * Check if error indicates user should re-authenticate
	 */
	shouldReauthenticate(): boolean {
		return this.code === "unauthorized" || this.code === "session_expired";
	}
}

/**
 * Type guard for ApiError
 */
export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}

/**
 * Get error message for display
 */
export function getErrorMessage(error: unknown): string {
	if (isApiError(error)) {
		return error.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "An unexpected error occurred";
}
