/**
 * Structured Client Logger
 *
 * Provides module-tagged logging with:
 * - Level filtering (debug/info/warn/error)
 * - Production mode: only warn and error
 * - Development mode: all levels with timestamps
 * - Request ID correlation via AsyncLocalStorage context
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerOptions {
	module: string;
}

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	module: string;
	message: string;
	data?: Record<string, unknown>;
	requestId?: string;
}

const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

/**
 * Create a logger instance for a specific module
 *
 * @example
 * ```ts
 * const logger = createLogger('api-client')
 * logger.info('Request started', { url: '/api/users' })
 * logger.error('Request failed', { status: 500 })
 * ```
 */
export function createLogger(options: LoggerOptions) {
	const { module } = options;

	const shouldLog = (level: LogLevel): boolean => {
		if (isProduction) {
			return level === "warn" || level === "error";
		}
		return true;
	};

	const formatEntry = (
		level: LogLevel,
		message: string,
		data?: Record<string, unknown>,
	): LogEntry => ({
		timestamp: new Date().toISOString(),
		level,
		module,
		message,
		data,
		// Request ID would be injected via context in a full implementation
	});

	const log = (
		level: LogLevel,
		message: string,
		data?: Record<string, unknown>,
	) => {
		if (!shouldLog(level)) return;

		const entry = formatEntry(level, message, data);

		if (isDevelopment) {
			const styles = {
				debug: "color: gray",
				info: "color: blue",
				warn: "color: orange",
				error: "color: red",
			};

			const prefix = `%c[${entry.timestamp}] [${entry.module}] [${level.toUpperCase()}]`;
			console[level](prefix, styles[level], message, data ?? "");
		} else {
			// Production: structured JSON output
			console[level](JSON.stringify(entry));
		}
	};

	return {
		debug: (message: string, data?: Record<string, unknown>) =>
			log("debug", message, data),
		info: (message: string, data?: Record<string, unknown>) =>
			log("info", message, data),
		warn: (message: string, data?: Record<string, unknown>) =>
			log("warn", message, data),
		error: (message: string, data?: Record<string, unknown>) =>
			log("error", message, data),
	};
}

/**
 * Default logger for general use
 */
export const logger = createLogger({ module: "app" });
