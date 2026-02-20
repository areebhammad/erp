/**
 * Page Header Component
 *
 * Standard page header with title, subtitle, and action slots.
 */

import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	subtitle?: string;
	actions?: ReactNode;
	breadcrumbs?: ReactNode;
}

export function PageHeader({
	title,
	subtitle,
	actions,
	breadcrumbs,
}: PageHeaderProps): ReactNode {
	return (
		<div className="mb-6 space-y-2">
			{breadcrumbs && (
				<div className="text-sm text-muted-foreground">{breadcrumbs}</div>
			)}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-foreground">{title}</h1>
					{subtitle && (
						<p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
					)}
				</div>
				{actions && <div className="flex items-center gap-2">{actions}</div>}
			</div>
		</div>
	);
}
