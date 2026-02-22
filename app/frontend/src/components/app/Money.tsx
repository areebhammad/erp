import { useTenantStore } from '@/store/tenant';

interface MoneyProps {
  amount: number;
  currency?: string;
}

export function Money({ amount, currency }: MoneyProps) {
  const { tenant } = useTenantStore();

  const displayCurrency = currency || tenant?.currency_code || 'INR';
  const locale = tenant?.locale || 'en-IN';

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: displayCurrency,
    minimumFractionDigits: 2,
  }).format(amount);

  return <span className="tabular-nums">{formatted}</span>;
}
