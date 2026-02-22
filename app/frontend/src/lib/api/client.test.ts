import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { env } from '@/env';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { CircuitBreaker } from './circuit-breaker';
import { client } from './client';

// For mocking __Host-csrf cookie
let mockCookie = '';
const _originalDocumentCookie = Object.getOwnPropertyDescriptor(
  Document.prototype,
  'cookie'
);
// Use it to prevent TS unused warning (or we could just not store it)
_originalDocumentCookie;

Object.defineProperty(document, 'cookie', {
  get: () => mockCookie,
  set: (val: string) => {
    mockCookie = val;
  },
  configurable: true,
});

let refreshCallCount = 0;
let getCallCount = 0;

const handlers = [
  http.get(`${env.VITE_API_URL}/api/v1/auth/refresh`, () => {
    refreshCallCount++;
    if (refreshCallCount <= 1) {
      return HttpResponse.json({ success: true }, { status: 200 });
    }
    return HttpResponse.json(
      { code: 'unauthorized', message: 'Token expired' },
      { status: 401 }
    );
  }),

  http.get(`${env.VITE_API_URL}/test-401`, () => {
    getCallCount++;
    if (getCallCount === 1) {
      // First call fails with 401
      return HttpResponse.json({ code: 'unauthorized' }, { status: 401 });
    }
    // Second call succeeds (after refresh)
    return HttpResponse.json({ success: true }, { status: 200 });
  }),

  http.get(`${env.VITE_API_URL}/test-503`, () => {
    getCallCount++;
    return HttpResponse.json({ code: 'service_unavailable' }, { status: 503 });
  }),

  http.post(`${env.VITE_API_URL}/test-post`, ({ request }) => {
    return HttpResponse.json(
      {
        success: true,
        method: request.method,
        csrf: request.headers.get('X-CSRF-Token'),
      },
      { status: 200 }
    );
  }),
];

const server = setupServer(...handlers);

describe('API Client', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  beforeEach(() => {
    refreshCallCount = 0;
    getCallCount = 0;
    mockCookie = '';
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'test', email: 'test@example.com' },
      sessionId: 's1',
    });

    // reset circuit breaker singleton
    // @ts-expect-error
    CircuitBreaker.instance = new CircuitBreaker();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllTimers();
  });

  afterAll(() => server.close());

  it('injects X-Request-ID and Accept-Language on request', async () => {
    useUIStore.setState({ locale: 'hi' });

    const req = await client.get('/test-401'); // this fails with 401 and refetches
    expect(req.config.headers['X-Request-ID']).to.toBeDefined();
    expect(req.config.headers['Accept-Language']).toBe('hi');
  });

  it('injects X-CSRF-Token on POST requests if cookie exists', async () => {
    mockCookie = '__Host-csrf=my-secret-csrf-token; other=cookie';

    const res = await client.post('/test-post', {});
    expect(res.data.csrf).toBe('my-secret-csrf-token');
  });

  it('handles 401 by attempting silent refresh and retrying original request', async () => {
    // getCallCount = 1 -> returns 401
    // client interceptor catches 401 -> calls /auth/refresh -> success -> retries /test-401 -> success
    const res = await client.get('/test-401');

    expect(res.status).toBe(200);
    expect(refreshCallCount).toBe(1);
    expect(getCallCount).toBe(2);
  });

  it('fails completely and logs out if refresh endpoint also returns 401', async () => {
    refreshCallCount = 1; // force refresh mock to return 401

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: 'http://localhost/' },
      writable: true,
    });

    try {
      await client.get('/test-401');
    } catch (e: any) {
      expect(e.status).toBe(401);
    }

    expect(useAuthStore.getState().isAuthenticated).toBe(false); // store cleared
    expect(window.location.href).toContain('/login?session_expired=true');

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('retries 3 times on 503 response with backoff', async () => {
    const requestPromise = client.get('/test-503');

    try {
      await requestPromise;
    } catch (e: any) {
      expect(e.status).toBe(503);
    }

    // 1 original call + 3 retries
    expect(getCallCount).toBe(4);
  }, 10000);
});
