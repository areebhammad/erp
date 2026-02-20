/**
 * Money Component
 *
 * A component for displaying monetary values with proper formatting,
 * currency symbols, and locale-aware number formatting.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTenantStore } from "@/store/tenant";

interface MoneyProps {
	/** The amount to display */
	amount: number;
	/** Currency code (e.g., 'USD', 'EUR', 'INR'). Defaults to tenant currency */
	currency?: string;
	/** Locale for formatting. Defaults to tenant locale */
	locale?: string;
	/** Whether to show the currency symbol */
	showSymbol?: boolean;
	/** Whether to show the currency code */
	showCode?: boolean;
	/** Number of decimal places */
	decimals?: number;
	/** Whether to use compact notation for large numbers */
	compact?: boolean;
	/** Additional CSS classes */
	className?: string;
	/** Color based on value (positive/negative) */
	colorize?: boolean;
	/** Size variant */
	size?: "sm" | "md" | "lg";
}

/**
 * Format a number as currency
 */
function formatCurrency(
	amount: number,
	options: {
		currency: string;
		locale: string;
		showSymbol: boolean;
		showCode: boolean;
		decimals: number;
		compact: boolean;
	},
): string {
	const { currency, locale, showSymbol, showCode, decimals, compact } = options;

	const formatter = new Intl.NumberFormat(locale, {
		style: showSymbol ? "currency" : "decimal",
		currency: showSymbol ? currency : undefined,
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
		notation: compact ? "compact" : "standard",
		compactDisplay: compact ? "short" : undefined,
	});

	let formatted = formatter.format(amount);

	// Append currency code if requested
	if (showCode && !showSymbol) {
		formatted = `${formatted} ${currency}`;
	}

	return formatted;
}

/**
 * Money component for displaying currency values
 */
export function Money({
	amount,
	currency,
	locale,
	showSymbol = true,
	showCode = false,
	decimals = 2,
	compact = false,
	className,
	colorize = false,
	size = "md",
}: MoneyProps) {
	const tenant = useTenantStore((state) => state.tenant);

	// Use tenant defaults if not specified
	const resolvedCurrency = currency || tenant?.currencyCode || "INR";
	const resolvedLocale = locale || tenant?.locale || "en-IN";

	const formattedValue = useMemo(
		() =>
			formatCurrency(amount, {
				currency: resolvedCurrency,
				locale: resolvedLocale,
				showSymbol,
				showCode,
				decimals,
				compact,
			}),
		[
			amount,
			resolvedCurrency,
			resolvedLocale,
			showSymbol,
			showCode,
			decimals,
			compact,
		],
	);

	const sizeClasses = {
		sm: "text-sm",
		md: "text-base",
		lg: "text-lg font-semibold",
	};

	const colorClasses = colorize
		? amount > 0
			? "text-green-600 dark:text-green-400"
			: amount < 0
				? "text-red-600 dark:text-red-400"
				: ""
		: "";

	return (
		<span
			className={cn("tabular-nums", sizeClasses[size], colorClasses, className)}
		>
			{formattedValue}
		</span>
	);
}

/**
 * Hook for formatting money values
 */
export function useMoneyFormatter(options?: {
	currency?: string;
	locale?: string;
	decimals?: number;
}) {
	const tenant = useTenantStore((state) => state.tenant);

	const currency = options?.currency || tenant?.currencyCode || "INR";
	const locale = options?.locale || tenant?.locale || "en-IN";
	const decimals = options?.decimals ?? 2;

	return useMemo(
		() => ({
			format: (amount: number, overrides?: { compact?: boolean }) =>
				formatCurrency(amount, {
					currency,
					locale,
					showSymbol: true,
					showCode: false,
					decimals,
					compact: overrides?.compact ?? false,
				}),
			formatCompact: (amount: number) =>
				formatCurrency(amount, {
					currency,
					locale,
					showSymbol: true,
					showCode: false,
					decimals: 0,
					compact: true,
				}),
			formatPlain: (amount: number) =>
				formatCurrency(amount, {
					currency,
					locale,
					showSymbol: false,
					showCode: false,
					decimals,
					compact: false,
				}),
		}),
		[currency, locale, decimals],
	);
}

export default Money;
