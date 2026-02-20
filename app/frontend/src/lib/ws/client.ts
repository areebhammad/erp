/**
 * WebSocket Client
 *
 * Managed WebSocket with:
 * - Auto-reconnect with exponential backoff
 * - Connection status tracking
 * - Event-based message handling
 */

import { env } from "@/env";
import { createLogger } from "@/lib/logger";
import type { ConnectionStatus } from "@/store/ui";
import type { WSMessage } from "./events";
import { parseWSMessage } from "./events";

const logger = createLogger({ module: "ws-client" });

/**
 * Reconnection configuration
 */
const RECONNECT_CONFIG = {
	baseDelay: 1000, // 1 second
	maxDelay: 30000, // 30 seconds
	jitter: 500, // ms
};

/**
 * WebSocket event callbacks
 */
export interface WSCallbacks {
	onMessage: (message: WSMessage) => void;
	onStatusChange: (status: ConnectionStatus) => void;
}

/**
 * WebSocket client class
 */
export class WSClient {
	private ws: WebSocket | null = null;
	private url: string;
	private callbacks: WSCallbacks;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts = 0;
	private isIntentionallyClosed = false;

	constructor(callbacks: WSCallbacks) {
		this.url = env.VITE_WS_URL;
		this.callbacks = callbacks;
	}

	/**
	 * Connect to the WebSocket server
	 */
	connect(): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			logger.warn("WebSocket already connected");
			return;
		}

		this.isIntentionallyClosed = false;
		this.callbacks.onStatusChange("connecting");

		try {
			this.ws = new WebSocket(this.url);
			this.setupEventHandlers();
		} catch (error) {
			logger.error("Failed to create WebSocket", { error });
			this.scheduleReconnect();
		}
	}

	/**
	 * Disconnect from the WebSocket server
	 */
	disconnect(): void {
		this.isIntentionallyClosed = true;
		this.clearReconnectTimeout();

		if (this.ws) {
			this.ws.close(1000, "Client disconnect");
			this.ws = null;
		}

		this.callbacks.onStatusChange("disconnected");
	}

	/**
	 * Send a message to the server
	 */
	send(data: unknown): boolean {
		if (this.ws?.readyState !== WebSocket.OPEN) {
			logger.warn("Cannot send message - WebSocket not connected");
			return false;
		}

		try {
			this.ws.send(JSON.stringify(data));
			return true;
		} catch (error) {
			logger.error("Failed to send message", { error });
			return false;
		}
	}

	/**
	 * Get current connection state
	 */
	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	/**
	 * Setup WebSocket event handlers
	 */
	private setupEventHandlers(): void {
		if (!this.ws) return;

		this.ws.onopen = () => {
			logger.info("WebSocket connected");
			this.reconnectAttempts = 0;
			this.callbacks.onStatusChange("connected");
		};

		this.ws.onmessage = (event) => {
			const message = parseWSMessage(event.data);
			if (message) {
				this.callbacks.onMessage(message);
			} else {
				logger.warn("Received invalid WebSocket message", { data: event.data });
			}
		};

		this.ws.onclose = (event) => {
			logger.info("WebSocket closed", {
				code: event.code,
				reason: event.reason,
			});
			this.ws = null;

			if (!this.isIntentionallyClosed) {
				this.callbacks.onStatusChange("disconnected");
				this.scheduleReconnect();
			}
		};

		this.ws.onerror = (error) => {
			logger.error("WebSocket error", { error });
			// Don't change status here - onclose will be called next
		};
	}

	/**
	 * Schedule a reconnection attempt
	 */
	private scheduleReconnect(): void {
		if (this.isIntentionallyClosed) return;

		this.clearReconnectTimeout();

		const delay = this.calculateReconnectDelay();
		this.reconnectAttempts++;

		logger.info("Scheduling reconnect", {
			attempt: this.reconnectAttempts,
			delay,
		});

		this.reconnectTimeout = setTimeout(() => {
			this.connect();
		}, delay);
	}

	/**
	 * Calculate reconnect delay with exponential backoff and jitter
	 */
	private calculateReconnectDelay(): number {
		const delay = Math.min(
			RECONNECT_CONFIG.baseDelay * 2 ** this.reconnectAttempts,
			RECONNECT_CONFIG.maxDelay,
		);
		const jitter = Math.random() * RECONNECT_CONFIG.jitter;
		return delay + jitter;
	}

	/**
	 * Clear reconnect timeout
	 */
	private clearReconnectTimeout(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
	}
}

/**
 * Global WebSocket client instance
 */
let globalWSClient: WSClient | null = null;

/**
 * Get or create the global WebSocket client
 */
export function getWSClient(callbacks: WSCallbacks): WSClient {
	if (!globalWSClient) {
		globalWSClient = new WSClient(callbacks);
	}
	return globalWSClient;
}

/**
 * Reset the global WebSocket client (for testing)
 */
export function resetWSClient(): void {
	if (globalWSClient) {
		globalWSClient.disconnect();
		globalWSClient = null;
	}
}
