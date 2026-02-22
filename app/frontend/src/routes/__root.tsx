import * as Sentry from '@sentry/react';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Scripts,
} from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import posthog from 'posthog-js';
import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { env } from '../env';
import { initColorModeScript } from '../lib/color-mode';
import appCss from '../styles.css?url';

if (typeof window !== 'undefined') {
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE,
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  });

  posthog.init(env.VITE_POSTHOG_KEY, {
    api_host: env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
  });

  try {
    onCLS((m: Metric) =>
      posthog.capture('web_vitals', { metric: 'CLS', ...m })
    );
    onFCP((m: Metric) =>
      posthog.capture('web_vitals', { metric: 'FCP', ...m })
    );
    onLCP((m: Metric) =>
      posthog.capture('web_vitals', { metric: 'LCP', ...m })
    );
    onINP((m: Metric) =>
      posthog.capture('web_vitals', { metric: 'INP', ...m })
    );
    onTTFB((m: Metric) =>
      posthog.capture('web_vitals', { metric: 'TTFB', ...m })
    );
  } catch (e) {
    console.error('Core web vitals unsupported', e);
  }
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'ERP Frontend Foundation',
      },
    ],
    scripts: [
      {
        type: 'text/javascript',
        children: initColorModeScript,
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        as: 'style',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    ],
  }),

  shellComponent: RootDocument,
  notFoundComponent: () => {
    return (
      <div className="flex h-screen items-center justify-center flex-col text-center p-4">
        <h1 className="text-6xl font-black mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Oops! We couldn't find the page you're requesting.
        </p>
        <Link
          to="/"
          className="text-primary text-sm font-semibold hover:underline bg-primary/10 px-4 py-2 rounded-md"
        >
          Return Home
        </Link>
      </div>
    );
  },
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <Sentry.ErrorBoundary fallback={<div>Application Error</div>}>
          {children}
        </Sentry.ErrorBoundary>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
