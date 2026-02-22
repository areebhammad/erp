import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WSClient } from './client';

class MockWebSocket {
  static OPEN = 1;
  readyState = 0;
  onopen: any = null;
  onmessage: any = null;
  onclose: any = null;
  onerror: any = null;
  close = vi.fn();
  constructor(public url: string) {}
}

describe('WSClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects to websocket and sets status', () => {
    let mockStatus = '';
    const wsClient = new WSClient('ws://localhost', (s) => (mockStatus = s));

    wsClient.connect();
    expect(mockStatus).toBe('connecting');
    expect(wsClient.ws).not.toBeNull();

    // Trigger onopen
    wsClient.ws?.onopen?.({} as any);
    expect(mockStatus).toBe('connected');
  });

  it('reconnects with exponential backoff on close', () => {
    let mockStatus = '';
    const wsClient = new WSClient('ws://localhost', (s) => (mockStatus = s));

    wsClient.connect();
    wsClient.ws?.onclose?.({} as any);

    expect(mockStatus).toBe('disconnected');

    const connectSpy = vi.spyOn(wsClient, 'connect');
    vi.advanceTimersByTime(2000);
    expect(connectSpy).toHaveBeenCalled();
  });

  it('subscribes to events and broadcasts them', () => {
    const wsClient = new WSClient('ws://localhost', () => {});
    wsClient.connect();

    const handler = vi.fn();
    wsClient.subscribe(handler);

    wsClient.ws?.onmessage?.({ data: '{"type":"ping"}' } as any);
    expect(handler).toHaveBeenCalledWith({ type: 'ping' });
  });

  it('does not crash on invalid JSON', () => {
    const wsClient = new WSClient('ws://localhost', () => {});
    wsClient.connect();

    // Should not throw
    expect(() => {
      wsClient.ws?.onmessage?.({ data: 'invalid json' } as any);
    }).not.toThrow();
  });
});
