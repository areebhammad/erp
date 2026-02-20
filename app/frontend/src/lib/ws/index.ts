/**
 * WebSocket Module Index
 *
 * Re-exports all WebSocket-related functionality.
 */

// Client
export {
	getWSClient,
	resetWSClient,
	type WSCallbacks,
	WSClient,
} from "./client";

// Events
export {
	type DataChangedPayload,
	type NotificationPayload,
	type PingPayload,
	parseWSMessage,
	type SessionInvalidatedPayload,
	type WSEvent,
	type WSMessage,
} from "./events";

// Hook
export {
	useWebSocket,
	useWSSubscription,
} from "./useWebSocket";
