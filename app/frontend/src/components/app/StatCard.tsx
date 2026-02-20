/**
 * StatCard Component
 *
 * A card displaying a key metric with optional trend indicator,
 * icon, and comparison to previous period.
 */

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
	/** The title/label for the stat */
	title: string;
	/** The main value to display */
	value: string | number;
	/** Optional description or subtitle */
	description?: string;
	/** Optional icon component */
	icon?: React.ComponentType<{ className?: string }>;
	/** Trend direction */
	trend?: "up" | "down" | "neutral";
	/** Trend value (e.g., "+12%") */
	trendValue?: string;
	/** Whether the trend is positive (green) or negative (red) */
	trendPositive?: boolean;
	/** Additional CSS classes */
	className?: string;
	/** Loading state */
	loading?: boolean;
}

/**
 * StatCard component for displaying key metrics
 */
export function StatCard({
	title,
	value,
	description,
	icon: Icon,
	trend,
	trendValue,
	trendPositive = true,
	className,
	loading = false,
}: StatCardProps) {
	const TrendIcon =
		trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

	const trendColorClass =
		trend === "neutral"
			? "text-muted-foreground"
			: (trend === "up" && trendPositive) ||
					(trend === "down" && !trendPositive)
				? "text-green-500"
				: "text-red-500";

	if (loading) {
		return (
			<div
				className={cn(
					"rounded-xl border border-border bg-card p-6 shadow-sm",
					className,
				)}
			>
				<div className="animate-pulse">
					<div className="mb-2 h-4 w-24 rounded bg-muted" />
					<div className="mb-2 h-8 w-32 rounded bg-muted" />
					<div className="h-4 w-20 rounded bg-muted" />
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md",
				className,
			)}
		>
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<p className="text-sm font-medium text-muted-foreground">{title}</p>
					<p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
					{(trend || description) && (
						<div className="mt-2 flex items-center gap-2">
							{trend && trendValue && (
								<span
									className={cn("flex items-center text-sm", trendColorClass)}
								>
									<TrendIcon className="mr-1 h-4 w-4" />
									{trendValue}
								</span>
							)}
							{description && (
								<span className="text-sm text-muted-foreground">
									{description}
								</span>
							)}
						</div>
					)}
				</div>
				{Icon && (
					<div className="rounded-lg bg-primary/10 p-3">
						<Icon className="h-6 w-6 text-primary" />
					</div>
				)}
			</div>
		</div>
	);
}

export default StatCard;
