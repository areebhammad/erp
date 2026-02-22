import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
// @ts-ignore
import { setLocale as setParaglideLocale } from '@/paraglide/runtime';

export type ColorMode = 'light' | 'dark' | 'system';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body?: string;
  timestamp: string; // ISO string
  read: boolean;
  link?: string;
}

export interface UIState {
  sidebarCollapsed: boolean;
  colorMode: ColorMode;
  locale: string;
  commandPaletteOpen: boolean;
  notifications: Notification[];
  connectionStatus: ConnectionStatus;

  toggleSidebar: () => void;
  setColorMode: (mode: ColorMode) => void;
  setLocale: (locale: string) => void;

  addNotification: (
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) => void;
  dismissNotification: (id: string) => void;
  markAllNotificationsRead: () => void;

  setConnectionStatus: (status: ConnectionStatus) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      colorMode: 'system',
      locale: 'en',
      commandPaletteOpen: false,
      notifications: [],
      connectionStatus: 'connected',

      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),

      setColorMode: (mode) => {
        set({ colorMode: mode });
        if (typeof window !== 'undefined') {
          const isDark =
            mode === 'dark' ||
            (mode === 'system' &&
              window.matchMedia('(prefers-color-scheme: dark)').matches);

          if (isDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },

      setLocale: (locale) => {
        set({ locale });
        // NOTE: paraglide.setLocale(locale) can be added here once paraglide is imported
        setParaglideLocale(locale as any);
      },

      addNotification: (notification) => {
        set((state) => {
          const newNotif: Notification = {
            ...notification,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            read: false,
          };
          const newNotifications = [newNotif, ...state.notifications].slice(
            0,
            100
          );
          return { notifications: newNotifications };
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

      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        colorMode: state.colorMode,
        locale: state.locale,
      }),
    }
  )
);
