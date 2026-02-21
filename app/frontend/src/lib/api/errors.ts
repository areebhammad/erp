import * as Sentry from '@sentry/react';
import { AxiosError } from 'axios';

export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: Record<string, string[]>;
  public requestId: string;
  public traceId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId: string,
    details?: Record<string, string[]>,
    traceId?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
    this.traceId = traceId;

    // Sentry capture: if (status >= 500) Sentry.captureException(this, { tags: { request_id } })
    if (status >= 500) {
      if (typeof window !== 'undefined') {
        try {
          Sentry.captureException(this, { tags: { request_id: requestId } });
        } catch (e) {
          // Ignore if Sentry fails or isn't fully initialized
        }
      }
    }
  }

  static fromAxiosError(e: AxiosError): ApiError {
    const status = e.response?.status || 500;
    const data = (e.response?.data as any) || {};

    // code: fallback to circuit_open if custom, or network_error if none
    const code = data.code || (e.response ? 'unknown_error' : 'network_error');
    const message = data.message || e.message || 'An unexpected error occurred';

    const requestId =
      typeof e.config?.headers?.['X-Request-ID'] === 'string'
        ? e.config.headers['X-Request-ID']
        : data.request_id || 'unknown';

    const details = data.details;
    const traceId = data.trace_id;

    return new ApiError(status, code, message, requestId, details, traceId);
  }
}
