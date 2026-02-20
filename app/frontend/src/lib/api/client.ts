/**
 * API Client
 *
 * Central Axios instance with:
 * - Cookie-based authentication (withCredentials)
 * - CSRF token injection
 * - Request ID tracing
 * - Exponential backoff retry
 * - Circuit breaker integration
 * - 401 silent refresh
 */

import axios, {
	type AxiosError,
	type AxiosInstance,
	type InternalAxiosRequestConfig,
} from "axios";
import { env } from "@/env";
import { createLogger } from "@/lib/logger";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";
import { getCircuitBreaker } from "./circuit-breaker";
import { ApiError } from "./errors";

const logger = createLogger({ module: "api-client" });

/**
 * CSRF cookie name (must match server)
 */
const CSRF_COOKIE_NAME = "__Host-csrf";

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
	maxRetries: 3,
	baseDelay: 500, // ms
	maxDelay: 2000, // ms
	jitter: 100, // ms
};

/**
 * Request config extension for retry tracking
 */
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
	_retryCount?: number;
	_skipCircuitBreaker?: boolean;
	_skipRetry?: boolean;
}

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
	if (typeof document === "undefined") return null;

	const cookies = document.cookie.split(";");
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split("=");
		if (name === CSRF_COOKIE_NAME) {
			return value;
		}
	}
	return null;
}

/**
 * Generate request ID
 */
function generateRequestId(): string {
	return crypto.randomUUID();
}

/**
 * Calculate retry delay with exponential backoff and jitter
 */
function calculateRetryDelay(attempt: number): number {
	const delay = Math.min(
		RETRY_CONFIG.baseDelay * 2 ** attempt,
		RETRY_CONFIG.maxDelay,
	);
	const jitter = Math.random() * RETRY_CONFIG.jitter;
	return delay + jitter;
}

/**
 * Check if request should be retried
 */
function shouldRetry(
	error: AxiosError,
	config: ExtendedAxiosRequestConfig,
): boolean {
	// Skip retry if explicitly disabled
	if (config._skipRetry) return false;

	// Only retry GET, PUT, DELETE (not POST, PATCH)
	const method = config.method?.toUpperCase();
	if (method === "POST" || method === "PATCH") return false;

	// Check retry count
	if ((config._retryCount ?? 0) >= RETRY_CONFIG.maxRetries) return false;

	// Retry on network errors
	if (!error.response) return true;

	// Retry on 5xx errors
	const status = error.response.status;
	return status >= 500 && status < 600;
}

/**
 * Create the main API client instance
 */
function createApiClient(): AxiosInstance {
	const instance = axios.create({
		baseURL: env.VITE_API_URL,
		timeout: 30000,
		withCredentials: true, // Send cookies
		headers: {
			"Content-Type": "application/json",
		},
	});

	// Request interceptor
	instance.interceptors.request.use(
		(config: ExtendedAxiosRequestConfig) => {
			// Check circuit breaker (unless skipped)
			if (!config._skipCircuitBreaker) {
				const circuitBreaker = getCircuitBreaker();
				if (circuitBreaker.isOpen()) {
					throw ApiError.circuitOpen();
				}
			}

			// Add CSRF token for state-mutating requests
			const method = config.method?.toUpperCase();
			if (["POST", "PUT", "PATCH", "DELETE"].includes(method ?? "")) {
				const csrfToken = getCsrfToken();
				if (csrfToken) {
					config.headers["X-CSRF-Token"] = csrfToken;
				}
			}

			// Add request ID for tracing
			const requestId = generateRequestId();
			config.headers["X-Request-ID"] = requestId;

			// Add Accept-Language from UI store
			const locale = useUIStore.getState().locale;
			config.headers["Accept-Language"] = locale;

			logger.debug("Request started", {
				method: config.method,
				url: config.url,
				requestId,
			});

			return config;
		},
		(error) => {
			return Promise.reject(error);
		},
	);

	// Response interceptor
	instance.interceptors.response.use(
		(response) => {
			// Record success for circuit breaker
			const circuitBreaker = getCircuitBreaker();
			circuitBreaker.recordSuccess();

			logger.debug("Request succeeded", {
				status: response.status,
				url: response.config.url,
			});

			return response;
		},
		async (error: AxiosError) => {
			const config = error.config as ExtendedAxiosRequestConfig;

			// Convert to ApiError
			const apiError = ApiError.fromAxiosError(error);

			// Handle 401 - attempt silent refresh
			if (apiError.status === 401 && !config._skipRetry) {
				try {
					// Attempt to refresh the session
					await instance.get("/auth/refresh", {
						_skipCircuitBreaker: true,
						_skipRetry: true,
					} as ExtendedAxiosRequestConfig);

					// Retry original request
					config._retryCount = (config._retryCount ?? 0) + 1;
					return instance.request(config);
				} catch (_refreshError) {
					// Refresh failed - clear auth and redirect to login
					logger.warn("Session refresh failed, redirecting to login");
					useAuthStore.getState().clearAuth();

					// Redirect to login with session_expired flag
					if (typeof window !== "undefined") {
						window.location.href = "/login?session_expired=true";
					}

					return Promise.reject(apiError);
				}
			}

			// Record failure for circuit breaker (unless skipped)
			if (!config._skipCircuitBreaker) {
				const circuitBreaker = getCircuitBreaker();
				circuitBreaker.recordFailure();
			}

			// Check for retry
			if (shouldRetry(error, config)) {
				const retryCount = config._retryCount ?? 0;
				const delay = calculateRetryDelay(retryCount);

				logger.warn("Retrying request", {
					url: config.url,
					retryCount: retryCount + 1,
					delay,
				});

				await new Promise((resolve) => setTimeout(resolve, delay));

				config._retryCount = retryCount + 1;
				return instance.request(config);
			}

			return Promise.reject(apiError);
		},
	);

	return instance;
}

/**
 * Global API client instance
 */
let apiClient: AxiosInstance | null = null;

/**
 * Get the API client instance
 */
export function getApiClient(): AxiosInstance {
	if (!apiClient) {
		apiClient = createApiClient();
	}
	return apiClient;
}

/**
 * Reset the API client (for testing)
 */
export function resetApiClient(): void {
	apiClient = null;
}

// Export the client as default
export default getApiClient;
