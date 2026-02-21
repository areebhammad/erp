import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './auth';

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store
    useAuthStore.setState({
      user: null,
      sessionId: null,
      isAuthenticated: false,
    });
    // Clear session storage mock
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets user and sessionId, marking as authenticated', () => {
    const user = { id: '1', email: 'test@example.com', full_name: 'Test User' };

    useAuthStore.getState().setUser(user, 'session123');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.sessionId).toBe('session123');
    expect(state.isAuthenticated).toBe(true);
  });

  it('clearAuth clears state and sets localStorage event', () => {
    useAuthStore.setState({
      user: { id: '1', email: 't', full_name: 'T' },
      sessionId: 'sess',
      isAuthenticated: true,
    });

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.isAuthenticated).toBe(false);

    expect(setItemSpy).toHaveBeenCalledWith(
      '__session_clear',
      expect.any(String)
    );
    expect(dispatchEventSpy).toHaveBeenCalled();
  });
});
