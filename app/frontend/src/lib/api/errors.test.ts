import * as Sentry from '@sentry/react';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

describe('ApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs from a 422 AxiosError properly', () => {
    const mockAxiosError = {
      isAxiosError: true,
      name: 'AxiosError',
      message: 'Request failed with status code 422',
      config: {
        headers: {
          'X-Request-ID': 'req-123',
        },
      } as unknown as InternalAxiosRequestConfig,
      response: {
        status: 422,
        data: {
          code: 'validation_error',
          message: 'Invalid input',
          details: { email: ['Invalid email address'] },
          trace_id: 'trace-456',
        },
      } as AxiosResponse,
    } as AxiosError;

    const error = ApiError.fromAxiosError(mockAxiosError);

    expect(error.status).toBe(422);
    expect(error.code).toBe('validation_error');
    expect(error.message).toBe('Invalid input');
    expect(error.requestId).toBe('req-123');
    expect(error.details).toEqual({ email: ['Invalid email address'] });
    expect(error.traceId).toBe('trace-456');
    expect(error.name).toBe('ApiError');

    // Should not call Sentry for < 500
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('constructs from a 500 AxiosError and calls Sentry', () => {
    const mockAxiosError = {
      isAxiosError: true,
      name: 'AxiosError',
      message: 'Network Error',
      config: {
        headers: {
          'X-Request-ID': 'req-server-123',
        },
      } as unknown as InternalAxiosRequestConfig,
      response: {
        status: 500,
        data: {
          message: 'Internal server error',
        },
      } as AxiosResponse,
    } as AxiosError;

    const error = ApiError.fromAxiosError(mockAxiosError);

    expect(error.status).toBe(500);
    expect(error.code).toBe('unknown_error'); // fallback
    expect(error.message).toBe('Internal server error');
    expect(error.requestId).toBe('req-server-123');

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { request_id: 'req-server-123' },
    });
  });

  it('constructs from a network error', () => {
    const mockAxiosError = {
      isAxiosError: true,
      name: 'AxiosError',
      message: 'Network Error',
      config: {
        headers: {},
      } as unknown as InternalAxiosRequestConfig,
      // No response object for network error
    } as AxiosError;

    const error = ApiError.fromAxiosError(mockAxiosError);

    expect(error.status).toBe(500); // fallback
    expect(error.code).toBe('network_error');
    expect(error.message).toBe('Network Error');
    expect(error.requestId).toBe('unknown');
  });
});
