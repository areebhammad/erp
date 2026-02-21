import { create } from 'zustand';

export interface Tenant {
  id: string;
  name: string;
  logoUrl?: string;
  subscriptionPlan: string;
  currency_code: string;
  locale: string;
  fiscal_year_start: string;
  gstin?: string;
}

export interface TenantState {
  tenant: Tenant | null;
  subscriptionPlan: string | null;
  currency_code: string | null;
  locale: string | null;
  fiscal_year_start: string | null;
  gstin: string | null;

  setTenant: (tenant: Tenant) => void;
  clearTenant: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  subscriptionPlan: null,
  currency_code: null,
  locale: null,
  fiscal_year_start: null,
  gstin: null,

  setTenant: (tenant) => {
    set({
      tenant,
      subscriptionPlan: tenant.subscriptionPlan,
      currency_code: tenant.currency_code,
      locale: tenant.locale,
      fiscal_year_start: tenant.fiscal_year_start,
      gstin: tenant.gstin || null,
    });
  },

  clearTenant: () => {
    set({
      tenant: null,
      subscriptionPlan: null,
      currency_code: null,
      locale: null,
      fiscal_year_start: null,
      gstin: null,
    });
  },
}));
