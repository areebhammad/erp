import AxeCore from '@axe-core/react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import React from 'react';
import { EmptyState } from '@/components/app/EmptyState';
import { PageHeader } from '@/components/app/PageHeader';
import { StatCard } from '@/components/app/StatCard';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui';

export const Route = createFileRoute('/_dev/design')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }
  },
  component: DesignShowcase,
});

function DesignShowcase() {
  const { colorMode, setColorMode } = useUIStore();

  // For testing AxeCore in dev mode
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    import('react-dom').then((ReactDOM) => {
      AxeCore(React, ReactDOM, 1000);
    });
  }

  return (
    <div className="min-h-screen bg-surface p-8 pb-32">
      <div className="mx-auto max-w-5xl space-y-16">
        <PageHeader title="Design Showcase & Component Library" />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">1. Theme Toggle</h2>
          <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-surface-raised">
            <span className="text-sm">Current Mode: {colorMode}</span>
            <Button
              variant="outline"
              onClick={() =>
                setColorMode(colorMode === 'light' ? 'dark' : 'light')
              }
            >
              Toggle Light/Dark
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">2. Typography</h2>
          <div className="space-y-4 rounded-lg border border-border bg-surface-raised p-6">
            <h1 className="text-4xl font-bold">Heading 1 (text-4xl)</h1>
            <h2 className="text-3xl font-bold">Heading 2 (text-3xl)</h2>
            <h3 className="text-2xl font-bold">Heading 3 (text-2xl)</h3>
            <p className="text-base text-text">
              Body text: Lorem ipsum dolor sit amet, consectetur adipiscing
              elit. Sed do eiusmod tempor incididunt ut labore et dolore magna
              aliqua.
            </p>
            <p className="text-sm text-text-subtle">
              Small text (text-sm, text-text-subtle)
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">3. Colours</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Surface', var: 'var(--color-surface)' },
              { label: 'Surface Raised', var: 'var(--color-surface-raised)' },
              { label: 'Primary', var: 'var(--color-primary)' },
              { label: 'Success', var: 'var(--color-success)' },
              { label: 'Warning', var: 'var(--color-warning)' },
              { label: 'Error', var: 'var(--color-error)' },
              { label: 'Info', var: 'var(--color-info)' },
              { label: 'Border', var: 'var(--color-border)' },
            ].map((color) => (
              <div
                key={color.label}
                className="flex h-24 flex-col justify-end overflow-hidden rounded-lg border border-border"
                style={{ backgroundColor: color.var }}
              >
                <div className="bg-surface/90 p-2 text-xs font-mono backdrop-blur-sm">
                  {color.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">4. Buttons</h2>
          <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-surface-raised p-6">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">5. ERP Components</h2>

          <div className="space-y-8">
            <div>
              <h3 className="mb-2 text-lg font-medium text-text-subtle">
                Stat Card
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  title="Total Revenue"
                  value="$45,231.89"
                  trend={{
                    value: '20.1%',
                    positive: true,
                    label: 'vs last month',
                  }}
                />
                <StatCard
                  title="Active Subscriptions"
                  value="+2350"
                  trend={{
                    value: '180',
                    positive: true,
                    label: 'vs last month',
                  }}
                />
                <StatCard
                  title="Churn Rate"
                  value="1.2%"
                  trend={{
                    value: '0.1%',
                    positive: false,
                    label: 'vs last month',
                  }}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-medium text-text-subtle">
                Empty State
              </h3>
              <div className="rounded-lg border border-border p-8">
                <EmptyState
                  title="No projects found"
                  description="Get started by creating a new project."
                  actionLabel="Create Project"
                  onAction={() => {}}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
