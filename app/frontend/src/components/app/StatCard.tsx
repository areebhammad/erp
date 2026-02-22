import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string;
  trend?: {
    value: string;
    positive: boolean;
    label: string;
  };
  icon?: any;
}

export function StatCard({ title, value, trend, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && (
          <HugeiconsIcon
            icon={Icon}
            size={16}
            className="text-muted-foreground"
          />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="mt-1 flex items-center text-xs text-muted-foreground">
            <span
              className={`mr-1 flex items-center font-medium ${
                trend.positive
                  ? 'text-green-600 dark:text-green-500'
                  : 'text-red-600 dark:text-red-500'
              }`}
            >
              {trend.positive ? (
                <HugeiconsIcon
                  icon={ArrowUpRight01Icon}
                  size={14}
                  className="mr-1"
                />
              ) : (
                <HugeiconsIcon
                  icon={ArrowDownRight01Icon}
                  size={14}
                  className="mr-1"
                />
              )}
              {trend.value}
            </span>
            {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
