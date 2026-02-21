import type { WSEvent } from './events';
import type { ConnectionStatus } from '@/store/ui';

export class WSClient {
  private url: string;
  private onStatusChange: (status: ConnectionStatus) => void;
  public ws: WebSocket | null = null;
  private reconnectIntervalId: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private maxReconnectTime = 30000;
  private initialReconnectTime = 1000;
  private isConnecting = false;
  private isIntentionalDisconnect = false;
  private listeners: Set<(event: WSEvent) => void> = new Set();

  constructor(
    url: string,
    onStatusChange: (status: ConnectionStatus) => void
  ) {
    this.url = url;
    this.onStatusChange = onStatusChange;
  }

  public subscribe(listener: (event: WSEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public connect() {
    this.isIntentionalDisconnect = false;
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;
    this.onStatusChange('connecting');
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.isConnecting = false;
      this.attempt = 0;
      this.onStatusChange('connected');
      if (this.reconnectIntervalId !== null) {
        clearTimeout(this.reconnectIntervalId);
        this.reconnectIntervalId = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEvent;
        this.listeners.forEach(listener => listener(data));
      } catch (e) {
        console.error('Failed to parse websocket message', e);
      }
    };

    this.ws.onclose = () => {
      this.isConnecting = false;
      this.ws = null;
      if (!this.isIntentionalDisconnect) {
        this.onStatusChange('disconnected');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.isConnecting = false;
    };
  }

  public disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.reconnectIntervalId !== null) {
      clearTimeout(this.reconnectIntervalId);
      this.reconnectIntervalId = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatusChange('disconnected');
  }

  private scheduleReconnect() {
    if (this.reconnectIntervalId !== null || this.isIntentionalDisconnect) return;

    let delay = Math.min(
      this.initialReconnectTime * Math.pow(2, this.attempt),
      this.maxReconnectTime
    );
    // ±500 ms jitter
    const jitter = Math.random() * 1000 - 500;
    delay = Math.max(0, delay + jitter);
    this.attempt++;

    this.reconnectIntervalId = setTimeout(() => {
      this.reconnectIntervalId = null;
      this.connect();
    }, delay);
  }
}
