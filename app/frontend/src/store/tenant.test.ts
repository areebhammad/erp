import { beforeEach, describe, expect, it } from 'vitest';
import { useTenantStore } from './tenant';

describe('Tenant Store', () => {
  beforeEach(() => {
    // Reset store
    useTenantStore.getState().clearTenant();
  });

  it('sets and clears tenant state', () => {
    const tenant = {
      id: 'tenant-1',
      name: 'Acme Corp',
      subscriptionPlan: 'Enterprise',
      currency_code: 'INR',
      locale: 'en-IN',
      fiscal_year_start: '04-01',
      gstin: '07AAGFF2194N1Z1',
    };

    useTenantStore.getState().setTenant(tenant);

    const state = useTenantStore.getState();
    expect(state.tenant).toEqual(tenant);
    expect(state.subscriptionPlan).toBe('Enterprise');
    expect(state.currency_code).toBe('INR');

    useTenantStore.getState().clearTenant();
    expect(useTenantStore.getState().tenant).toBeNull();
  });

  it('sets tenant without gstin safely', () => {
    const tenant = {
      id: 'tenant-2',
      name: 'No GSTIN Corp',
      subscriptionPlan: 'Basic',
      currency_code: 'USD',
      locale: 'en-US',
      fiscal_year_start: '01-01',
      // gstin is intentionally omitted
    };

    useTenantStore.getState().setTenant(tenant);
    expect(useTenantStore.getState().gstin).toBeNull();
  });
});
