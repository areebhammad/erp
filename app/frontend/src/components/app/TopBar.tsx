/**
 * TopBar Component
 *
 * Top navigation bar with:
 * - Tenant logo/name
 * - Breadcrumbs
 * - Connection status
 * - Command palette trigger
 * - Notifications
 * - User menu
 */

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	useAuthStore,
	useConnectionStatus,
	useTenantName,
	useUIStore,
	useUnreadNotificationCount,
} from "@/store";

/**
 * Connection status indicator
 */
function ConnectionIndicator(): ReactNode {
	const status = useConnectionStatus();

	const statusColors = {
		connected: "bg-success",
		connecting: "bg-warning animate-pulse",
		disconnected: "bg-error",
	};

	return (
		<div
			className={`h-2 w-2 rounded-full ${statusColors[status]}`}
			title={`Connection: ${status}`}
			role="status"
		/>
	);
}

/**
 * TopBar component
 */
export function TopBar(): ReactNode {
	const tenantName = useTenantName();
	const unreadCount = useUnreadNotificationCount();
	const user = useAuthStore((state) => state.user);
	const toggleCommandPalette = useUIStore(
		(state) => state.toggleCommandPalette,
	);

	return (
		<div className="flex h-full items-center justify-between px-4">
			{/* Left section: Tenant */}
			<div className="flex items-center gap-4">
				<Link to="/" className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
						{tenantName.charAt(0).toUpperCase()}
					</div>
					<span className="font-medium text-foreground">{tenantName}</span>
				</Link>
			</div>

			{/* Center section: Command palette trigger */}
			<div className="flex-1 max-w-md mx-4">
				<button
					type="button"
					onClick={toggleCommandPalette}
					className="w-full flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
				>
					<span>Search...</span>
					<kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
						⌘K
					</kbd>
				</button>
			</div>

			{/* Right section: Status, notifications, user */}
			<div className="flex items-center gap-4">
				{/* Connection status */}
				<div className="flex items-center gap-2">
					<ConnectionIndicator />
				</div>

				{/* Notifications */}
				<button
					type="button"
					className="relative rounded-md p-2 text-muted-foreground hover:bg-accent"
					aria-label={`Notifications (${unreadCount} unread)`}
				>
					<span>🔔</span>
					{unreadCount > 0 && (
						<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] text-error-foreground">
							{unreadCount > 9 ? "9+" : unreadCount}
						</span>
					)}
				</button>

				{/* User menu */}
				<div className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-medium">
						{user?.fullName?.charAt(0).toUpperCase() ?? "?"}
					</div>
					<div className="hidden md:block">
						<div className="text-sm font-medium text-foreground">
							{user?.fullName ?? "User"}
						</div>
						<div className="text-xs text-muted-foreground">{user?.email}</div>
					</div>
				</div>
			</div>
		</div>
	);
}
