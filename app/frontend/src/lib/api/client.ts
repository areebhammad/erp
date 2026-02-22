import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/env';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { circuitBreaker } from './circuit-breaker';
import { ApiError } from './errors';

export const client = axios.create({
  baseURL: env.VITE_API_URL,
  withCredentials: true,
  timeout: 30000,
});

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )__Host-csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const isAuthEndpoint = config.url?.startsWith('/api/v1/auth/');
    if (!isAuthEndpoint && circuitBreaker.isOpen()) {
      return Promise.reject(
        new ApiError(503, 'circuit_open', 'Service Unavailable', 'none')
      );
    }

    const method = config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = getCsrfToken();
      if (csrf) {
        config.headers.set('X-CSRF-Token', csrf);
      }
    }

    if (!config.headers.get('X-Request-ID')) {
      config.headers.set('X-Request-ID', crypto.randomUUID());
    }

    const locale = useUIStore.getState().locale;
    if (locale) {
      config.headers.set('Accept-Language', locale);
    }

    (config as any)._retryCount = (config as any)._retryCount || 0;

    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => {
    circuitBreaker.recordSuccess();
    return response;
  },
  async (error: AxiosError) => {
    const originalConfig = error.config as InternalAxiosRequestConfig & {
      _retryCount: number;
      _isRetryFor401?: boolean;
    };
    if (!originalConfig) {
      return Promise.reject(ApiError.fromAxiosError(error));
    }

    const status = error.response?.status;
    const isNetworkError = !error.response;
    const is5xx = status && status >= 500;
    const isAuthEndpoint = originalConfig.url?.includes('/auth/');

    if (!isAuthEndpoint) {
      if (is5xx || isNetworkError) {
        circuitBreaker.recordFailure();
      } else if (status && status < 500) {
        circuitBreaker.recordSuccess();
      }
    }

    if (status === 401 && !originalConfig.url?.includes('/auth/refresh')) {
      if (!originalConfig._isRetryFor401) {
        originalConfig._isRetryFor401 = true;
        try {
          // Attempt silent refresh
          await axios.get('/api/v1/auth/refresh', {
            baseURL: env.VITE_API_URL,
            withCredentials: true,
          });
          return client(originalConfig);
        } catch (refreshError) {
          useAuthStore.getState().clearAuth();
          if (typeof window !== 'undefined') {
            window.location.href = '/login?session_expired=true';
          }
          return Promise.reject(
            ApiError.fromAxiosError(refreshError as AxiosError)
          );
        }
      } else {
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login?session_expired=true';
        }
        return Promise.reject(ApiError.fromAxiosError(error));
      }
    }

    if ((is5xx || isNetworkError) && !circuitBreaker.isOpen()) {
      const method = originalConfig.method?.toUpperCase();
      if (method && ['GET', 'PUT', 'DELETE'].includes(method)) {
        if (originalConfig._retryCount < 3) {
          originalConfig._retryCount++;

          const baseDelay = 500 * 2 ** (originalConfig._retryCount - 1);
          const jitter = Math.random() * 200 - 100;
          const delay = baseDelay + jitter;

          return new Promise((resolve) => {
            setTimeout(() => resolve(client(originalConfig)), delay);
          });
        }
      }
    }

    return Promise.reject(ApiError.fromAxiosError(error));
  }
);
