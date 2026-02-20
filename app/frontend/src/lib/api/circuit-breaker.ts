/**
 * Circuit Breaker
 *
 * Prevents cascading failures by failing fast when the backend is unhealthy.
 * Opens after 5 consecutive failures within 60 seconds.
 * Probes the server every 30 seconds to check if it's recovered.
 */

import { createLogger } from "@/lib/logger";

const logger = createLogger({ module: "circuit-breaker" });

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerConfig {
	/** Number of consecutive failures before opening */
	failureThreshold: number;
	/** Time window for counting failures (ms) */
	failureWindow: number;
	/** Time to wait before probing (ms) */
	probeInterval: number;
	/** Health check endpoint */
	healthEndpoint: string;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
	failureThreshold: 5,
	failureWindow: 60000, // 60 seconds
	probeInterval: 30000, // 30 seconds
	healthEndpoint: "/health",
};

interface FailureRecord {
	timestamp: number;
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
	private state: CircuitState = "closed";
	private failures: FailureRecord[] = [];
	private lastProbeTime = 0;
	private config: CircuitBreakerConfig;
	private onStateChange?: (state: CircuitState) => void;

	constructor(
		config: Partial<CircuitBreakerConfig> = {},
		onStateChange?: (state: CircuitState) => void,
	) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.onStateChange = onStateChange;
	}

	/**
	 * Check if requests should be allowed
	 */
	isOpen(): boolean {
		this.cleanOldFailures();

		if (this.state === "closed") {
			return false;
		}

		if (this.state === "open") {
			// Check if we should probe
			const now = Date.now();
			if (now - this.lastProbeTime >= this.config.probeInterval) {
				this.transitionTo("half-open");
				return false; // Allow probe request
			}
			return true;
		}

		// half-open: allow one request through
		return false;
	}

	/**
	 * Record a successful request
	 */
	recordSuccess(): void {
		if (this.state === "half-open") {
			logger.info("Circuit breaker recovered");
			this.failures = [];
			this.transitionTo("closed");
		}
	}

	/**
	 * Record a failed request
	 */
	recordFailure(): void {
		this.failures.push({ timestamp: Date.now() });
		this.cleanOldFailures();

		if (this.state === "half-open") {
			logger.warn("Circuit breaker probe failed, reopening");
			this.transitionTo("open");
			return;
		}

		if (this.failures.length >= this.config.failureThreshold) {
			logger.error("Circuit breaker opening due to consecutive failures", {
				failureCount: this.failures.length,
				threshold: this.config.failureThreshold,
			});
			this.transitionTo("open");
		}
	}

	/**
	 * Get current state
	 */
	getState(): CircuitState {
		return this.state;
	}

	/**
	 * Get health endpoint for probing
	 */
	getHealthEndpoint(): string {
		return this.config.healthEndpoint;
	}

	/**
	 * Reset the circuit breaker
	 */
	reset(): void {
		this.failures = [];
		this.transitionTo("closed");
	}

	/**
	 * Clean failures outside the time window
	 */
	private cleanOldFailures(): void {
		const cutoff = Date.now() - this.config.failureWindow;
		this.failures = this.failures.filter((f) => f.timestamp > cutoff);
	}

	/**
	 * Transition to a new state
	 */
	private transitionTo(newState: CircuitState): void {
		if (this.state !== newState) {
			const oldState = this.state;
			this.state = newState;
			this.lastProbeTime =
				newState === "open" ? Date.now() : this.lastProbeTime;

			logger.info("Circuit breaker state changed", {
				from: oldState,
				to: newState,
			});
			this.onStateChange?.(newState);
		}
	}
}

/**
 * Global circuit breaker instance
 */
let globalCircuitBreaker: CircuitBreaker | null = null;

/**
 * Get or create the global circuit breaker
 */
export function getCircuitBreaker(
	config?: Partial<CircuitBreakerConfig>,
	onStateChange?: (state: CircuitState) => void,
): CircuitBreaker {
	if (!globalCircuitBreaker) {
		globalCircuitBreaker = new CircuitBreaker(config, onStateChange);
	}
	return globalCircuitBreaker;
}

/**
 * Reset the global circuit breaker (for testing)
 */
export function resetCircuitBreaker(): void {
	globalCircuitBreaker = null;
}
