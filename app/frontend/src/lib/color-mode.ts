/**
 * Color Mode Initialization
 *
 * Prevents flash of incorrect theme by synchronously applying the correct
 * dark/light class to <html> before first paint.
 *
 * The script reads from localStorage['ui-store'] for persisted preference,
 * falling back to system preference if set to 'system'.
 */

export type ColorMode = "light" | "dark" | "system";

const STORAGE_KEY = "ui-store";
const DARK_CLASS = "dark";

/**
 * Get the stored color mode preference from localStorage
 */
function getStoredColorMode(): ColorMode | null {
	if (typeof window === "undefined") return null;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as {
				state?: { colorMode?: ColorMode };
			};
			return parsed?.state?.colorMode ?? null;
		}
	} catch {
		// Ignore parse errors
	}
	return null;
}

/**
 * Check if system prefers dark mode
 */
function getSystemPrefersDark(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Determine if dark mode should be applied
 */
function shouldUseDarkMode(storedMode: ColorMode | null): boolean {
	if (storedMode === "dark") return true;
	if (storedMode === "light") return false;
	// 'system' or null -> use system preference
	return getSystemPrefersDark();
}

/**
 * Apply dark mode class to document element
 */
function applyDarkMode(useDark: boolean): void {
	if (typeof document === "undefined") return;

	const html = document.documentElement;
	if (useDark) {
		html.classList.add(DARK_CLASS);
	} else {
		html.classList.remove(DARK_CLASS);
	}
}

/**
 * Initialize color mode synchronously (call before paint)
 * This is the main function to call on page load
 */
export function initColorMode(): void {
	const storedMode = getStoredColorMode();
	const useDark = shouldUseDarkMode(storedMode);
	applyDarkMode(useDark);
}

/**
 * Set color mode and apply it
 */
export function setColorMode(mode: ColorMode): void {
	const useDark = shouldUseDarkMode(mode);
	applyDarkMode(useDark);
}

/**
 * Get the current effective color mode (resolves 'system' to actual value)
 */
export function getEffectiveColorMode(): "light" | "dark" {
	const storedMode = getStoredColorMode();
	return shouldUseDarkMode(storedMode) ? "dark" : "light";
}

/**
 * Script to inject inline in <head> for no-flash initialization
 * This runs before React hydrates to prevent theme flash
 */
export const COLOR_MODE_INIT_SCRIPT = `
(function() {
	try {
		var stored = localStorage.getItem('ui-store');
		var mode = stored ? JSON.parse(stored).state?.colorMode : null;
		var useDark = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		if (useDark) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	} catch (e) {}
})();
`;

/**
 * Get the inline script tag for injection in head
 */
export function getColorModeScriptTag(): string {
	return `<script>${COLOR_MODE_INIT_SCRIPT}</script>`;
}
