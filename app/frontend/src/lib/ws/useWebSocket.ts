/**
 * WebSocket Hook
 *
 * React hook for WebSocket integration.
 * Handles connection lifecycle and event processing.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { createLogger } from "@/lib/logger";
import { keys } from "@/lib/query/keys";
import { SESSION_CLEARED_EVENT, useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";
import { getWSClient, resetWSClient, type WSClient } from "./client";
import type {
	DataChangedPayload,
	NotificationPayload,
	WSMessage,
} from "./events";

const logger = createLogger({ module: "useWebSocket" });

/**
 * Hook for WebSocket connection management
 */
export function useWebSocket(): {
	isConnected: boolean;
	send: (data: unknown) => boolean;
} {
	const queryClient = useQueryClient();
	const wsClientRef = useRef<WSClient | null>(null);
	const isAuthenticated = useAuthStore((state) => state.user !== null);
	const setConnectionStatus = useUIStore((state) => state.setConnectionStatus);
	const addNotification = useUIStore((state) => state.addNotification);
	const clearAuth = useAuthStore((state) => state.clearAuth);

	/**
	 * Handle incoming WebSocket messages
	 */
	const handleMessage = useCallback(
		(message: WSMessage) => {
			logger.debug("Received WebSocket message", { type: message.event });

			switch (message.event) {
				case "notification": {
					const data = message.data as NotificationPayload;
					addNotification({
						type: data.type,
						title: data.title,
						body: data.body,
						link: data.link,
					});
					break;
				}

				case "data_changed": {
					const data = message.data as DataChangedPayload;
					// Invalidate relevant queries based on module
					const { module, resource } = data;
					logger.info("Data changed event", { module, resource });

					// Invalidate module-specific queries
					// This will be extended as modules are implemented
					if (module in keys) {
						queryClient.invalidateQueries({
							queryKey: [module],
						});
					}
					break;
				}

				case "session_invalidated": {
					logger.warn("Session invalidated by server", {
						reason: message.data,
					});
					clearAuth();
					// Redirect to login
					window.location.href = "/login?session_expired=true";
					break;
				}

				case "ping": {
					// Respond to ping with pong
					wsClientRef.current?.send({ event: "pong", timestamp: Date.now() });
					break;
				}

				default: {
					logger.warn("Unknown WebSocket event", { event: message.event });
				}
			}
		},
		[addNotification, queryClient, clearAuth],
	);

	/**
	 * Handle connection status changes
	 */
	const handleStatusChange = useCallback(
		(status: "connected" | "connecting" | "disconnected") => {
			setConnectionStatus(status);
		},
		[setConnectionStatus],
	);

	/**
	 * Initialize WebSocket connection
	 */
	useEffect(() => {
		if (!isAuthenticated) {
			// Disconnect if not authenticated
			if (wsClientRef.current) {
				wsClientRef.current.disconnect();
				wsClientRef.current = null;
			}
			return;
		}

		// Create and connect WebSocket
		wsClientRef.current = getWSClient({
			onMessage: handleMessage,
			onStatusChange: handleStatusChange,
		});

		wsClientRef.current.connect();

		return () => {
			// Cleanup on unmount
			if (wsClientRef.current) {
				wsClientRef.current.disconnect();
			}
		};
	}, [isAuthenticated, handleMessage, handleStatusChange]);

	/**
	 * Listen for cross-tab session clear events
	 */
	useEffect(() => {
		const handleStorageEvent = (event: StorageEvent) => {
			if (event.key === SESSION_CLEARED_EVENT) {
				logger.info("Session cleared in another tab");
				resetWSClient();
			}
		};

		window.addEventListener("storage", handleStorageEvent);
		return () => window.removeEventListener("storage", handleStorageEvent);
	}, []);

	return {
		isConnected: wsClientRef.current?.isConnected() ?? false,
		send: (data: unknown) => wsClientRef.current?.send(data) ?? false,
	};
}

/**
 * Hook for subscribing to specific WebSocket events
 */
export function useWSSubscription<T extends WSMessage["event"]>(
	_eventType: T,
	handler: (payload: Extract<WSMessage, { type: T }>["data"]) => void,
): void {
	const handlerRef = useRef(handler);
	handlerRef.current = handler;

	// This would be implemented with a proper event emitter pattern
	// For now, it's a placeholder for the pattern
}
