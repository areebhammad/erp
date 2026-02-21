import { defineEventHandler, setResponseHeader } from 'h3';

export default defineEventHandler((event: any) => {
  setResponseHeader(
    event,
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' https://app.posthog.com wss: ws: https://browser.sentry-cdn.com"
  );
  setResponseHeader(
    event,
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  setResponseHeader(event, 'X-Frame-Options', 'DENY');
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  setResponseHeader(
    event,
    'Referrer-Policy',
    'strict-origin-when-cross-origin'
  );
  setResponseHeader(
    event,
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );
});
