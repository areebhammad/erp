import { describe, expect, it, vi } from 'vitest';
import { client } from './client';
import { getCurrentTenantApi, updateTenantApi } from './tenant';

vi.mock('./client', () => ({
  client: {
    get: vi.fn().mockResolvedValue({ data: { success: true } }),
    patch: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

describe('tenant API', () => {
  it('calls getCurrentTenantApi endpoint', async () => {
    await getCurrentTenantApi();
    expect(client.get).toHaveBeenCalledWith('/api/v1/tenants/me');
  });

  it('calls updateTenantApi endpoint', async () => {
    const data = { name: 'New Name' };
    await updateTenantApi(data);
    expect(client.patch).toHaveBeenCalledWith('/api/v1/tenants/me', data);
  });
});
