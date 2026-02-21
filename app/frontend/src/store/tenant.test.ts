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
});
