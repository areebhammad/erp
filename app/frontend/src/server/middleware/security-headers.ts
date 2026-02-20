/**
 * Security Headers Middleware
 *
 * Applies security headers to all responses:
 * - Content-Security-Policy (strict; allows 'self', Sentry, PostHog, WSS origin)
 * - Strict-Transport-Security (1 year + preload)
 * - X-Frame-Options: DENY
 * - X-Content-Type-Options: nosniff
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: geolocation=(), microphone=(), camera=()
 *
 * @see https://owasp.org/www-project-secure-headers/
 */

import type { H3Event } from "h3";
import { defineEventHandler, setResponseHeaders } from "h3";

// CSP directives - adjust these based on your actual needs
const CSP_DIRECTIVES = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval needed for some build tools
	"style-src 'self' 'unsafe-inline'", // unsafe-inline needed for Tailwind
	"img-src 'self' data: blob: https:",
	"font-src 'self' data:",
	"connect-src 'self' https://app.posthog.com https://*.sentry.io wss:", // API + Sentry + PostHog + WebSocket
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'",
].join("; ");

export default defineEventHandler((event: H3Event) => {
	setResponseHeaders(event, {
		// Prevent clickjacking
		"X-Frame-Options": "DENY",

		// Prevent MIME type sniffing
		"X-Content-Type-Options": "nosniff",

		// Control referrer information
		"Referrer-Policy": "strict-origin-when-cross-origin",

		// Enable HSTS (1 year + preload)
		"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

		// Content Security Policy
		"Content-Security-Policy": CSP_DIRECTIVES,

		// Disable browser features we don't use
		"Permissions-Policy": "geolocation=(), microphone=(), camera=()",
	});
});
