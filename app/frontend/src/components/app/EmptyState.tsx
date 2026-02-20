/**
 * EmptyState Component
 *
 * A placeholder component for empty data states with customizable
 * icon, title, description, and action button.
 */

import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
	/** Icon to display */
	icon?: React.ComponentType<{ className?: string }>;
	/** Title text */
	title: string;
	/** Description text */
	description?: string;
	/** Primary action button text */
	actionLabel?: string;
	/** Primary action callback */
	onAction?: () => void;
	/** Secondary action button text */
	secondaryActionLabel?: string;
	/** Secondary action callback */
	onSecondaryAction?: () => void;
	/** Additional CSS classes */
	className?: string;
	/** Size variant */
	size?: "sm" | "md" | "lg";
}

/**
 * EmptyState component for displaying when no data is available
 */
export function EmptyState({
	icon: Icon = Inbox,
	title,
	description,
	actionLabel,
	onAction,
	secondaryActionLabel,
	onSecondaryAction,
	className,
	size = "md",
}: EmptyStateProps) {
	const sizeClasses = {
		sm: {
			container: "py-8",
			icon: "h-10 w-10",
			title: "text-base",
			description: "text-sm",
		},
		md: {
			container: "py-12",
			icon: "h-12 w-12",
			title: "text-lg",
			description: "text-sm",
		},
		lg: {
			container: "py-16",
			icon: "h-16 w-16",
			title: "text-xl",
			description: "text-base",
		},
	};

	const sizes = sizeClasses[size];

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center text-center",
				sizes.container,
				className,
			)}
		>
			<div className="rounded-full bg-muted p-4">
				<Icon className={cn("text-muted-foreground", sizes.icon)} />
			</div>
			<h3 className={cn("mt-4 font-semibold", sizes.title)}>{title}</h3>
			{description && (
				<p
					className={cn(
						"mt-2 max-w-sm text-muted-foreground",
						sizes.description,
					)}
				>
					{description}
				</p>
			)}
			{(actionLabel || secondaryActionLabel) && (
				<div className="mt-6 flex items-center gap-3">
					{actionLabel && onAction && (
						<Button onClick={onAction}>
							<Plus className="mr-2 h-4 w-4" />
							{actionLabel}
						</Button>
					)}
					{secondaryActionLabel && onSecondaryAction && (
						<Button variant="outline" onClick={onSecondaryAction}>
							{secondaryActionLabel}
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Preset empty states for common scenarios
 */
export const EmptyStatePresets = {
	/** No search results */
	NoResults: (props: Partial<EmptyStateProps>) => (
		<EmptyState
			title="No results found"
			description="Try adjusting your search or filter criteria"
			{...props}
		/>
	),

	/** No data yet */
	NoData: (props: Partial<EmptyStateProps> & { entityName?: string }) => (
		<EmptyState
			title={`No ${props.entityName || "items"} yet`}
			description={`Get started by creating your first ${props.entityName || "item"}`}
			actionLabel={`Create ${props.entityName || "item"}`}
			{...props}
		/>
	),

	/** Error state */
	Error: (props: Partial<EmptyStateProps>) => (
		<EmptyState
			title="Something went wrong"
			description="We couldn't load the data. Please try again."
			actionLabel="Retry"
			{...props}
		/>
	),

	/** No permissions */
	NoPermission: (props: Partial<EmptyStateProps>) => (
		<EmptyState
			title="Access denied"
			description="You don't have permission to view this content"
			{...props}
		/>
	),
};

export default EmptyState;
