import axios from 'axios';
import { env } from '@/env';
import { useUIStore } from '@/store/ui';

export class CircuitBreaker {
  private static instance: CircuitBreaker;

  private consecutiveFailures = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private firstFailureTime = 0;
  private intervalId?: number | NodeJS.Timeout;

  private constructor() {}

  static getInstance(): CircuitBreaker {
    if (!CircuitBreaker.instance) {
      CircuitBreaker.instance = new CircuitBreaker();
    }
    return CircuitBreaker.instance;
  }

  recordFailure() {
    const now = Date.now();
    // Reset window if it's been more than 60 seconds since first failure
    if (this.consecutiveFailures === 0 || now - this.firstFailureTime > 60000) {
      this.firstFailureTime = now;
      this.consecutiveFailures = 1;
    } else {
      this.consecutiveFailures++;
    }

    if (this.consecutiveFailures >= 5 && this.state === 'CLOSED') {
      this.openCircuit();
    }
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    if (this.state !== 'CLOSED') {
      this.closeCircuit();
    }
  }

  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  private openCircuit() {
    this.state = 'OPEN';
    useUIStore.getState().setConnectionStatus('disconnected');

    // Attempt probe every 30 seconds
    this.intervalId = setInterval(async () => {
      this.state = 'HALF_OPEN';
      try {
        const res = await axios.get(`${env.VITE_API_URL}/health`, {
          timeout: 10000,
        });
        if (res.status === 200) {
          this.recordSuccess();
        } else {
          this.state = 'OPEN';
        }
      } catch (err) {
        this.state = 'OPEN';
      }
    }, 30000);
  }

  private closeCircuit() {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    useUIStore.getState().setConnectionStatus('connected');

    if (this.intervalId) {
      clearInterval(this.intervalId as any);
      this.intervalId = undefined;
    }
  }
}

export const circuitBreaker = CircuitBreaker.getInstance();
