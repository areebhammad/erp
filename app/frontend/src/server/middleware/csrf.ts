/**
 * CSRF Token Middleware
 *
 * Sets a readable (non-HttpOnly) __Host-csrf cookie on every response.
 * The cookie contains a cryptographically random value that the frontend
 * reads and sends as X-CSRF-Token header on state-mutating requests.
 *
 * This implements the double-submit cookie pattern for CSRF protection.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie
 */

import { randomBytes } from "node:crypto";
import type { H3Event } from "h3";
import { defineEventHandler, getCookie, setCookie } from "h3";

const CSRF_COOKIE_NAME = "__Host-csrf";
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure random token
 */
function generateCsrfToken(): string {
	return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

export default defineEventHandler((event: H3Event) => {
	// Check if CSRF cookie already exists
	const existingToken = getCookie(event, CSRF_COOKIE_NAME);

	// Only set a new token if one doesn't exist
	// This prevents overwriting on every response
	if (!existingToken) {
		const token = generateCsrfToken();

		setCookie(event, CSRF_COOKIE_NAME, token, {
			// __Host- prefix requires these settings
			httpOnly: false, // Must be readable by JS
			secure: true,
			sameSite: "strict",
			path: "/",
			// Cookie expires when session ends (no max-age)
		});
	}
});

/**
 * Helper function to read CSRF token from cookie (for client-side use)
 */
export function getCsrfTokenFromCookie(): string | null {
	if (typeof document === "undefined") return null;

	const cookies = document.cookie.split(";");
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split("=");
		if (name === CSRF_COOKIE_NAME) {
			return value;
		}
	}
	return null;
}

export { CSRF_COOKIE_NAME };
