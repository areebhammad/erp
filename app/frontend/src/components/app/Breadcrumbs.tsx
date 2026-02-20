/**
 * Breadcrumbs Component
 *
 * Auto-generates breadcrumb navigation from TanStack Router matches.
 * Supports custom labels via route loader data.
 */

import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
	label: string;
	href: string;
	isCurrent: boolean;
}

interface BreadcrumbsProps {
	/** Optional home label override */
	homeLabel?: string;
	/** Optional className for styling */
	className?: string;
}

/**
 * Extracts a human-readable label from a route path segment
 */
function segmentToLabel(segment: string): string {
	// Remove dynamic route markers
	const cleaned = segment.replace(/^\$/, "").replace(/\[|\]/g, "");

	// Convert kebab-case or snake_case to Title Case
	return cleaned
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

/**
 * Breadcrumbs component that auto-generates navigation from router state
 */
export function Breadcrumbs({
	homeLabel = "Home",
	className = "",
}: BreadcrumbsProps) {
	const routerState = useRouterState();
	const matches = routerState.matches;

	// Build breadcrumb items from route matches
	const breadcrumbs: BreadcrumbItem[] = [];

	// Always add home
	breadcrumbs.push({
		label: homeLabel,
		href: "/",
		isCurrent: matches.length === 1 && matches[0].pathname === "/",
	});

	// Process each match (skip root)
	for (let i = 0; i < matches.length; i++) {
		const match = matches[i];
		const pathname = match.pathname;

		// Skip root and index routes
		if (pathname === "/" || pathname === "") continue;

		// Check if route has custom breadcrumb label in loader data
		const loaderData = match.loaderData as
			| { breadcrumbLabel?: string }
			| undefined;
		const customLabel = loaderData?.breadcrumbLabel;

		// Extract label from pathname or use custom label
		const segments = pathname.split("/").filter(Boolean);
		const lastSegment = segments[segments.length - 1];
		const label = customLabel || segmentToLabel(lastSegment);

		// Skip if this would duplicate the previous breadcrumb
		const prevBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
		if (prevBreadcrumb && prevBreadcrumb.href === pathname) continue;

		breadcrumbs.push({
			label,
			href: pathname,
			isCurrent: i === matches.length - 1,
		});
	}

	// Don't render if only home
	if (breadcrumbs.length <= 1) {
		return null;
	}

	return (
		<nav
			aria-label="Breadcrumb"
			className={`flex items-center text-sm ${className}`}
		>
			<ol className="flex items-center gap-1">
				{breadcrumbs.map((crumb, index) => (
					<li key={crumb.href} className="flex items-center">
						{index > 0 && (
							<ChevronRight
								className="mx-1 h-4 w-4 text-muted-foreground"
								aria-hidden="true"
							/>
						)}
						{crumb.isCurrent ? (
							<span className="font-medium text-foreground" aria-current="page">
								{index === 0 ? (
									<span className="flex items-center gap-1">
										<Home className="h-4 w-4" aria-hidden="true" />
										<span className="sr-only">{crumb.label}</span>
									</span>
								) : (
									crumb.label
								)}
							</span>
						) : (
							<Link
								to={crumb.href}
								className="text-muted-foreground transition-colors hover:text-foreground"
							>
								{index === 0 ? (
									<span className="flex items-center gap-1">
										<Home className="h-4 w-4" aria-hidden="true" />
										<span className="sr-only">{crumb.label}</span>
									</span>
								) : (
									crumb.label
								)}
							</Link>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}

export default Breadcrumbs;
