/**
 * Notification Drawer Component
 *
 * A slide-out drawer displaying notifications with grouping by time,
 * mark as read functionality, and dismiss actions.
 */

import { Link } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	Bell,
	CheckCheck,
	CheckCircle,
	Info,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
	type Notification,
	type NotificationType,
	useNotifications,
	useUIStore,
	useUnreadNotificationCount,
} from "@/store/ui";

interface NotificationDrawerProps {
	/** Whether the drawer is open */
	open: boolean;
	/** Callback when open state changes */
	onOpenChange: (open: boolean) => void;
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: NotificationType) {
	switch (type) {
		case "success":
			return CheckCircle;
		case "warning":
			return AlertTriangle;
		case "error":
			return AlertCircle;
		default:
			return Info;
	}
}

/**
 * Get color classes for notification type
 */
function getNotificationColor(type: NotificationType): string {
	switch (type) {
		case "success":
			return "text-green-500";
		case "warning":
			return "text-yellow-500";
		case "error":
			return "text-red-500";
		default:
			return "text-blue-500";
	}
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		return days === 1 ? "Yesterday" : `${days} days ago`;
	}
	if (hours > 0) {
		return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
	}
	if (minutes > 0) {
		return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
	}
	return "Just now";
}

/**
 * Group notifications by time period
 */
function groupNotifications(notifications: Notification[]): {
	today: Notification[];
	yesterday: Notification[];
	older: Notification[];
} {
	const todayStart = new Date().setHours(0, 0, 0, 0);
	const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

	return notifications.reduce(
		(groups, notification) => {
			if (notification.timestamp >= todayStart) {
				groups.today.push(notification);
			} else if (notification.timestamp >= yesterdayStart) {
				groups.yesterday.push(notification);
			} else {
				groups.older.push(notification);
			}
			return groups;
		},
		{ today: [], yesterday: [], older: [] } as {
			today: Notification[];
			yesterday: Notification[];
			older: Notification[];
		},
	);
}

/**
 * Single notification item
 */
function NotificationItem({
	notification,
	onDismiss,
}: {
	notification: Notification;
	onDismiss: (id: string) => void;
}) {
	const Icon = getNotificationIcon(notification.type);
	const colorClass = getNotificationColor(notification.type);

	const content = (
		<div
			className={`group flex gap-3 rounded-lg p-3 transition-colors hover:bg-muted ${
				notification.read ? "opacity-60" : ""
			}`}
		>
			<div className={`mt-0.5 flex-shrink-0 ${colorClass}`}>
				<Icon className="h-5 w-5" />
			</div>
			<div className="min-w-0 flex-1">
				<p
					className={`text-sm ${notification.read ? "font-normal" : "font-medium"}`}
				>
					{notification.title}
				</p>
				{notification.body && (
					<p className="mt-1 text-sm text-muted-foreground line-clamp-2">
						{notification.body}
					</p>
				)}
				<p className="mt-1 text-xs text-muted-foreground">
					{formatRelativeTime(notification.timestamp)}
				</p>
			</div>
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onDismiss(notification.id);
				}}
				className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
				aria-label="Dismiss notification"
			>
				<X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
			</button>
		</div>
	);

	if (notification.link) {
		return (
			<Link to={notification.link} className="block">
				{content}
			</Link>
		);
	}

	return content;
}

/**
 * Notification group with heading
 */
function NotificationGroup({
	title,
	notifications,
	onDismiss,
}: {
	title: string;
	notifications: Notification[];
	onDismiss: (id: string) => void;
}) {
	if (notifications.length === 0) return null;

	return (
		<div className="mb-4">
			<h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
				{title}
			</h3>
			<div className="space-y-1">
				{notifications.map((notification) => (
					<NotificationItem
						key={notification.id}
						notification={notification}
						onDismiss={onDismiss}
					/>
				))}
			</div>
		</div>
	);
}

/**
 * Notification Drawer component
 */
export function NotificationDrawer({
	open,
	onOpenChange,
}: NotificationDrawerProps) {
	const notifications = useNotifications();
	const unreadCount = useUnreadNotificationCount();
	const { dismissNotification, markAllNotificationsRead } = useUIStore();

	const groupedNotifications = useMemo(
		() => groupNotifications(notifications),
		[notifications],
	);

	const handleDismiss = useCallback(
		(id: string) => {
			dismissNotification(id);
		},
		[dismissNotification],
	);

	const handleMarkAllRead = useCallback(() => {
		markAllNotificationsRead();
	}, [markAllNotificationsRead]);

	const handleClearAll = useCallback(() => {
		// Dismiss all notifications
		for (const notification of notifications) {
			dismissNotification(notification.id);
		}
	}, [notifications, dismissNotification]);

	return (
		<>
			{/* Backdrop */}
			{open && (
				<div
					className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
					onClick={() => onOpenChange(false)}
					aria-hidden="true"
				/>
			)}

			{/* Drawer */}
			<div
				className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform border-l border-border bg-background shadow-xl transition-transform duration-300 ease-in-out ${
					open ? "translate-x-0" : "translate-x-full"
				}`}
				role="dialog"
				aria-modal="true"
				aria-label="Notifications"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<div className="flex items-center gap-2">
						<Bell className="h-5 w-5" />
						<h2 className="text-lg font-semibold">Notifications</h2>
						{unreadCount > 0 && (
							<span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
								{unreadCount}
							</span>
						)}
					</div>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="rounded-lg p-1 hover:bg-muted"
						aria-label="Close notifications"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Actions */}
				{notifications.length > 0 && (
					<div className="flex items-center justify-between border-b border-border px-4 py-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleMarkAllRead}
							disabled={unreadCount === 0}
							className="text-xs"
						>
							<CheckCheck className="mr-1 h-3 w-3" />
							Mark all read
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleClearAll}
							className="text-xs text-destructive hover:text-destructive"
						>
							<Trash2 className="mr-1 h-3 w-3" />
							Clear all
						</Button>
					</div>
				)}

				{/* Content */}
				<div className="h-[calc(100%-8rem)] overflow-y-auto p-2">
					{notifications.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center text-center">
							<Bell className="mb-4 h-12 w-12 text-muted-foreground/50" />
							<p className="text-lg font-medium">No notifications</p>
							<p className="mt-1 text-sm text-muted-foreground">
								You're all caught up!
							</p>
						</div>
					) : (
						<>
							<NotificationGroup
								title="Today"
								notifications={groupedNotifications.today}
								onDismiss={handleDismiss}
							/>
							<NotificationGroup
								title="Yesterday"
								notifications={groupedNotifications.yesterday}
								onDismiss={handleDismiss}
							/>
							<NotificationGroup
								title="Older"
								notifications={groupedNotifications.older}
								onDismiss={handleDismiss}
							/>
						</>
					)}
				</div>
			</div>
		</>
	);
}

export default NotificationDrawer;
