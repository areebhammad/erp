import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from './ui';

describe('UI Store', () => {
  beforeEach(() => {
    // Reset state directly
    useUIStore.setState({
      sidebarCollapsed: false,
      colorMode: 'system',
      locale: 'en',
      commandPaletteOpen: false,
      notifications: [],
      connectionStatus: 'connected',
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toggles sidebar state', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it('sets color mode and toggles dark class', () => {
    const classListAddSpy = vi.spyOn(document.documentElement.classList, 'add');
    const classListRemoveSpy = vi.spyOn(
      document.documentElement.classList,
      'remove'
    );

    useUIStore.getState().setColorMode('dark');

    expect(useUIStore.getState().colorMode).toBe('dark');
    expect(classListAddSpy).toHaveBeenCalledWith('dark');

    useUIStore.getState().setColorMode('light');

    expect(useUIStore.getState().colorMode).toBe('light');
    expect(classListRemoveSpy).toHaveBeenCalledWith('dark');

    // Test system branch
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
      })),
    });

    useUIStore.getState().setColorMode('system');
    expect(useUIStore.getState().colorMode).toBe('system');
    expect(classListAddSpy).toHaveBeenCalledWith('dark');
  });

  it('adds notifications and evicts after 100', () => {
    for (let i = 0; i < 105; i++) {
      useUIStore.getState().addNotification({
        type: 'info',
        title: `Test ${i}`,
      });
    }

    const state = useUIStore.getState();
    expect(state.notifications.length).toBe(100);
    // latest are pushed first (unshift-like)
    expect(state.notifications[0].title).toBe('Test 104');
    expect(state.notifications[99].title).toBe('Test 5'); // "Test 0" ~ 4 are evicted
  });

  it('dismisses notification by ID', () => {
    useUIStore.getState().addNotification({ type: 'info', title: 'A' });
    const notification = useUIStore.getState().notifications[0];

    useUIStore.getState().dismissNotification(notification.id);
    expect(useUIStore.getState().notifications).toHaveLength(0);
  });

  it('marks all as read', () => {
    useUIStore.getState().addNotification({ type: 'info', title: 'A' });
    expect(useUIStore.getState().notifications[0].read).toBe(false);

    useUIStore.getState().markAllNotificationsRead();
    expect(useUIStore.getState().notifications[0].read).toBe(true);
  });

  it('sets locale', () => {
    expect(useUIStore.getState().locale).toBe('en');
    useUIStore.getState().setLocale('hi');
    expect(useUIStore.getState().locale).toBe('hi');
  });

  it('sets connection status', () => {
    expect(useUIStore.getState().connectionStatus).toBe('connected');
    useUIStore.getState().setConnectionStatus('disconnected');
    expect(useUIStore.getState().connectionStatus).toBe('disconnected');
  });

  it('sets command palette open', () => {
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
    useUIStore.getState().setCommandPaletteOpen(true);
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });
});
