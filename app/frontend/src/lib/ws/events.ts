/**
 * WebSocket Event Types
 *
 * Typed discriminated union of all WebSocket event types.
 */

/**
 * Notification payload
 */
export interface NotificationPayload {
	id: string;
	type: "info" | "success" | "warning" | "error";
	title: string;
	body?: string;
	link?: string;
}

/**
 * Data changed event payload
 */
export interface DataChangedPayload {
	module: string;
	resource: string;
	resourceId: string;
	action: "create" | "update" | "delete";
	tenantId: string;
}

/**
 * Session invalidated event (forces logout)
 */
export interface SessionInvalidatedPayload {
	reason: "admin_revoked" | "password_changed" | "security_breach";
}

/**
 * Ping event (keepalive)
 */
export interface PingPayload {
	timestamp: number;
}

/**
 * All WebSocket event types
 */
export type WSEvent =
	| { type: "notification"; payload: NotificationPayload }
	| { type: "data_changed"; payload: DataChangedPayload }
	| { type: "session_invalidated"; payload: SessionInvalidatedPayload }
	| { type: "ping"; payload: PingPayload };

/**
 * WebSocket message wrapper
 */
export interface WSMessage<T extends WSEvent = WSEvent> {
	event: T["type"];
	data: T["payload"];
	timestamp: number;
}

/**
 * Parse a WebSocket message
 */
export function parseWSMessage(raw: string): WSMessage | null {
	try {
		const parsed = JSON.parse(raw) as WSMessage;
		if (!parsed.event || !parsed.timestamp) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}
