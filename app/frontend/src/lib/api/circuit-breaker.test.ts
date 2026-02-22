import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '@/store/ui';
import { CircuitBreaker, circuitBreaker } from './circuit-breaker';

vi.mock('axios');

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // reset useUIStore connection status
    useUIStore.setState({ connectionStatus: 'connected' });

    // hack to reset singleton for testing
    // @ts-expect-error
    CircuitBreaker.instance = new CircuitBreaker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initially has CLOSED state', () => {
    // @ts-expect-error
    expect(CircuitBreaker.instance.state).toBe('CLOSED');
    expect(circuitBreaker.isOpen()).toBe(false);
  });

  it('records failures and opens circuit after 5 consecutive failures', () => {
    // @ts-expect-error
    const cb = CircuitBreaker.instance;

    expect(cb.isOpen()).toBe(false);

    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);

    // 5th failure
    cb.recordFailure();

    expect(cb.isOpen()).toBe(true);
    // @ts-expect-error
    expect(cb.state).toBe('OPEN');
    expect(useUIStore.getState().connectionStatus).toBe('disconnected');
  });

  it('resets consecutive failures if a success is recorded', () => {
    // @ts-expect-error
    const cb = CircuitBreaker.instance;

    cb.recordFailure();
    cb.recordFailure();

    cb.recordSuccess();

    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure(); // this is the 4th failure after success, shouldn't open

    expect(cb.isOpen()).toBe(false);
  });

  it('tests half-open and probe', async () => {
    // @ts-expect-error
    const cb = CircuitBreaker.instance;

    // Fail 5 times
    for (let i = 0; i < 5; i++) {
      cb.recordFailure();
    }
    expect(cb.isOpen()).toBe(true);

    // mock the probe axios get
    // @ts-expect-error
    axios.get.mockResolvedValue({ status: 200 });

    // forward 30s
    vi.advanceTimersByTime(30000);

    // Give promises time to resolve since setInterval is used with async function
    await vi.runAllTicks(); // vitest async timer resolution might be tricky
    await new Promise((resolve) => process.nextTick(resolve));

    // Expect circuit to close since probe was successful
    expect(cb.isOpen()).toBe(false);
    expect(useUIStore.getState().connectionStatus).toBe('connected');
  });
});
