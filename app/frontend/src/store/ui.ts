/**
 * UI Store
 *
 * Manages UI state including sidebar, theme, locale, notifications, and connection status.
 * Persisted to localStorage for cross-session persistence.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ColorMode } from "@/lib/color-mode";
import { setColorMode } from "@/lib/color-mode";

/**
 * Notification types
 */
export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
	id: string;
	type: NotificationType;
	title: string;
	body?: string;
	timestamp: number;
	read: boolean;
	link?: string;
}

/**
 * Connection status for WebSocket
 */
export type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface UIState {
	sidebarCollapsed: boolean;
	colorMode: ColorMode;
	locale: string;
	commandPaletteOpen: boolean;
	notifications: Notification[];
	connectionStatus: ConnectionStatus;
}

interface UIActions {
	toggleSidebar: () => void;
	setSidebarCollapsed: (collapsed: boolean) => void;
	setColorMode: (mode: ColorMode) => void;
	setLocale: (locale: string) => void;
	toggleCommandPalette: () => void;
	setCommandPaletteOpen: (open: boolean) => void;
	addNotification: (
		notification: Omit<Notification, "id" | "timestamp" | "read">,
	) => void;
	dismissNotification: (id: string) => void;
	markAllNotificationsRead: () => void;
	setConnectionStatus: (status: ConnectionStatus) => void;
}

type UIStore = UIState & UIActions;

const MAX_NOTIFICATIONS = 100;

const initialState: UIState = {
	sidebarCollapsed: false,
	colorMode: "system",
	locale: "en",
	commandPaletteOpen: false,
	notifications: [],
	connectionStatus: "disconnected",
};

export const useUIStore = create<UIStore>()(
	persist(
		(set) => ({
			...initialState,

			toggleSidebar: () => {
				set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
			},

			setSidebarCollapsed: (collapsed) => {
				set({ sidebarCollapsed: collapsed });
			},

			setColorMode: (mode) => {
				set({ colorMode: mode });
				// Apply the color mode immediately
				setColorMode(mode);
			},

			setLocale: (locale) => {
				set({ locale });
				// Note: Paraglide locale change would be handled in the component
			},

			toggleCommandPalette: () => {
				set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen }));
			},

			setCommandPaletteOpen: (open) => {
				set({ commandPaletteOpen: open });
			},

			addNotification: (notification) => {
				const newNotification: Notification = {
					...notification,
					id: crypto.randomUUID(),
					timestamp: Date.now(),
					read: false,
				};

				set((state) => {
					const notifications = [newNotification, ...state.notifications];
					// Cap at MAX_NOTIFICATIONS with FIFO eviction
					if (notifications.length > MAX_NOTIFICATIONS) {
						return { notifications: notifications.slice(0, MAX_NOTIFICATIONS) };
					}
					return { notifications };
				});
			},

			dismissNotification: (id) => {
				set((state) => ({
					notifications: state.notifications.filter((n) => n.id !== id),
				}));
			},

			markAllNotificationsRead: () => {
				set((state) => ({
					notifications: state.notifications.map((n) => ({ ...n, read: true })),
				}));
			},

			setConnectionStatus: (status) => {
				set({ connectionStatus: status });
			},
		}),
		{
			name: "ui-store",
			storage: createJSONStorage(() => localStorage),
			// Only persist specific fields
			partialize: (state) => ({
				sidebarCollapsed: state.sidebarCollapsed,
				colorMode: state.colorMode,
				locale: state.locale,
			}),
		},
	),
);

/**
 * Get unread notification count
 */
export function useUnreadNotificationCount(): number {
	return useUIStore(
		(state) => state.notifications.filter((n) => !n.read).length,
	);
}

/**
 * Get sidebar collapsed state
 */
export function useSidebarCollapsed(): boolean {
	return useUIStore((state) => state.sidebarCollapsed);
}

/**
 * Get current color mode
 */
export function useColorMode(): ColorMode {
	return useUIStore((state) => state.colorMode);
}

/**
 * Get current locale
 */
export function useLocale(): string {
	return useUIStore((state) => state.locale);
}

/**
 * Get connection status
 */
export function useConnectionStatus(): ConnectionStatus {
	return useUIStore((state) => state.connectionStatus);
}

/**
 * Get command palette open state
 */
export function useCommandPaletteOpen(): boolean {
	return useUIStore((state) => state.commandPaletteOpen);
}

/**
 * Get all notifications
 */
export function useNotifications(): Notification[] {
	return useUIStore((state) => state.notifications);
}
