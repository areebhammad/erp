import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WSClient } from './client';
import { useWSClient, WSContext } from './context';
import { useWebSocket } from './useWebSocket';

describe('useWebSocket', () => {
  it('subscribes to events correctly', () => {
    const subscribeMock = vi.fn().mockReturnValue(vi.fn());
    const mockClient = { subscribe: subscribeMock } as unknown as WSClient;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WSContext.Provider value={mockClient}>{children}</WSContext.Provider>
    );

    const callback = vi.fn();
    const { unmount } = renderHook(
      () => useWebSocket('session_invalidated', callback),
      {
        wrapper,
      }
    );

    expect(subscribeMock).toHaveBeenCalled();
    const handler = subscribeMock.mock.calls[0][0];

    // Simulate matching event
    handler({ type: 'session_invalidated' });
    expect(callback).toHaveBeenCalledWith({ type: 'session_invalidated' });

    // Simulate non-matching event
    handler({ type: 'data_changed', keys: [] });
    expect(callback).toHaveBeenCalledTimes(1);

    // Unmount calls unsubscribe
    unmount();
    expect(subscribeMock.mock.results[0].value).toHaveBeenCalled();
  });

  it('throws error when used outside WSContext', () => {
    // Suppress console.error from React during render
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => {
      renderHook(() => useWSClient());
    }).toThrow('useWSClient must be used within a WSContext.Provider');

    console.error = originalError;
  });
});
