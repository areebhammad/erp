import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Link, useMatches } from '@tanstack/react-router';

export function Breadcrumbs() {
  const matches = useMatches();

  const breadcrumbs = matches
    .filter(
      (match) =>
        match.status === 'success' &&
        (match.staticData as { breadcrumb?: string })?.breadcrumb
    )
    .map((match) => ({
      label: (match.staticData as { breadcrumb: string }).breadcrumb,
      path: match.pathname,
    }));

  if (breadcrumbs.length <= 1) return null;

  return (
    <nav aria-label="breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1.5">
              {index > 0 && <HugeiconsIcon icon={ArrowRight01Icon} size={14} />}
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-medium text-foreground"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
